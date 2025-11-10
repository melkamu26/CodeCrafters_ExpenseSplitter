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

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        expense_id VARCHAR(36) NOT NULL,
        username VARCHAR(80) NOT NULL,
        amount FLOAT NOT NULL,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        payment_method VARCHAR(50) DEFAULT 'manual',
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
        FOREIGN KEY (username) REFERENCES users(username),
        UNIQUE KEY unique_payment (expense_id, username)
                
            )
    ''')

#Add status column to expenses table to track if fully paid
    cursor.execute( '''
        ALTER TABLE expenses 
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' 
        COMMENT 'pending, partial, paid'
    ''')

    #Add index for faster queries
    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_expense_status ON expenses(status);
    CREATE INDEX IF NOT EXISTS idx_payment_expense ON payments(expense_id);
    ''')
    
    conn.commit()
    cursor.close()
    conn.close()
    print("Tables created successfully!")

if __name__ == '__main__':
    create_tables()