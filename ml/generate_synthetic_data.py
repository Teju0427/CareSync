"""
Generates a synthetic historical-appointments dataset for training the
no-show prediction model. Synthetic data only — no real patient data is
used anywhere in this project.

Run:
    python generate_synthetic_data.py
Produces:
    synthetic_appointments.csv
"""
import numpy as np
import pandas as pd

RNG = np.random.default_rng(seed=42)
N_ROWS = 6000


def generate() -> pd.DataFrame:
    patient_age = RNG.integers(5, 90, N_ROWS)
    previous_appointments = RNG.poisson(6, N_ROWS)
    previous_no_shows = np.minimum(
        RNG.poisson(0.8, N_ROWS), previous_appointments
    )
    previous_cancellations = np.minimum(
        RNG.poisson(0.6, N_ROWS), previous_appointments - previous_no_shows
    ).clip(min=0)
    lead_time_days = RNG.integers(0, 60, N_ROWS)
    day_of_week = RNG.integers(0, 7, N_ROWS)  # 0=Mon ... 6=Sun
    appointment_hour = RNG.integers(8, 18, N_ROWS)

    # Underlying "true" probability used to synthesize the label —
    # deliberately noisy so the model isn't trivially perfect.
    no_show_rate_hist = previous_no_shows / np.maximum(previous_appointments, 1)
    logit = (
        -2.2
        + 3.0 * no_show_rate_hist
        + 0.02 * lead_time_days
        + 0.15 * (day_of_week == 0).astype(float)      # Monday effect
        + 0.10 * (day_of_week == 4).astype(float)      # Friday effect
        + 0.08 * ((appointment_hour < 9) | (appointment_hour > 16)).astype(float)
        + 0.10 * previous_cancellations
        - 0.01 * (patient_age - 40).clip(min=0) * 0.05  # older patients slightly more reliable
        + RNG.normal(0, 0.6, N_ROWS)                    # noise
    )
    probability = 1 / (1 + np.exp(-logit))
    no_show = RNG.binomial(1, probability)

    return pd.DataFrame({
        "patient_age": patient_age,
        "previous_appointments": previous_appointments,
        "previous_no_shows": previous_no_shows,
        "previous_cancellations": previous_cancellations,
        "lead_time_days": lead_time_days,
        "day_of_week": day_of_week,
        "appointment_hour": appointment_hour,
        "no_show": no_show,
    })


if __name__ == "__main__":
    df = generate()
    df.to_csv("synthetic_appointments.csv", index=False)
    print(f"Wrote {len(df)} rows to synthetic_appointments.csv")
    print(f"No-show rate in dataset: {df['no_show'].mean():.2%}")
