from datetime import date, datetime, timezone
from uuid import UUID, uuid4
from html import escape
from io import BytesIO
import re
from zipfile import ZIP_DEFLATED, ZipFile

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.repositories.care_procedure_type import get_care_procedure_type

from app.repositories.analytics import AnalyticsRepository
from app.schemas.analytics import (
    AnalyticsResponse, AnimalAnalytics, MonthlyExecution, ProcedureAnalytics,
    ProcedureTypeShare, ReportMetric, ReportResponse, ReportType,
    VolunteerActivity, VolunteerAnalytics,
)

MONTH_LABELS = ("Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек")


def recent_months(today: date, count: int = 6) -> list[date]:
    current = today.year * 12 + today.month - 1
    result = []
    for offset in range(count - 1, -1, -1):
        value = current - offset
        result.append(date(value // 12, value % 12 + 1, 1))
    return result


class AnalyticsService:
    def __init__(self, session: AsyncSession) -> None:
        self.repository = AnalyticsRepository(session)

    async def dashboard(self) -> AnalyticsResponse:
        animals = await self.repository.animal_counts()
        volunteers = await self.repository.volunteer_counts()
        procedures = await self.repository.procedure_counts()
        months = recent_months(date.today())
        monthly_counts = await self.repository.monthly_executions(months[0])
        distribution = await self.repository.procedure_type_distribution()
        distribution_total = sum(item[2] for item in distribution)
        activity = await self.repository.top_volunteers()
        return AnalyticsResponse(
            animals=AnimalAnalytics(total=animals[0], in_care=animals[1], archived=animals[2]),
            volunteers=VolunteerAnalytics(total=volunteers[0], active=volunteers[1], inactive=volunteers[2]),
            procedures=ProcedureAnalytics(
                total=procedures[0], assigned=procedures[1], completed=procedures[2],
                cancelled=procedures[3], overdue=procedures[4],
            ),
            executions_by_month=[MonthlyExecution(
                month=month.strftime("%Y-%m"), label=MONTH_LABELS[month.month - 1],
                completed=monthly_counts.get(month.strftime("%Y-%m"), 0),
            ) for month in months],
            procedure_types=[ProcedureTypeShare(
                procedure_type_id=type_id, name=name, count=count,
                percentage=round(count * 100 / distribution_total, 1),
            ) for type_id, name, count in distribution],
            volunteer_activity=[VolunteerActivity(
                volunteer_id=volunteer_id, full_name=full_name, completed_count=count,
            ) for volunteer_id, full_name, count in activity],
        )


class ReportsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = AnalyticsRepository(session)

    async def generate(self, report_type: ReportType, date_from: date, date_to: date,
                       procedure_type_id: int | None, user_id: int) -> ReportResponse:
        report = await self.build(report_type, date_from, date_to, procedure_type_id)
        report.report_id = uuid4()
        report.generated_at = datetime.now(timezone.utc)
        await self.repository.save_snapshot(str(report.report_id), user_id, report.model_dump(mode="json"))
        await self.session.commit()
        return report

    async def build(self, report_type: ReportType, date_from: date, date_to: date,
                    procedure_type_id: int | None = None) -> ReportResponse:
        if date_from > date_to:
            raise HTTPException(422, {"message": "Дата начала не может быть позже даты окончания", "field": "date_to"})
        type_name = "Все услуги"
        if procedure_type_id is not None:
            procedure_type = await get_care_procedure_type(self.session, procedure_type_id)
            if procedure_type is None:
                raise HTTPException(422, {"message": "Тип услуги не найден", "field": "procedure_type_id"})
            type_name = procedure_type.name
        values = await self.repository.report_counts(date_from, date_to, procedure_type_id)
        monthly, distribution, activity = await self.repository.filtered_details(date_from, date_to, procedure_type_id)
        start_month = date_from.year * 12 + date_from.month - 1
        end_month = date_to.year * 12 + date_to.month - 1
        months = [date(value // 12, value % 12 + 1, 1) for value in range(start_month, end_month + 1)]
        title = {
            ReportType.ANIMAL_CARE: "Уход за животными",
            ReportType.VOLUNTEER_ACTIVITY: "Работа волонтёров",
            ReportType.PROCEDURE_EXECUTION: "Выполнение услуг",
        }[report_type]
        animals, workload, failed = await self.repository.report_details(date_from, date_to, procedure_type_id)
        values["failed"] = failed
        values["cancelled"] -= failed  # Explicit failures have their own report category.
        values["active_volunteers"] = sum(row[2] == "active" for row in workload)
        values["completed_minutes"] = sum(row[5] for row in workload)
        metrics = {
            ReportType.ANIMAL_CARE: (("animals", "Животных в назначениях"), ("total", "Всего услуг"),
                ("completed", "Выполнено"), ("failed", "Не выполнено")),
            ReportType.VOLUNTEER_ACTIVITY: (("volunteers", "Волонтёров в назначениях"),
                ("active_volunteers", "Активных среди участников"), ("total", "Всего назначений"),
                ("completed", "Выполнено"), ("completed_minutes", "Плановых минут выполненных услуг")),
            ReportType.PROCEDURE_EXECUTION: (("total", "Всего услуг"), ("completed", "Выполнено"),
                ("failed", "Не выполнено"), ("assigned", "Назначено"), ("cancelled", "Отменено"),
                ("overdue", "Просрочено")),
        }[report_type]
        return ReportResponse(
            report_type=report_type, title=title, date_from=date_from, date_to=date_to,
            metrics=[ReportMetric(key=key, label=label, value=values[key]) for key, label in metrics],
            procedure_type_id=procedure_type_id, procedure_type_name=type_name,
            executions_by_month=[] if report_type == ReportType.ANIMAL_CARE else [MonthlyExecution(month=month.strftime("%Y-%m"),
                label=f"{MONTH_LABELS[month.month - 1]} {month.year}", completed=monthly.get(month.strftime("%Y-%m"), 0)) for month in months],
            procedure_types=[] if report_type == ReportType.VOLUNTEER_ACTIVITY else [ProcedureTypeShare(procedure_type_id=type_id, name=name, count=count,
                percentage=round(count * 100 / values["total"], 1)) for type_id, name, count in distribution],
            volunteer_activity=[] if report_type != ReportType.VOLUNTEER_ACTIVITY else [VolunteerActivity(volunteer_id=volunteer_id, full_name=name, completed_count=count)
                for volunteer_id, name, count in activity],
            animal_activity=[dict(animal_id=row[0], name=row[1], total=row[2], completed=row[3])
                for row in animals] if report_type == ReportType.ANIMAL_CARE else [],
            volunteer_workload=[dict(volunteer_id=row[0], full_name=row[1], total=row[3], completed=row[4], completed_minutes=row[5])
                for row in workload] if report_type == ReportType.VOLUNTEER_ACTIVITY else [],
        )

    async def export_xlsx(
        self, report_type: ReportType, date_from: date, date_to: date, procedure_type_id: int | None = None,
        report_id: UUID | None = None, user_id: int | None = None,
    ) -> bytes:
        if report_id is not None:
            data = await self.repository.get_snapshot(str(report_id), user_id) if user_id is not None else None
            if data is None:
                raise HTTPException(404, "Сохранённый отчёт недоступен. Сформируйте отчёт заново")
            report = ReportResponse.model_validate(data)
            if (report.report_type, report.date_from, report.date_to, report.procedure_type_id) != (report_type, date_from, date_to, procedure_type_id):
                raise HTTPException(422, "Параметры выгрузки не совпадают со сформированным отчётом")
            return build_xlsx(report)
        return build_xlsx(await self.build(report_type, date_from, date_to, procedure_type_id))


def inline_cell(reference: str, value: str, style: int | None = None) -> str:
    value = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", value)
    style_attribute = f' s="{style}"' if style is not None else ""
    return (
        f'<c r="{reference}" t="inlineStr"{style_attribute}>'
        f'<is><t>{escape(value)}</t></is></c>'
    )


def number_cell(reference: str, value: int) -> str:
    return f'<c r="{reference}"><v>{value}</v></c>'


def build_xlsx(report: ReportResponse) -> bytes:
    rows = [
        f'<row r="1">{inline_cell("A1", report.title, 1)}</row>',
        f'<row r="2">{inline_cell("A2", f"Период: {report.date_from:%d.%m.%Y} — {report.date_to:%d.%m.%Y}")}</row>',
        f'<row r="3">{inline_cell("A3", "Услуга: " + report.procedure_type_name)}</row>',
        '<row r="4">' + inline_cell("A4", "Показатель", 1) + inline_cell("B4", "Значение", 1) + "</row>",
    ]
    for index, metric in enumerate(report.metrics, start=5):
        rows.append(
            f'<row r="{index}">{inline_cell(f"A{index}", metric.label)}'
            f'{number_cell(f"B{index}", metric.value)}</row>'
        )
    index = len(report.metrics) + 6
    sections = [
        ("Распределение по типам услуг", [(item.name, item.count) for item in report.procedure_types]),
        ("Выполнено по плановому месяцу", [(item.label, item.completed) for item in report.executions_by_month]),
        ("Активность волонтёров: выполнено", [(item.full_name, item.completed_count) for item in report.volunteer_activity]),
    ]
    sections.extend([
        ("Уход по животным: назначений", [(item.name, item.total) for item in report.animal_activity]),
        ("Нагрузка волонтёров: назначений", [(item.full_name, item.total) for item in report.volunteer_workload]),
        ("Плановых минут выполненных услуг", [(item.full_name, item.completed_minutes) for item in report.volunteer_workload]),
    ])
    for title, items in sections:
        if not items:
            continue
        rows.append(f'<row r="{index}">{inline_cell(f"A{index}", title, 1)}</row>')
        index += 1
        for label, value in items:
            rows.append(f'<row r="{index}">{inline_cell(f"A{index}", label)}{number_cell(f"B{index}", value)}</row>')
            index += 1
        index += 1
    rows.append(f'<row r="{index}">{inline_cell(f"A{index}", "Отбор по плановой дате, границы включены. Статусы — на момент формирования.")}</row>')
    sheet = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" state="frozen"/></sheetView></sheetViews>'
        '<cols><col min="1" max="1" width="75" customWidth="1"/>'
        '<col min="2" max="2" width="16" customWidth="1"/></cols>'
        f'<sheetData>{"".join(rows)}</sheetData><mergeCells count="3">'
        '<mergeCell ref="A1:B1"/><mergeCell ref="A2:B2"/><mergeCell ref="A3:B3"/></mergeCells>'
        '<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>'
        '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>'
    )
    files = {
        "[Content_Types].xml": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            '</Types>'
        ),
        "_rels/.rels": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '</Relationships>'
        ),
        "xl/workbook.xml": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Отчёт" sheetId="1" r:id="rId1"/></sheets></workbook>'
        ),
        "xl/_rels/workbook.xml.rels": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            '</Relationships>'
        ),
        "xl/styles.xml": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
            '<font><b/><sz val="13"/><name val="Calibri"/></font></fonts>'
            '<fills count="2"><fill><patternFill patternType="none"/></fill>'
            '<fill><patternFill patternType="gray125"/></fill></fills>'
            '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>'
            '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
            '</styleSheet>'
        ),
        "xl/worksheets/sheet1.xml": sheet,
    }
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        for path, content in files.items():
            archive.writestr(path, content.encode("utf-8"))
    return buffer.getvalue()
