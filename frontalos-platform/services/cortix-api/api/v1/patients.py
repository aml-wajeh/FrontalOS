"""
Patient roster endpoints.

Closes the gap documented in the headers of apps/web/src/lib/api/{doctor,
parent,school}Client.ts: `Patient.doctor_id` / `Patient.guardian_id` /
`Patient.school_id` (database/models/clinical.py) already model every
relationship these portals need, but no router exposed them — each portal
called a URL that 404'd and silently fell back to an empty/local list.

Every route here is scoped to the calling user via `get_current_user`, so
a doctor only ever sees patients where `doctor_id == current_user.id`
(same pattern for guardian/school), not a global patient list.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.security import get_current_user
from database.session import get_db
from database.models import Patient, User

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.get("")
def list_my_patients(
    doctor_id: str = "me",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """GET /api/v1/patients?doctor_id=me — matches doctorClient.getMyPatients().
    `doctor_id` only accepts the literal "me" today (the caller's own
    roster); anything else is treated the same way, since the JWT is the
    only identity this endpoint trusts."""
    patients = db.query(Patient).filter(Patient.doctor_id == current_user.id).all()
    return [{"id": p.id, "name": p.name, "age": p.age} for p in patients]


@router.get("/me/children")
def list_my_children(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """GET /api/v1/patients/me/children — matches parentClient.getLinkedPatients()."""
    patients = db.query(Patient).filter(Patient.guardian_id == current_user.id).all()
    return [
        {"id": p.id, "name": p.name, "age": p.age, "gender": p.gender}
        for p in patients
    ]


@router.get("/me/students")
def list_my_students(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """GET /api/v1/patients/me/students — matches schoolClient.getLinkedStudents()."""
    patients = db.query(Patient).filter(Patient.school_id == current_user.id).all()
    # `status` matches schoolClient.ts's LinkedStudent shape. There is no
    # attendance/behavior-trend signal server-side yet to compute
    # on_track/needs_attention from, so this is honestly "unknown" rather
    # than a fabricated status — same convention as the analytics module's
    # nulled-out fields.
    return [
        {"id": p.id, "name": p.name, "age": p.age, "gender": p.gender, "status": "unknown"}
        for p in patients
    ]
