# backend/tests/test_login.py
import unittest
from tests.base import FlaskTestCase, TEST_USER_A, TEST_PASS_A

class TestLogin(FlaskTestCase):

    def test_login_success(self):
        """User should successfully login with correct credentials."""
        response = self.app.post("/api/users/login", json={
            "username": TEST_USER_A,
            "password": TEST_PASS_A
        })

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["message"], "Login successful")
        self.assertEqual(data["username"], TEST_USER_A)

    def test_login_wrong_password(self):
        """Should return 401 when password is wrong."""
        response = self.app.post("/api/users/login", json={
            "username": TEST_USER_A,
            "password": "wrongpass"
        })

        self.assertEqual(response.status_code, 401)
        data = response.get_json()
        self.assertIn("error", data)
        self.assertEqual(data["error"], "Invalid password")

    def test_login_missing_fields(self):
        """Should return 400 if any required field is missing."""
        response = self.app.post("/api/users/login", json={
            "username": TEST_USER_A
        })

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.get_json())

if __name__ == "__main__":
    unittest.main()