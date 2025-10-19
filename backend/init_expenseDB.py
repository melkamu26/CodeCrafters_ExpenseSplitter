from expenseDB import get_connection

def create_tables():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            username VARCHAR(80) PRIMARY KEY,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS `groups` (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            created_by VARCHAR(80) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(username)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS group_members (
            id INT AUTO_INCREMENT PRIMARY KEY,
            group_id VARCHAR(36) NOT NULL,
            username VARCHAR(80) NOT NULL,
            FOREIGN KEY (group_id) REFERENCES `groups`(id),
            FOREIGN KEY (username) REFERENCES users(username)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS expenses (
            id VARCHAR(36) PRIMARY KEY,
            group_id VARCHAR(36) NOT NULL,
            amount FLOAT NOT NULL,
            category VARCHAR(50) NOT NULL,
            note VARCHAR(255),
            date VARCHAR(10) NOT NULL,
            time VARCHAR(5) NOT NULL,
            paid_by VARCHAR(80) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES `groups`(id),
            FOREIGN KEY (paid_by) REFERENCES users(username)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS expense_split (
        expense_id VARCHAR(36) NOT NULL,
        username VARCHAR(80) NOT NULL,
        split_amount FLOAT NOT NULL,
        PRIMARY KEY (expense_id, username),
        FOREIGN KEY (expense_id) REFERENCES expenses(id),
        FOREIGN KEY (username) REFERENCES users(username)
            )
    ''')
    
    conn.commit()
    cursor.close()
    conn.close()
    print("Tables created successfully!")

if __name__ == '__main__':
    create_tables()