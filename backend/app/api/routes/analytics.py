from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.api.dependencies import CurrentUser
from app.schemas.analytics import AnalyticsResponse, ReportResponse, ReportType
from app.services.analytics import AnalyticsService, ReportsService

router = APIRouter(tags=["analytics"])
Session = Annotated[AsyncSession, Depends(get_session)]


@router.get("/analytics", response_model=AnalyticsResponse | ReportResponse)
async def analytics(session: Session, date_from: date | None = None, date_to: date | None = None,
                    procedure_type_id: Annotated[int | None, Query(gt=0)] = None):
    if date_from is not None or date_to is not None or procedure_type_id is not None:
        if date_from is None or date_to is None:
            raise HTTPException(422, "Укажите начало и конец периода")
        return await ReportsService(session).build(ReportType.PROCEDURE_EXECUTION, date_from, date_to, procedure_type_id)
    return await AnalyticsService(session).dashboard()


@router.get("/reports", response_model=ReportResponse)
async def report(
    session: Session,
    user: CurrentUser,
    report_type: ReportType,
    date_from: Annotated[date, Query()],
    date_to: Annotated[date, Query()],
    procedure_type_id: Annotated[int | None, Query(gt=0)] = None,
) -> ReportResponse:
    if date_from > date_to:
        raise HTTPException(
            status_code=422,
            detail={"message": "Дата начала не может быть позже даты окончания", "field": "date_to"},
        )
    return await ReportsService(session).generate(report_type, date_from, date_to, procedure_type_id, user.id)


@router.get("/reports/export.xlsx")
async def export_report(
    session: Session,
    user: CurrentUser,
    report_type: ReportType,
    date_from: Annotated[date, Query()],
    date_to: Annotated[date, Query()],
    procedure_type_id: Annotated[int | None, Query(gt=0)] = None,
    report_id: UUID | None = None,
) -> Response:
    if date_from > date_to:
        raise HTTPException(
            status_code=422,
            detail={"message": "Дата начала не может быть позже даты окончания", "field": "date_to"},
        )
    content = await ReportsService(session).export_xlsx(report_type, date_from, date_to, procedure_type_id, report_id, user.id)
    filename = f"lapka-report-{date_from.isoformat()}-{date_to.isoformat()}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
