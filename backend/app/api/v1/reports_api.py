from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.models.square_report_model import SquareReport
from app.schemas.report_schema import ReportOut

router = APIRouter()

@router.get("/reports", response_model=list[ReportOut])
def get_reports(db: Session = Depends(get_db)):
    reports = db.query(SquareReport)\
        .options(joinedload(SquareReport.post))\
        .filter(SquareReport.handled == False)\
        .order_by(SquareReport.created_at.desc())\
        .all()
    return reports