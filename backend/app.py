from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from expenseDB import get_connection
import pymysql
import uuid

import os
from google.cloud import vision
import json
import base64
from datetime import datetime
import re

app = Flask(__name__)
CORS(app)


# ----------------------- Helpers -----------------------
def _safe_float(v, default=0.0):
    try:
        return float(v)
    except Exception:
        return float(default)
#----------------------- Google Vision Client -----------------------

# Initialize Vision client
def get_vision_client():
    key_json = os.getenv("GOOGLE_VISION_CREDENTIALS_JSON")
    if key_json:
        try:
            info = json.loads(key_json)
            return vision.ImageAnnotatorClient.from_service_account_info(info)
        except Exception as e:
            # If malformed JSON, log and continue to file fallback
            print("Error loading Vision credentials from env:", e)

    # 2) Fallback: use a file path (works locally)
    key_path = os.getenv("GOOGLE_VISION_KEY_PATH", "./google-vision-key.json")
    if not os.path.exists(key_path):
        print(f"Key file not found at: {key_path}")
        print(f"Current directory: {os.getcwd()}")
        print(f"Files in current directory: {os.listdir('.')}")
        raise FileNotFoundError(f"Google Vision key file not found at {key_path}")
    return vision.ImageAnnotatorClient.from_service_account_file(key_path)
# ==================== USER ENDPOINTS ====================

