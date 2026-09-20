"""
Loads the trained no-show prediction model (trained offline by
ml/train_no_show_model.py) and exposes a simple predict() function.

If no trained model file is present (e.g. fresh clone, before running the
training script), falls back to a transparent rule-of-thumb heuristic so
the API endpoint still works end-to-end for local development/demo.
"""
import os
from pathlib import Path

import joblib
import numpy as np

_MODEL_PATH = Path(os.getenv("NO_SHOW_MODEL_PATH", Path(__file__).resolve().parent / "no_show_model.joblib"))

_FEATURE_ORDER = [
    "patient_age",
    "previous_appointments",
    "previous_no_shows",
    "previous_cancellations",
    "lead_time_days",
    "day_of_week",
    "appointment_hour",
]

_model = None
if _MODEL_PATH.exists():
    _model = joblib.load(_MODEL_PATH)


def _heuristic_probability(features: dict) -> float:
    """Transparent fallback used only when no trained model is bundled."""
    score = 0.1
    if features["previous_no_shows"] > 0:
        score += 0.15 * min(features["previous_no_shows"], 4)
    if features["previous_cancellations"] > 0:
        score += 0.05 * min(features["previous_cancellations"], 4)
    if features["lead_time_days"] > 14:
        score += 0.15
    if features["day_of_week"] in (0, 4):  # Monday / Friday
        score += 0.05
    if features["appointment_hour"] < 9 or features["appointment_hour"] > 17:
        score += 0.05
    prior_total = max(features["previous_appointments"], 1)
    no_show_rate = features["previous_no_shows"] / prior_total
    score += 0.3 * no_show_rate
    return float(min(max(score, 0.01), 0.99))


def predict_no_show_probability(features: dict) -> float:
    if _model is not None:
        x = np.array([[features[k] for k in _FEATURE_ORDER]])
        proba = _model.predict_proba(x)[0][1]
        return float(proba)
    return _heuristic_probability(features)


def risk_level(probability: float) -> str:
    if probability >= 0.6:
        return "High"
    if probability >= 0.3:
        return "Medium"
    return "Low"
