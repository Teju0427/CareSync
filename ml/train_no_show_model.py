"""
Trains the appointment no-show prediction model.

Pipeline:
  1. Load (or generate) synthetic historical appointment data
  2. Preprocess / train-test split
  3. Train a RandomForestClassifier (chosen for robustness to mixed-scale
     tabular features and built-in feature importance, without needing
     feature scaling)
  4. Evaluate: accuracy, precision, recall, F1, confusion matrix
  5. Save the trained model (joblib) for the API to load, and a
     confusion-matrix plot for the README/docs

This model predicts an ADMINISTRATIVE scheduling risk (probability a
patient misses their appointment) — it makes no medical claims and is
not evaluated or presented as clinically accurate.

Run:
    python train_no_show_model.py
"""
import os

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    ConfusionMatrixDisplay, accuracy_score, confusion_matrix, f1_score,
    precision_score, recall_score,
)
from sklearn.model_selection import train_test_split

from generate_synthetic_data import generate

FEATURES = [
    "patient_age",
    "previous_appointments",
    "previous_no_shows",
    "previous_cancellations",
    "lead_time_days",
    "day_of_week",
    "appointment_hour",
]
TARGET = "no_show"

MODEL_OUT = os.path.join(
    os.path.dirname(__file__), "..", "backend", "app", "ml", "no_show_model.joblib"
)


def main():
    csv_path = os.path.join(os.path.dirname(__file__), "synthetic_appointments.csv")
    if os.path.exists(csv_path):
        df = pd.read_csv(csv_path)
    else:
        df = generate()
        df.to_csv(csv_path, index=False)

    X = df[FEATURES]
    y = df[TARGET]

    # 80/20 train/test split, stratified so both sets keep the same no-show rate
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        min_samples_leaf=5,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred)

    print("=== No-show prediction model evaluation ===")
    print(f"Train rows: {len(X_train)}  Test rows: {len(X_test)}")
    print(f"Accuracy : {acc:.4f}")
    print(f"Precision: {prec:.4f}")
    print(f"Recall   : {rec:.4f}")
    print(f"F1-score : {f1:.4f}")
    print("Confusion matrix (rows=actual, cols=predicted):")
    print(cm)

    print("\nFeature importances:")
    for name, importance in sorted(zip(FEATURES, model.feature_importances_), key=lambda t: -t[1]):
        print(f"  {name:<24s} {importance:.4f}")

    # Save confusion matrix plot
    fig, ax = plt.subplots(figsize=(5, 4))
    ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=["Show", "No-show"]).plot(ax=ax, cmap="Blues")
    ax.set_title("No-show Prediction — Confusion Matrix")
    fig.tight_layout()
    plot_path = os.path.join(os.path.dirname(__file__), "confusion_matrix.png")
    fig.savefig(plot_path, dpi=150)
    print(f"\nSaved confusion matrix plot to {plot_path}")

    os.makedirs(os.path.dirname(MODEL_OUT), exist_ok=True)
    joblib.dump(model, MODEL_OUT)
    print(f"Saved trained model to {os.path.abspath(MODEL_OUT)}")

    print(
        "\nNOTE: This model estimates administrative no-show risk from scheduling "
        "patterns in synthetic data only. It is not medically validated and must "
        "never be used for clinical decision-making."
    )


if __name__ == "__main__":
    main()
