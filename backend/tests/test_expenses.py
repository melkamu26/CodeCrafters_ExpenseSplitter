import unittest
from tests.base import FlaskTestCase, TEST_USER_A
from expenseDB import get_connection

class TestExpenses(FlaskTestCase):

    def test_create_expense_single_member(self):
        """
        1. Create a group with TEST_USER_A
        2. Create an expense in that group
        3. Verify expense is created
        4. Verify no split rows (because no one else owes TEST_USER_A)
        """

        # 1. Create a group (helper from base.py)
        group_resp = self.create_group(name="exp_test_group")
        self.assertEqual(group_resp.status_code, 201)
        group_data = group_resp.get_json()
        group_id = group_data["id"]

        # 2. Create an expense (match backend field names!)
        expense_resp = self.app.post("/api/expenses/create", json={
            "groupId": group_id,
            "title": "Test Dinner",
            "amount": 40.0,
            "date": "2025-01-01",
            "paidBy": TEST_USER_A,
            "notes": "unit test expense",
            "split": {"type": "equal"}
        })

        self.assertEqual(expense_resp.status_code, 201)
        exp_data = expense_resp.get_json()

        # Response sanity checks
        self.assertIn("id", exp_data)
        self.assertEqual(exp_data["title"], "Test Dinner")
        self.assertAlmostEqual(exp_data["amount"], 40.0, places=2)
        self.assertEqual(exp_data["group_id"], group_id)

        expense_id = exp_data["id"]

        # 3. Check directly in DB that expense exists
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            "SELECT amount, category, paid_by FROM expenses WHERE id = %s",
            (expense_id,)
        )
        row = cur.fetchone()
        self.assertIsNotNone(row)
        db_amount, db_title, db_paid_by = row
        self.assertAlmostEqual(float(db_amount), 40.0, places=2)
        self.assertEqual(db_title, "Test Dinner")
        self.assertEqual(db_paid_by, TEST_USER_A)

        # 4. With only ONE member in group, no one owes anything,
        #    so expense_split should have 0 rows for this expense.
        cur.execute(
            "SELECT username, split_amount FROM expense_split WHERE expense_id = %s",
            (expense_id,)
        )
        splits = cur.fetchall()
        self.assertEqual(len(splits), 0)

        cur.close()
        conn.close()

if __name__ == "__main__":
    unittest.main()