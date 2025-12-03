import unittest
import uuid
from test_db import get_test_connection

class TestMakePayment(unittest.TestCase):

    def setUp(self):
        self.conn = get_test_connection()
        self.cursor = self.conn.cursor()

        # Clean DB
        self.cursor.execute("DELETE FROM payments")
        self.cursor.execute("DELETE FROM expense_split")
        self.cursor.execute("DELETE FROM expenses")
        self.cursor.execute("DELETE FROM group_members")
        self.cursor.execute("DELETE FROM `groups`")
        self.cursor.execute("DELETE FROM users")

        # Setup users
        self.cursor.execute("INSERT INTO users (username, password) VALUES ('mel', '123')")
        self.cursor.execute("INSERT INTO users (username, password) VALUES ('sam', '123')")

        # Group
        self.group_id = str(uuid.uuid4())
        self.cursor.execute("""
            INSERT INTO `groups` (id, name, created_by)
            VALUES (%s, 'PayGroup', 'mel')
        """, (self.group_id,))

        self.cursor.execute("INSERT INTO group_members (group_id, username) VALUES (%s, 'mel')", (self.group_id,))
        self.cursor.execute("INSERT INTO group_members (group_id, username) VALUES (%s, 'sam')", (self.group_id,))

        # Expense
        self.expense_id = str(uuid.uuid4())
        self.cursor.execute("""
            INSERT INTO expenses (id, group_id, amount, category, date, time, paid_by)
            VALUES (%s, %s, 40.00, 'Snacks', CURDATE(), '10:00', 'mel')
        """, (self.expense_id, self.group_id))

        # Split: sam owes 20
        self.cursor.execute("""
            INSERT INTO expense_split (expense_id, username, split_amount)
            VALUES (%s, 'sam', 20.00)
        """, (self.expense_id,))

    def tearDown(self):
        self.cursor.close()
        self.conn.close()

    def test_make_payment(self):
        """Simulate user sam paying mel."""

        # Insert payment
        self.cursor.execute("""
            INSERT INTO payments (expense_id, username, amount, payment_method)
            VALUES (%s, 'sam', 20.00, 'manual')
        """, (self.expense_id,))

        # Check payment exists
        self.cursor.execute("""
            SELECT amount FROM payments WHERE expense_id=%s AND username='sam'
        """, (self.expense_id,))
        row = self.cursor.fetchone()

        self.assertIsNotNone(row)
        self.assertEqual(float(row[0]), 20.00)


if __name__ == "__main__":
    unittest.main()