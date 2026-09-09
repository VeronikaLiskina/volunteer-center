from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas.analytics import AnalyticsResponse, ReportResponse, ReportType
from app.services.analytics import AnalyticsService, ReportsService

router = APIRouter(tags=["analytics"])
Session = Annotated[AsyncSession, Depends(get_session)]


@router.get("/analytics", response_model=AnalyticsResponse)
async def analytics(session: Session) -> AnalyticsResponse:
    return await AnalyticsService(session).dashboard()


@router.get("/reports", response_model=ReportResponse)
async def report(
    session: Session,
    report_type: ReportType,
    date_from: Annotated[date, Query()],
    date_to: Annotated[date, Query()],
) -> ReportResponse:
    if date_from > date_to:
        raise HTTPException(
            status_code=422,
            detail={"message": "Дата начала не может быть позже даты окончания", "field": "date_to"},
        )
    return await ReportsService(session).build(report_type, date_from, date_to)


@router.get("/reports/export.xlsx")
async def export_report(
    session: Session,
    report_type: ReportType,
    date_from: Annotated[date, Query()],
    date_to: Annotated[date, Query()],
) -> Response:
    if date_from > date_to:
        raise HTTPException(
            status_code=422,
            detail={"message": "Дата начала не может быть позже даты окончания", "field": "date_to"},
        )
    content = await ReportsService(session).export_xlsx(report_type, date_from, date_to)
    filename = f"lapka-report-{date_from.isoformat()}-{date_to.isoformat()}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
