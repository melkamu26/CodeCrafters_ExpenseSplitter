# tests/base.py
import unittest
from werkzeug.security import generate_password_hash
from expenseDB import get_connection
from app import app

TEST_USER_A = "alexa"
TEST_PASS_A = "testpass"

class FlaskTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """
        Runs once before ALL tests in a file.
        Makes sure a test user exists in the database.
        """
        conn = get_connection()
        cur = conn.cursor()

        # Check if user already exists
        cur.execute("SELECT username FROM users WHERE username = %s", (TEST_USER_A,))
        row = cur.fetchone()

        if not row:
            print("Seeding test user 'alice'...")
            hashed = generate_password_hash(TEST_PASS_A)
            cur.execute(
                "INSERT INTO users (username, password) VALUES (%s, %s)",
                (TEST_USER_A, hashed)
            )
            conn.commit()

        cur.close()
        conn.close()

    def setUp(self):
        """
        Runs before EACH test.
        Creates a fresh Flask test client.
        """
        self.app = app.test_client()
        self.maxDiff = None
    
    def create_group(self, name="demo1", owner=TEST_USER_A):
        resp = self.app.post("/api/groups/create", json={
            "groupName": name,
            "username": owner
        })
        return resp