@app.route('/api/users/register', methods=['POST'])
def register_user():
    """Register a new user"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        hashed_password = generate_password_hash(password)
        cursor.execute(
            "INSERT INTO users (username, password) VALUES (%s, %s)",
            (username, hashed_password)
        )
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'User created', 'username': username}), 201
    except pymysql.err.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/login', methods=['POST'])
def login_user():
    """Login a user"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT password FROM users WHERE username = %s", (username,))
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not result:
            return jsonify({'error': 'User not found'}), 404
        
        if check_password_hash(result[0], password):
            return jsonify({'message': 'Login successful', 'username': username}), 200
        else:
            return jsonify({'error': 'Invalid password'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== GROUP ENDPOINTS ====================

@app.route('/api/groups/create', methods=['POST'])
def create_group():
    """Create a new group"""
    data = request.json
    group_name = data.get('groupName', '').strip()
    username = data.get('username', '').strip()
    
    if not group_name or not username:
        return jsonify({'error': 'Group name and username required'}), 400
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Verify user exists
        cursor.execute("SELECT username FROM users WHERE username = %s", (username,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        # Create group
        group_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO `groups` (id, name, created_by) VALUES (%s, %s, %s)",
            (group_id, group_name, username)
        )
        
        # Add creator as member
        cursor.execute(
            "INSERT INTO group_members (group_id, username) VALUES (%s, %s)",
            (group_id, username)
        )
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'message': 'Group created',
            'id': group_id,
            'name': group_name,
            'owner': username
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/groups/list', methods=['GET'])
def list_groups():
    """Get all groups for a user"""
    username = request.args.get('user', '').strip()
    
    if not username:
        return jsonify({'error': 'Username required'}), 400
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get groups where user is a member
        cursor.execute('''
            SELECT g.id, g.name, g.created_by as owner
            FROM `groups` g
            INNER JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.username = %s
            ORDER BY g.created_at DESC
        ''', (username,))
        
        groups = []
        for row in cursor.fetchall():
            group_id = row[0]
            
            # Fetch members for this group
            cursor.execute('''
                SELECT username FROM group_members WHERE group_id = %s
            ''', (group_id,))
            
            members = [member_row[0] for member_row in cursor.fetchall()]
            
            groups.append({
                'id': group_id,
                'name': row[1],
                'owner': row[2],
                'members': members
            })
        
        cursor.close()
        conn.close()
        
        return jsonify(groups), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    

@app.route('/api/groups/add-member', methods=['POST'])
def add_member_to_group():
    """Add a member to a group"""
    data = request.json
    group_id = data.get('groupId')
    member_name = data.get('memberName', '').strip()
    
    if not group_id or not member_name:
        return jsonify({'error': 'Group ID and member name required'}), 400
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Verify group exists
        cursor.execute("SELECT id FROM `groups` WHERE id = %s", (group_id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Group not found'}), 404
        
        # Verify user exists
        cursor.execute("SELECT username FROM users WHERE username = %s", (member_name,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        # Check if already a member
        cursor.execute(
            "SELECT id FROM group_members WHERE group_id = %s AND username = %s",
            (group_id, member_name)
        )
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'User is already a member'}), 409
        
        # Add member
        cursor.execute(
            "INSERT INTO group_members (group_id, username) VALUES (%s, %s)",
            (group_id, member_name)
        )
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'Member added', 'groupId': group_id, 'username': member_name}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/expenses/create', methods=['POST'])
def create_expense():
    """Create a new expense"""
    data = request.json
    group_id = data.get('groupId')
    title = data.get('title', '').strip()
    amount = data.get('amount')
    date = data.get('date', '').strip()
    paid_by = data.get('paidBy', '').strip()
    notes = data.get('notes', '').strip()
    split_type = data.get('split', {}).get('type', 'equal')
    
    # Validation
    if not group_id or not title or amount is None:
        return jsonify({'error': 'Group ID, title, and amount required'}), 400
    
    if amount <= 0:
        return jsonify({'error': 'Amount must be greater than 0'}), 400
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Verify group exists
        cursor.execute("SELECT id FROM `groups` WHERE id = %s", (group_id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Group not found'}), 404
        
        # Verify user (paid_by) exists
        print(f"Paid by: {paid_by}")
        cursor.execute("SELECT username FROM users WHERE username = %s", (paid_by,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': f'User {paid_by} not found' }), 404
        
        # Create expense
        from datetime import datetime
        expense_id = str(uuid.uuid4())
        current_time = datetime.now().strftime('%H:%M')
        cursor.execute('''
            INSERT INTO expenses (id, group_id, amount, category, note, date, time, paid_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ''', (expense_id, group_id, amount, title, notes, date, current_time, paid_by))
        
        # Get all group members for splitting
        cursor.execute("SELECT username FROM group_members WHERE group_id = %s", (group_id,))
        members = [row[0] for row in cursor.fetchall()]

        # Equal split among ALL members (including payer) for fairness,
        # but only OTHERS owe the payer, so don't create a row for the payer.
        if split_type == 'equal' and members:
            share = amount / len(members)               # everyone’s fair share
            for member in members:
                if member == paid_by:                   # payer does NOT owe
                    continue
                cursor.execute("""
                    INSERT INTO expense_split (expense_id, username, split_amount)
                    VALUES (%s, %s, %s)
                """, (expense_id, member, share))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'message': 'Expense created',
            'id': expense_id,
            'title': title,
            'amount': amount,
            'group_id': group_id
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/expenses/list', methods=['GET'])
def list_expenses():
    """Get expenses for a group"""
    group_id = request.args.get('groupId', '').strip()
    
    if not group_id:
        return jsonify({'error': 'Group ID required'}), 400
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, amount, category, note, date, paid_by
            FROM expenses
            WHERE group_id = %s
            ORDER BY date DESC, time DESC
        ''', (group_id,))
        
        expenses = []
        for row in cursor.fetchall():
            expenses.append({
                'id': row[0],
                'amount': row[1],
                'title': row[2],
                'note': row[3],
                'date': row[4],
                'paidBy': row[5]
            })
        
        cursor.close()
        conn.close()
        
        return jsonify(expenses), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/expenses/delete', methods=['POST'])
def delete_expense():
    """Delete an expense"""
    data = request.json
    expense_id = data.get('expenseId')
    
    if not expense_id:
        return jsonify({'error': 'Expense ID required'}), 400
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Delete from expense_split first (foreign key constraint)
        cursor.execute('DELETE FROM expense_split WHERE expense_id = %s', (expense_id,))
        
        # Delete from expenses
        cursor.execute('DELETE FROM expenses WHERE id = %s', (expense_id,))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'Expense deleted'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/expenses/recent', methods=['GET'])
def recent_expenses():
    """Get recent expenses for a user"""
    username = request.args.get('user', '').strip()
    
    if not username:
        return jsonify({'error': 'Username required'}), 400
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get expenses from groups where user is a member (last 5)
        cursor.execute('''
            SELECT e.id, e.amount, e.category, e.note, e.date, e.paid_by, g.name
            FROM expenses e
            JOIN `groups` g ON e.group_id = g.id
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.username = %s
            ORDER BY e.date DESC
            LIMIT 5
        ''', (username,))
        
        expenses = []
        for row in cursor.fetchall():
            expenses.append({
                'id': row[0],
                'amount': row[1],
                'title': row[2],
                'note': row[3],
                'date': row[4],
                'paidBy': row[5],
                'group': row[6]
            })
        
        cursor.close()
        conn.close()
        
        return jsonify(expenses), 200
        
    except Exception as e:
        print(f"Error in recent_expenses: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/receipts/process', methods=['POST'])
def process_receipt():
    """Process receipt image and extract info"""
    try:
        # Get image from request
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        image_file = request.files['image']
        
        if image_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Read image file
        image_data = image_file.read()
        
        # Call Google Vision API
        client = get_vision_client()
        image = vision.Image(content=image_data)
        response = client.text_detection(image=image)
        
        if not response.text_annotations:
            return jsonify({'error': 'No text found in image'}), 400
        
        # Extract full text
        full_text = response.text_annotations[0].description
        
        # Parse receipt with simple regex patterns
        receipt_data = parse_receipt(full_text)
        
        return jsonify(receipt_data), 200
        
    except Exception as e:
        print(f"Error processing receipt: {str(e)}")
        return jsonify({'error': str(e)}), 500

def parse_receipt(text):
    """Parse receipt text and extract amount, date, items"""
    
    # Extract amount (look for $ or common patterns)
    amount_match = re.search(r'(?:total|amount|sum)[\s:]*\$?([\d,]+\.?\d{0,2})', text, re.IGNORECASE)
    amount = float(amount_match.group(1).replace(',', '')) if amount_match else 0.0
    
    # If no total found, try to find any large currency amount
    if amount == 0:
        currency_matches = re.findall(r'\$?([\d,]+\.\d{2})', text)
        if currency_matches:
            amounts = [float(m.replace(',', '')) for m in currency_matches]
            amount = max(amounts)  # Assume largest is total
    
    # Extract date
    date_str = datetime.now().strftime('%Y-%m-%d')
    date_match = re.search(r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})', text)
    if date_match:
        day, month, year = date_match.groups()
        if len(year) == 2:
            year = '20' + year
        try:
            date_obj = datetime(int(year), int(month), int(day))
            date_str = date_obj.strftime('%Y-%m-%d')
        except:
            pass
    
    # Extract category/merchant name (usually at top of receipt)
    lines = text.split('\n')
    category = 'Purchase'
    for line in lines[:5]:  # Check first 5 lines
        line = line.strip()
        if len(line) > 3 and len(line) < 50:
            category = line
            break
    
    # Extract line items
    line_items = extract_line_items(text)
    
    return {
        'amount': round(amount, 2),
        'date': date_str,
        'category': category[:50],  # Limit length
        'lineItems': line_items,
        'rawText': text[:500]  # First 500 chars for debugging
    }

def extract_line_items(text):
    """Extract line items from receipt text"""
    items = []
    
    # Pattern: item name followed by price
    # Looks for: "Item Name    $12.99" or "Item Name 12.99"
    pattern = r'([a-zA-Z\s\-]{3,}?)\s{2,}(\$?)(\d+\.?\d{0,2})'
    matches = re.findall(pattern, text)
    
    for match in matches:
        item_name = match[0].strip()
        price = float(match[2])
        
        # Filter out common receipt artifacts
        if price > 0 and len(item_name) > 2 and price < 10000:
            items.append({
                'name': item_name[:50],
                'price': round(price, 2)
            })
    
    # Remove duplicates and limit to 20 items
    seen = set()
    unique_items = []
    for item in items:
        key = (item['name'], item['price'])
        if key not in seen:
            seen.add(key)
            unique_items.append(item)
    
    return unique_items[:20]

#=================Analytics Endpoint====================

@app.route('/api/analytics/overview', methods=['GET'])
def analytics_overview():
    user = (request.args.get('user') or '').strip()
    if not user:
        return jsonify({'error': 'Username required'}), 400
    try:
        conn = get_connection(); cur = conn.cursor()

        # total spend across groups the user is in
        cur.execute("""
            SELECT COALESCE(SUM(e.amount),0)
            FROM expenses e
            JOIN `groups` g ON g.id = e.group_id
            JOIN group_members gm ON gm.group_id = g.id
            WHERE gm.username = %s
        """, (user,))
        total_spend = float(cur.fetchone()[0] or 0)

        # spend by group
        cur.execute("""
            SELECT g.name, COALESCE(SUM(e.amount),0) AS total
            FROM expenses e
            JOIN `groups` g ON g.id = e.group_id
            JOIN group_members gm ON gm.group_id = g.id
            WHERE gm.username = %s
            GROUP BY g.name
            ORDER BY total DESC
        """, (user,))
        by_group = [{'group': r[0], 'total': float(r[1])} for r in cur.fetchall()]

        # spend by payer (who paid)
        cur.execute("""
            SELECT e.paid_by, COALESCE(SUM(e.amount),0) AS total
            FROM expenses e
            JOIN `groups` g ON g.id = e.group_id
            JOIN group_members gm ON gm.group_id = g.id
            WHERE gm.username = %s
            GROUP BY e.paid_by
            ORDER BY total DESC
        """, (user,))
        by_payer = [{'payer': r[0], 'total': float(r[1])} for r in cur.fetchall()]

        # monthly spend (last 6 months)
        cur.execute("""
            SELECT DATE_FORMAT(e.date, '%%Y-%%m') AS ym, COALESCE(SUM(e.amount),0) AS total
            FROM expenses e
            JOIN `groups` g ON g.id = e.group_id
            JOIN group_members gm ON gm.group_id = g.id
            WHERE gm.username = %s
            GROUP BY ym
            ORDER BY ym DESC
            LIMIT 6
        """, (user,))
        monthly_raw = [{'month': r[0], 'total': float(r[1])} for r in cur.fetchall()]
        monthly = list(reversed(monthly_raw))  # oldest -> newest for chart

        cur.close(); conn.close()
        return jsonify({
            'totals': {'totalSpend': total_spend},
            'byGroup': by_group,
            'byPayer': by_payer,
            'monthly': monthly
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== PAYMENT ENDPOINTS ====================

@app.route('/api/payments/pending', methods=['GET'])
def get_pending_payments():
    """Get all pending payments for a user"""
    username = request.args.get('user')
    
    if not username:
        return jsonify({'error': 'Username required'}), 400
    
    try:
        conn = get_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        
        # Get all unpaid splits for the user
        cursor.execute("""
            SELECT 
                e.id as expense_id,
                e.category as title,
                e.date,
                e.paid_by,
                e.amount as total_amount,
                es.split_amount as amount_owed,
                g.name as group_name,
                g.id as group_id,
                CASE 
                    WHEN p.id IS NOT NULL THEN 'paid'
                    ELSE 'pending'
                END as payment_status
            FROM expense_split es
            JOIN expenses e ON es.expense_id = e.id
            JOIN `groups` g ON e.group_id = g.id
            LEFT JOIN payments p ON es.expense_id = p.expense_id AND es.username = p.username
            WHERE es.username = %s
                AND e.paid_by <> %s
            ORDER BY e.date DESC
        """, (username,username))
        
        all_payments = cursor.fetchall()
        
        # Separate pending and paid
        pending = [p for p in all_payments if p['payment_status'] == 'pending']
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'pending': pending,
            'total_owed': sum(p['amount_owed'] for p in pending)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/payments/pay', methods=['POST'])
def make_payment():
    """Mark a payment as paid"""
    data = request.json
    expense_id = data.get('expenseId')
    username = data.get('username')
    amount = data.get('amount')
    
    if not all([expense_id, username, amount]):
        return jsonify({'error': 'Missing required fields'}), 400
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Check if already paid
        cursor.execute("""
            SELECT id FROM payments 
            WHERE expense_id = %s AND username = %s
        """, (expense_id, username))
        
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Already paid'}), 400
        
        # Record payment
        cursor.execute("""
            INSERT INTO payments (expense_id, username, amount, payment_method)
            VALUES (%s, %s, %s, 'manual')
        """, (expense_id, username, amount))
        
        # Check if all members have paid
        cursor.execute("""
            SELECT COUNT(DISTINCT es.username) as total_members,
                   COUNT(DISTINCT p.username) as paid_members
            FROM expense_split es
            LEFT JOIN payments p ON es.expense_id = p.expense_id AND es.username = p.username
            WHERE es.expense_id = %s
        """, (expense_id,))
        
        result = cursor.fetchone()
        if result and result[0] == result[1]:
            # All members paid - update expense status
            cursor.execute("""
                UPDATE expenses SET status = 'paid' WHERE id = %s
            """, (expense_id,))
        else:
            # Partial payment
            cursor.execute("""
                UPDATE expenses SET status = 'partial' WHERE id = %s AND status = 'pending'
            """, (expense_id,))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'Payment recorded'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/payments/history', methods=['GET'])
def payment_history():
    """Get payment history for a user"""
    username = request.args.get('user')
    
    if not username:
        return jsonify({'error': 'Username required'}), 400
    
    try:
        conn = get_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        
        cursor.execute("""
            SELECT 
                p.id,
                p.amount,
                p.paid_at,
                p.payment_method,
                e.category as expense_title,
                g.name as group_name
            FROM payments p
            JOIN expenses e ON p.expense_id = e.id
            JOIN `groups` g ON e.group_id = g.id
            WHERE p.username = %s
            ORDER BY p.paid_at DESC
            LIMIT 20
        """, (username,))
        
        payments = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return jsonify(payments), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    

# ----------------------- Settlement Suggestions -----------------------
@app.route("/api/settlements/suggest", methods=["GET"])
def settlements_suggest():
    """
    If groupId is provided -> return minimal cash transfers for that group.
    Else if user is provided -> return suggestions per group the user belongs to.
    """
    gid = (request.args.get("groupId") or "").strip()
    user = (request.args.get("user") or "").strip()

    if not gid and not user:
        return jsonify({"error": "Provide groupId or user"}), 400

    try:
        conn = get_connection()
        cur = conn.cursor()

        def balances_for_group(group_id):
            # Build balances dict: positive means the person should RECEIVE, negative means they OWE.
            bal = {}

            # Who paid how much total in the group
            cur.execute("SELECT e.paid_by, COALESCE(SUM(e.amount),0) FROM expenses e WHERE e.group_id = %s GROUP BY e.paid_by", (group_id,))
            for payer, total_paid in cur.fetchall():
                bal[payer] = bal.get(payer, 0.0) + _safe_float(total_paid)

            # How much each user owes (expense_split rows)
            cur.execute(
                """
                SELECT es.username, COALESCE(SUM(es.split_amount),0)
                FROM expense_split es
                JOIN expenses e ON es.expense_id = e.id
                WHERE e.group_id = %s
                GROUP BY es.username
                """,
                (group_id,),
            )
            for uname, owed in cur.fetchall():
                bal[uname] = bal.get(uname, 0.0) - _safe_float(owed)

            # Greedy settle: payers positive, debtors negative
            creditors = [{"name": n, "amt": round(v, 2)} for n, v in bal.items() if v > 0.005]
            debtors = [{"name": n, "amt": round(-v, 2)} for n, v in bal.items() if v < -0.005]
            creditors.sort(key=lambda x: -x["amt"])
            debtors.sort(key=lambda x: -x["amt"])

            transfers = []
            i, j = 0, 0
            while i < len(debtors) and j < len(creditors):
                pay = min(debtors[i]["amt"], creditors[j]["amt"])
                if pay > 0:
                    transfers.append({"from": debtors[i]["name"], "to": creditors[j]["name"], "amount": round(pay, 2)})
                    debtors[i]["amt"] -= pay
                    creditors[j]["amt"] -= pay
                if debtors[i]["amt"] <= 0.005:
                    i += 1
                if creditors[j]["amt"] <= 0.005:
                    j += 1

            group_name = None
            cur.execute("SELECT name FROM `groups` WHERE id = %s", (group_id,))
            row = cur.fetchone()
            if row:
                group_name = row[0]

            return {"groupId": group_id, "groupName": group_name, "transfers": transfers}

        if gid:
            result = balances_for_group(gid)
            cur.close()
            conn.close()
            return jsonify(result), 200

        # user view: all groups the user belongs to
        cur.execute("SELECT g.id FROM `groups` g JOIN group_members gm ON g.id = gm.group_id WHERE gm.username = %s", (user,))
        group_ids = [r[0] for r in cur.fetchall()]
        results = [balances_for_group(gx) for gx in group_ids]
        cur.close()
        conn.close()
        return jsonify(results), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ----------------------- Summary (overview + AI) -----------------------
import os, json, requests

# ===== Summary helpers =====
def _summary_data_for_user(user):
    conn = get_connection(); cur = conn.cursor()
    # totals
    cur.execute("""
        SELECT COALESCE(SUM(e.amount),0)
        FROM expenses e
        JOIN `groups` g ON g.id = e.group_id
        JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.username = %s
    """, (user,))
    total = float(cur.fetchone()[0] or 0)

    # by group
    cur.execute("""
        SELECT g.name, COALESCE(SUM(e.amount),0) AS total
        FROM expenses e
        JOIN `groups` g ON g.id = e.group_id
        JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.username = %s
        GROUP BY g.name
        ORDER BY total DESC
    """, (user,))
    by_group = [{'group': r[0], 'total': float(r[1])} for r in cur.fetchall()]

    # recent 10
    cur.execute("""
        SELECT e.category, e.amount, e.date, g.name
        FROM expenses e
        JOIN `groups` g ON g.id = e.group_id
        JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.username = %s
        ORDER BY e.date DESC, e.time DESC
        LIMIT 10
    """, (user,))
    recent = [{'title': r[0], 'amount': float(r[1]), 'date': str(r[2]), 'group': r[3]} for r in cur.fetchall()]

    cur.close(); conn.close()

    quick = {}
    if recent:
        avg = sum(x['amount'] for x in recent) / len(recent)
        quick = {
            'countRecent': len(recent),
            'avgRecent': round(avg, 2),
            'topGroup': by_group[0]['group'] if by_group else None
        }

    return {
        'total': total,
        'byGroup': by_group,
        'recent': recent,
        'quick': quick
    }

@app.route('/api/summary', methods=['GET'])
def summary_plain():
    user = (request.args.get('user') or '').strip()
    if not user:
        return jsonify({'error': 'Username required'}), 400
    try:
        data = _summary_data_for_user(user)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/summary/ai', methods=['GET'])
def summary_ai():
    user = (request.args.get('user') or '').strip()
    if not user:
        return jsonify({'error': 'Username required'}), 400

    try:
        ctx = _summary_data_for_user(user)
    except Exception as e:
        return jsonify({'error': f'Failed to load summary data: {e}'}), 500

    # If there is no data, return a friendly message
    if ctx.get('total', 0) <= 0 and not ctx.get('recent'):
        return jsonify({'text': 'No expenses yet. Add a few and I will summarize trends for you.'}), 200

    # Build a compact textual context for the LLM
    try:
        by_group_str = ", ".join(f"{g['group']}: ${g['total']:.2f}" for g in ctx.get('byGroup', [])[:5]) or "none"
        recent_lines = []
        for r in ctx.get('recent', [])[:10]:
            recent_lines.append(f"{r['date']} • ${r['amount']:.2f} • {r['title']} • {r['group']}")
        recent_str = "\n".join(recent_lines) or "none"
        quick = ctx.get('quick', {})
        quick_str = f"countRecent={quick.get('countRecent', 0)}, avgRecent=${quick.get('avgRecent', 0):.2f}, topGroup={quick.get('topGroup')}"
        plain_context = (
            f"User: {user}\n"
            f"Total spending: ${ctx.get('total', 0):.2f}\n"
            f"By group: {by_group_str}\n"
            f"Quick: {quick_str}\n"
            f"Recent:\n{recent_str}\n"
        )
    except Exception as e:
        return jsonify({'error': f'Failed to build AI context: {e}'}), 500

    api_key = os.getenv('OPENAI_API_KEY', '').strip()
    if not api_key:
        return jsonify({'error': 'OPENAI_API_KEY not set on server'}), 500

    # Call OpenAI chat completions with defensive error handling
    try:
        url = 'https://api.openai.com/v1/chat/completions'
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        body = {
            'model': 'gpt-4o-mini',
            'messages': [
                {'role': 'system', 'content': 'You are a concise financial analyst for a bill-splitting app. Output 3 to 6 short bullets. Use simple language. No emojis.'},
                {'role': 'user', 'content': f"Summarize this user's spending and give quick suggestions.\n\nContext:\n{plain_context}"}
            ],
            'temperature': 0.4,
            'max_tokens': 250
        }
        resp = requests.post(url, headers=headers, json=body, timeout=30)
        if resp.status_code != 200:
            # return the error so the UI can show it
            return jsonify({'error': f'OpenAI error {resp.status_code}', 'details': resp.text[:500]}), 502
        data = resp.json()
        text = data.get('choices', [{}])[0].get('message', {}).get('content', '').strip()
        if not text:
            return jsonify({'error': 'OpenAI returned empty content'}), 502
        return jsonify({'text': text}), 200
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'OpenAI request failed: {e}'}), 502
    except Exception as e:
        return jsonify({'error': f'Unexpected AI error: {e}'}), 500



    # ==================== HEALTH CHECK ====================

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)