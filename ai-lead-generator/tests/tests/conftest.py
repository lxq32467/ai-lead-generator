import pytest
from typing import Generator, Dict
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.config import settings

# 使用内存SQLite数据库进行测试
TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    """每个测试前创建表，测试后删除表"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client() -> Generator:
    """创建测试客户端"""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def test_user_data() -> Dict:
    """测试用户数据"""
    return {
        "email": "test@example.com",
        "password": "testpassword123",
        "name": "Test User"
    }


@pytest.fixture
def admin_user_data() -> Dict:
    """管理员用户数据"""
    return {
        "email": "admin@example.com",
        "password": "adminpassword123",
        "name": "Admin User"
    }


@pytest.fixture
def registered_user(client, test_user_data) -> Dict:
    """注册并返回用户信息和token"""
    response = client.post("/api/auth/register", json=test_user_data)
    assert response.status_code == 200
    data = response.json()
    return {
        "user": data["data"]["user"],
        "token": data["data"]["token"]
    }


@pytest.fixture
def registered_admin(client, admin_user_data) -> Dict:
    """注册管理员用户并设置角色为admin"""
    # 先注册
    response = client.post("/api/auth/register", json=admin_user_data)
    assert response.status_code == 200
    data = response.json()
    
    # 直接通过数据库将角色改为admin
    db = TestingSessionLocal()
    from app.models.user import User
    user = db.query(User).filter(User.email == admin_user_data["email"]).first()
    user.role = "admin"
    db.commit()
    db.close()
    
    return {
        "user": data["data"]["user"],
        "token": data["data"]["token"]
    }


@pytest.fixture
def auth_headers(registered_user) -> Dict:
    """认证请求头"""
    return {"Authorization": f"Bearer {registered_user['token']}"}


@pytest.fixture
def admin_headers(registered_admin) -> Dict:
    """管理员认证请求头"""
    return {"Authorization": f"Bearer {registered_admin['token']}"}


@pytest.fixture
def sample_lead_data() -> Dict:
    """示例线索数据"""
    return {
        "company_name": "Test Corp",
        "industry": "Technology",
        "contact_name": "John Doe",
        "contact_email": "john@testcorp.com",
        "contact_phone": "+1234567890",
        "source": "manual",
        "status": "new"
    }