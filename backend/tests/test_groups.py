import unittest
from tests.base import FlaskTestCase, TEST_USER_A

class TestGroups(FlaskTestCase):

    def test_list_groups(self):
        # 1. Create a group
        create_resp = self.app.post("/api/groups/create", json={
            "groupName": "demo_group",
            "username": TEST_USER_A
        })
        self.assertEqual(create_resp.status_code, 201)
        group_data = create_resp.get_json()
        self.assertIn("id", group_data)
        created_group_id = group_data["id"]

        # 2. List groups for the user (GET + query param 'user')
        list_resp = self.app.get(
            "/api/groups/list",
            query_string={"user": TEST_USER_A}
        )
        self.assertEqual(list_resp.status_code, 200)
        groups = list_resp.get_json()

        # 3. Check that the created group is in the result
        group_ids = [g["id"] for g in groups]
        self.assertIn(created_group_id, group_ids)

if __name__ == "__main__":
    unittest.main()