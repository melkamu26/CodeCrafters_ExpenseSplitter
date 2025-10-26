from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from expenseDB import get_connection
import pymysql
import uuid

app = Flask(__name__)
CORS(app)

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
            groups.append({
                'id': row[0],
                'name': row[1],
                'owner': row[2]
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
    # ==================== HEALTH CHECK ====================

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)