"""
Administrative appointment categorization.

Classifies the *free-text reason* a patient gives when booking into one of
four scheduling categories. This is deliberately keyword/heuristic based
(not a diagnostic model) — it only helps front-desk/doctor triage which
kind of visit slot this is, e.g. so a 15-minute follow-up isn't booked in
a 40-minute new-consultation block.
"""
from app.models.models import AppointmentCategory

_FOLLOW_UP_KEYWORDS = ["follow up", "follow-up", "followup", "review", "re-check", "recheck", "second visit"]
_ROUTINE_KEYWORDS = ["checkup", "check-up", "check up", "routine", "annual", "physical", "screening", "wellness"]
_SPECIALIST_KEYWORDS = [
    "specialist", "referral", "cardiologist", "dermatologist", "orthopedic", "orthopaedic",
    "neurologist", "oncologist", "ent", "psychiatrist", "endocrinologist",
]


def categorize_reason(reason: str) -> tuple[AppointmentCategory, float]:
    """Return (category, confidence). Falls back to General Consultation."""
    text = (reason or "").lower().strip()
    if not text:
        return AppointmentCategory.general_consultation, 0.4

    for kw in _SPECIALIST_KEYWORDS:
        if kw in text:
            return AppointmentCategory.specialist_consultation, 0.8
    for kw in _FOLLOW_UP_KEYWORDS:
        if kw in text:
            return AppointmentCategory.follow_up, 0.85
    for kw in _ROUTINE_KEYWORDS:
        if kw in text:
            return AppointmentCategory.routine_checkup, 0.8

    return AppointmentCategory.general_consultation, 0.55
