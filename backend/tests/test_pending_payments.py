import unittest
import uuid
from test_db import get_test_connection

class TestPendingPayments(unittest.TestCase):

    def setUp(self):
        self.conn = get_test_connection()
        self.cursor = self.conn.cursor()

        # Clean tables before each test
        self.cursor.execute("DELETE FROM payments")
        self.cursor.execute("DELETE FROM expense_split")
        self.cursor.execute("DELETE FROM expenses")
        self.cursor.execute("DELETE FROM group_members")
        self.cursor.execute("DELETE FROM `groups`")
        self.cursor.execute("DELETE FROM users")

        # Add users
        self.cursor.execute("INSERT INTO users (username, password) VALUES ('mel', '123')")
        self.cursor.execute("INSERT INTO users (username, password) VALUES ('josh', '123')")

        # Create group
        self.group_id = str(uuid.uuid4())
        self.cursor.execute("INSERT INTO `groups` (id, name, created_by) VALUES (%s, %s, %s)",
                            (self.group_id, "Test Group", "mel"))

        # Add both users to group
        self.cursor.execute("INSERT INTO group_members (group_id, username) VALUES (%s, %s)", (self.group_id, "mel"))
        self.cursor.execute("INSERT INTO group_members (group_id, username) VALUES (%s, %s)", (self.group_id, "josh"))

        # Create an expense paid by "mel"
        self.expense_id = str(uuid.uuid4())
        self.cursor.execute("""
            INSERT INTO expenses (id, group_id, amount, category, date, time, paid_by)
            VALUES (%s, %s, %s, %s, CURDATE(), '12:00', 'mel')
        """, (self.expense_id, self.group_id, 100.00, "Dinner"))

        # Split: josh owes mel $50
        self.cursor.execute("""
            INSERT INTO expense_split (expense_id, username, split_amount)
            VALUES (%s, %s, %s)
        """, (self.expense_id, "josh", 50.00))

    def tearDown(self):
        self.cursor.close()
        self.conn.close()

    def test_pending_payments(self):
        """Ensure pending payments appear correctly."""
        self.cursor.execute("""
            SELECT es.split_amount 
            FROM expense_split es 
            WHERE es.username = 'josh'
        """)
        row = self.cursor.fetchone()

        self.assertIsNotNone(row)
        self.assertEqual(float(row[0]), 50.00)


if __name__ == "__main__":
    unittest.main()