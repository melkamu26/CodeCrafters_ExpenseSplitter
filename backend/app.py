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

# Initialize Vision client
def get_vision_client():
    key_path = os.getenv('GOOGLE_VISION_KEY_PATH', './google-vision-key.json')
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
        cursor.execute("SELECT username FROM users WHERE username = %s", (paid_by,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        # Create expense
        from datetime import datetime
        expense_id = str(uuid.uuid4())
        current_time = datetime.now().strftime('%H:%M')
        cursor.execute('''
            INSERT INTO expenses (id, group_id, amount, category, note, date, time, paid_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ''', (expense_id, group_id, amount, title, notes, date, current_time, paid_by))
        
        # Get all group members for splitting
        cursor.execute('''
            SELECT username FROM group_members WHERE group_id = %s
        ''', (group_id,))
        
        members = [row[0] for row in cursor.fetchall()]
        
        # Create split (equal split for now)
        if split_type == 'equal' and members:
            split_amount = amount / len(members)
            for member in members:
                cursor.execute('''
                    INSERT INTO expense_split (expense_id, username, split_amount)
                    VALUES (%s, %s, %s)
                ''', (expense_id, member, split_amount))
        
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
    # ==================== HEALTH CHECK ====================

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)