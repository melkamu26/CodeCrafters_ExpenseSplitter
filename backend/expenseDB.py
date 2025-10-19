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
