import pymysql

db_host = 'expensetrackerdb.cha46q8mu6lt.us-east-2.rds.amazonaws.com'
db_user = 'admin'
db_password = 'Chirag#13'
db_name = 'expense_tracker'


def get_connection():
    connection = pymysql.connect(
        host=db_host,
        user=db_user,
        password=db_password,
        database=db_name
                )
    return connection

'''# expenseDB.py
import os
import pymysql

db_host = os.getenv('DB_HOST', 'localhost')
db_user = os.getenv('DB_USER', 'exp_test_user')
db_password = os.getenv('DB_PASSWORD', 'exp_test_pass')
db_name = os.getenv('DB_NAME', 'expense_test')

def get_connection():
    connection = pymysql.connect(
        host=db_host,
        user=db_user,
        password=db_password,
        database=db_name
    )
    return connection
'''