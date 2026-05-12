import pytest
from fastapi.testclient import TestClient


class TestUserRegistration:
    """用户注册测试"""
    
    def test_register_success(self, client, test_user_data):
        """测试成功注册"""
        response = client.post("/api/auth/register", json=test_user_data)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["message"] == "注册成功"
        assert "user" in data["data"]
        assert "token" in data["data"]
        assert data["data"]["user"]["email"] == test_user_data["email"]
        assert data["data"]["user"]["name"] == test_user_data["name"]
        assert data["data"]["user"]["role"] == "salesperson"
        assert "password" not in data["data"]["user"]
    
    def test_register_duplicate_email(self, client, test_user_data):
        """测试使用已存在的邮箱注册"""
        # 第一次注册
        client.post("/api/auth/register", json=test_user_data)
        # 第二次注册
        response = client.post("/api/auth/register", json=test_user_data)
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "已存在" in data["message"] or "already exists" in data["message"].lower()
    
    def test_register_invalid_email(self, client):
        """测试无效邮箱格式"""
        response = client.post("/api/auth/register", json={
            "email": "invalid-email",
            "password": "testpassword123",
            "name": "Test User"
        })
        assert response.status_code == 422
    
    def test_register_short_password(self, client):
        """测试密码太短"""
        response = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "password": "short",
            "name": "Test User"
        })
        assert response.status_code == 422
    
    def test_register_empty_name(self, client):
        """测试空名称"""
        response = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "password": "testpassword123",
            "name": ""
        })
        assert response.status_code == 422


class TestUserLogin:
    """用户登录测试"""
    
    def test_login_success(self, client, test_user_data):
        """测试成功登录"""
        # 先注册
        client.post("/api/auth/register", json=test_user_data)
        # 登录
        response = client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["message"] == "登录成功"
        assert "token" in data["data"]
        assert data["data"]["user"]["email"] == test_user_data["email"]
    
    def test_login_wrong_password(self, client, test_user_data):
        """测试错误密码登录"""
        client.post("/api/auth/register", json=test_user_data)
        response = client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
    
    def test_login_nonexistent_user(self, client):
        """测试不存在的用户登录"""
        response = client.post("/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "testpassword123"
        })
        assert response.status_code == 401
    
    def test_login_inactive_user(self, client, test_user_data):
        """测试被禁用的用户登录"""
        # 注册用户
        client.post("/api/auth/register", json=test_user_data)
        
        # 直接通过数据库禁用用户
        from app.database import TestingSessionLocal
        from app.models.user import User
        db = TestingSessionLocal()
        user = db.query(User).filter(User.email == test_user_data["email"]).first()
        user.is_active = False
        db.commit()
        db.close()
        
        # 尝试登录
        response = client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        assert response.status_code == 401


class TestGetCurrentUser:
    """获取当前用户测试"""
    
    def test_get_me_success(self, client, registered_user):
        """测试成功获取当前用户"""
        headers = {"Authorization": f"Bearer {registered_user['token']}"}
        response = client.get("/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["user"]["email"] == registered_user["user"]["email"]
    
    def test_get_me_no_token(self, client):
        """测试未认证获取当前用户"""
        response = client.get("/api/auth/me")
        assert response.status_code == 401
    
    def test_get_me_invalid_token(self, client):
        """测试无效token"""
        headers = {"Authorization": "Bearer invalid_token"}
        response = client.get("/api/auth/me", headers=headers)
        assert response.status_code == 401
    
    def test_get_me_expired_token(self, client, registered_user):
        """测试过期token"""
        # 使用一个明显过期的token
        headers = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxNTE2MjM5MDIyfQ.5s"}
        response = client.get("/api/auth/me", headers=headers)
        assert response.status_code == 401