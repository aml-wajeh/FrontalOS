"""
python -m db.seed
=====================
Idempotent demo-data bootstrap, run by entrypoint.sh on every container
start. Safe to run repeatedly: it checks for the seed doctor account first
and does nothing if it already exists, so a `docker compose restart`
never duplicates rows or clobbers data a user has since created.

Creates:
  - The 6 roles the platform recognises (auth/router.py's VALID_ROLES).
  - One demo user per portal role, all with password "Password123!".
  - THREE demo Patients (not one) linked across the demo parent, doctor,
    and school accounts, so Doctor/School dashboards render an actual
    patient LIST rather than a single-row placeholder, and Parent sees a
    dedicated child.
  - ~30 days of daily CheckIn history per patient (attention/hyperactivity
    trending toward improvement, sleep_hours, mood, notes) so
    GET /api/v1/analytics/progress|forecast|radar have enough real rows to
    aggregate instead of the "insufficient data" empty state.
  - A handful of AIPrediction rows per patient (tabular + mri, demo-mode
    labelled) so the Doctor/Patient AI results panels show history instead
    of "run your first prediction".
  - A couple of TimelineEvent and Goal rows per patient so the timeline /
    goals widgets aren't empty on first login.

Run manually (outside Docker) with:
    cd services/cortix-api && python -m db.seed
"""
import random
from datetime import datetime, timedelta

from core.security import hash_password
from database.models import Patient, Role, User, UserRole
from database.models.clinical import AIPrediction, CheckIn, Goal, TimelineEvent
from database.session import SessionLocal, init_db

random.seed(42)  # deterministic demo data across seed runs

VALID_ROLES = ["parent", "child", "doctor", "psychologist", "school", "admin"]

DEMO_PASSWORD = "Password123!"

DEMO_USERS = [
    # Primary demo login used throughout docs/RUNBOOK.md and the frontend
    # E2E fixtures — keep this account's email/name/role stable.
    {"email": "parent.demo@frontalos.dev", "full_name": "Dina Hassan", "role": "parent"},
    {"email": "patient.demo@frontalos.dev", "full_name": "Youssef Hassan", "role": "child"},
    {"email": "doctor.demo@frontalos.dev", "full_name": "Dr. Amir Farouk", "role": "doctor"},
    {"email": "school.demo@frontalos.dev", "full_name": "Nile STEM School", "role": "school"},
    # "admin" was removed from self-service registration (docs/AUDIT.md
    # §6.6) — this seeded account is now the only way to reach the admin
    # portal on a fresh install, until an existing admin promotes someone
    # else via PUT /api/v1/admin/users/{id}/role.
    {"email": "admin.demo@frontalos.dev", "full_name": "Platform Admin", "role": "admin"},
    # Two additional parent/child pairs, sharing the same demo doctor and
    # school, purely so the Doctor and School dashboards render an actual
    # patient LIST (roster/table UI) instead of a single row — that's a
    # meaningfully different screen state that a solo patient can't cover.
    {"email": "parent2.demo@frontalos.dev", "full_name": "Mona Rageh", "role": "parent"},
    {"email": "patient2.demo@frontalos.dev", "full_name": "Laila Rageh", "role": "child"},
    {"email": "parent3.demo@frontalos.dev", "full_name": "Karim Adel", "role": "parent"},
    {"email": "patient3.demo@frontalos.dev", "full_name": "Omar Adel", "role": "child"},
]

# (patient full name, age, gender, parent email, checkin baseline attention,
#  checkin baseline hyperactivity) — baselines differ per patient so the
# three dashboards don't all show identical numbers.
PATIENT_SPECS = [
    ("Youssef Hassan", 10, "male", "parent.demo@frontalos.dev", 4.5, 7.0),
    ("Laila Rageh", 8, "female", "parent2.demo@frontalos.dev", 5.5, 5.5),
    ("Omar Adel", 12, "male", "parent3.demo@frontalos.dev", 6.5, 4.0),
]

MOODS = ["happy", "calm", "neutral", "frustrated", "excited", "tired"]

CHECKIN_NOTES = [
    "Good focus during homework time today.",
    "Struggled to sit still during dinner.",
    "Great day at school, teacher gave positive feedback.",
    "Had trouble falling asleep last night.",
    "Finished morning routine without reminders.",
    "Needed several breaks during reading practice.",
    "Very engaged during the focus game session.",
    "A bit irritable after screen time.",
]

TIMELINE_EVENTS = [
    ("medical", "Quarterly check-up", "Reviewed medication dosage with pediatrician; no changes needed."),
    ("school", "Parent-teacher conference", "Teacher noted improved attention span in the classroom."),
    ("behavior", "New bedtime routine started", "Introduced a consistent wind-down routine to improve sleep."),
    ("milestone", "Completed 30-day check-in streak", "First full month of consistent daily check-ins."),
]

GOALS = [
    ("Improve morning routine independence", "Complete morning routine with fewer than 2 reminders.", "in_progress", 60.0),
    ("Increase homework focus sessions", "Sustain 20 minutes of focused homework time.", "in_progress", 40.0),
    ("Consistent sleep schedule", "Fall asleep within 30 minutes of bedtime, 5+ nights/week.", "completed", 100.0),
]


