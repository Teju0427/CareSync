import os

os.environ["DATABASE_URL"] = "sqlite:///./test_caresync.db"
os.environ["JWT_SECRET_KEY"] = "test-secret"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base, get_db
from app.main import app

TEST_DB_URL = "sqlite:///./test_caresync.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def patient_token(client):
    client.post("/auth/register", json={
        "email": "patient@example.com", "password": "password123",
        "full_name": "Test Patient", "role": "patient",
    })
    resp = client.post("/auth/login", json={"email": "patient@example.com", "password": "password123"})
    return resp.json()["access_token"]


@pytest.fixture
def admin_token(client, db_session_direct):
    """Admins can't self-register, so insert one directly via the ORM."""
    from app.core.security import hash_password
    from app.models.models import User, UserRole

    user = User(email="admin@example.com", hashed_password=hash_password("adminpass123"),
                full_name="Admin User", role=UserRole.admin)
    db_session_direct.add(user)
    db_session_direct.commit()

    resp = client.post("/auth/login", json={"email": "admin@example.com", "password": "adminpass123"})
    return resp.json()["access_token"]


@pytest.fixture
def db_session_direct():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
