from datetime import date
from html import escape
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from sqlalchemy.ext.asyncio import AsyncSession

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
        self.repository = AnalyticsRepository(session)

    async def build(self, report_type: ReportType, date_from: date, date_to: date) -> ReportResponse:
        values = await self.repository.report_counts(date_from, date_to)
        definitions = {
            ReportType.ANIMAL_CARE: (
                "Уход за животными",
                (("animals", "Животных получили уход"), ("total", "Назначено процедур"), ("completed", "Выполнено процедур")),
            ),
            ReportType.VOLUNTEER_ACTIVITY: (
                "Работа волонтёров",
                (("volunteers", "Волонтёров участвовало"), ("total", "Назначено процедур"), ("completed", "Выполнено процедур")),
            ),
            ReportType.PROCEDURE_EXECUTION: (
                "Выполнение процедур",
                (("total", "Всего процедур"), ("completed", "Выполнено"), ("cancelled", "Отменено"), ("overdue", "Просрочено")),
            ),
        }
        title, metrics = definitions[report_type]
        return ReportResponse(
            report_type=report_type, title=title, date_from=date_from, date_to=date_to,
            metrics=[ReportMetric(key=key, label=label, value=values[key]) for key, label in metrics],
        )

    async def export_xlsx(
        self, report_type: ReportType, date_from: date, date_to: date,
    ) -> bytes:
        return build_xlsx(await self.build(report_type, date_from, date_to))


def inline_cell(reference: str, value: str, style: int | None = None) -> str:
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
        '<row r="4">' + inline_cell("A4", "Показатель", 1) + inline_cell("B4", "Значение", 1) + "</row>",
    ]
    for index, metric in enumerate(report.metrics, start=5):
        rows.append(
            f'<row r="{index}">{inline_cell(f"A{index}", metric.label)}'
            f'{number_cell(f"B{index}", metric.value)}</row>'
        )
    sheet = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<cols><col min="1" max="1" width="34" customWidth="1"/>'
        '<col min="2" max="2" width="16" customWidth="1"/></cols>'
        f'<sheetData>{"".join(rows)}</sheetData><mergeCells count="2">'
        '<mergeCell ref="A1:B1"/><mergeCell ref="A2:B2"/></mergeCells></worksheet>'
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
            '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
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