def _get_or_create_role(db, name: str) -> Role:
    role = db.query(Role).filter(Role.name == name).first()
    if role is None:
        role = Role(name=name, description=f"{name.capitalize()} portal access")
        db.add(role)
        db.flush()
    return role


def _get_or_create_user(db, email: str, full_name: str, role_name: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is not None:
        return user
    user = User(
        email=email,
        hashed_password=hash_password(DEMO_PASSWORD),
        full_name=full_name,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.flush()
    role = _get_or_create_role(db, role_name)
    db.add(UserRole(user_id=user.id, role_id=role.id))
    db.flush()
    return user


def seed() -> None:
    init_db()  # make sure every table exists before we touch any of them
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == "doctor.demo@frontalos.dev").first()
        if existing is not None:
            print("[seed] Demo data already present — skipping.")
            return

        for name in VALID_ROLES:
            _get_or_create_role(db, name)

        # DEMO_USERS has duplicate role keys (three "parent" / three "child"
        # rows) so it can't be collapsed into a single {role: user} dict like
        # the original version did — create every account explicitly and
        # keep a byemail lookup instead.
        users_by_email = {
            u["email"]: _get_or_create_user(db, u["email"], u["full_name"], u["role"]) for u in DEMO_USERS
        }
        doctor = users_by_email["doctor.demo@frontalos.dev"]
        school = users_by_email["school.demo@frontalos.dev"]

        today = datetime.utcnow()
        patients = []
        for name, age, gender, parent_email, attention_base, hyperactivity_base in PATIENT_SPECS:
            guardian = users_by_email[parent_email]
            patient = Patient(
                name=name,
                age=age,
                gender=gender,
                guardian_id=guardian.id,
                doctor_id=doctor.id,
                school_id=school.id,
            )
            db.add(patient)
            db.flush()  # need patient.id before attaching child rows
            patients.append(patient)

            # --- 30 days of daily check-ins, gently trending upward on
            # attention / downward on hyperactivity, so the analytics
            # endpoints (progress trend, forecast regression, radar) have
            # a real signal to compute instead of a flat or empty series.
            for day_offset in range(30, 0, -1):
                day = today - timedelta(days=day_offset)
                progress = (30 - day_offset) / 30.0  # 0 -> ~1 across the window
                noise_a = random.uniform(-0.8, 0.8)
                noise_h = random.uniform(-0.8, 0.8)
                attention = max(1.0, min(10.0, attention_base + progress * 2.5 + noise_a))
                hyperactivity = max(1.0, min(10.0, hyperactivity_base - progress * 2.0 + noise_h))
                db.add(
                    CheckIn(
                        patient_id=patient.id,
                        checkin_type="daily",
                        mood=random.choice(MOODS),
                        attention_score=round(attention, 1),
                        hyperactivity_score=round(hyperactivity, 1),
                        sleep_hours=round(random.uniform(6.5, 9.5), 1),
                        notes=random.choice(CHECKIN_NOTES),
                        created_at=day,
                    )
                )

            # --- a few AI prediction rows (both model types), spaced over
            # the same window, clearly demo-mode data.
            for i, day_offset in enumerate((21, 14, 7, 1)):
                day = today - timedelta(days=day_offset)
                model_type = "mri" if i % 2 == 0 else "tabular"
                confidence = round(random.uniform(0.62, 0.91), 2)
                db.add(
                    AIPrediction(
                        patient_id=patient.id,
                        model_type=model_type,
                        prediction_result={
                            "inference_mode": "demo",
                            "risk_level": random.choice(["low", "moderate", "elevated"]),
                            "focus_score": round(random.uniform(3.5, 8.5), 1),
                            "notes": "Seeded demo prediction — not a real clinical inference.",
                        },
                        confidence=confidence,
                        created_at=day,
                    )
                )

            # --- timeline + goals so those widgets aren't empty either.
            for i, (event_type, title, description) in enumerate(TIMELINE_EVENTS):
                db.add(
                    TimelineEvent(
                        patient_id=patient.id,
                        title=title,
                        description=description,
                        event_type=event_type,
                        timestamp=today - timedelta(days=25 - i * 6),
                    )
                )
            for title, description, status, progress_pct in GOALS:
                db.add(
                    Goal(
                        patient_id=patient.id,
                        title=title,
                        description=description,
                        target_date=(today + timedelta(days=30)).strftime("%Y-%m-%d"),
                        status=status,
                        progress_percentage=progress_pct,
                    )
                )

        db.commit()
        print(
            f"[seed] Created demo roles, {len(DEMO_USERS)} demo accounts, "
            f"{len(patients)} linked demo patients, and 30 days of check-in/"
            f"prediction/timeline/goal history per patient."
        )
        print("[seed] Demo login — email: doctor.demo@frontalos.dev / password: Password123!")
        print("[seed] (parent.demo@ / patient.demo@ / school.demo@ — same password)")
        print("[seed] Additional families — parent2.demo@ / patient2.demo@, parent3.demo@ / patient3.demo@")
        print("[seed] Admin portal — email: admin.demo@frontalos.dev / password: Password123!")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()