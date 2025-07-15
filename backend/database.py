import mysql.connector as ms
from mysql.connector import Error

def get_db_connection(
		database : str = None
) :
	
		connection = ms.connect(
			host = "127.0.0.1",
			user = 'root',
			password = 'Lepaku@2027',
			port=3307 )
		
		cursor = connection.cursor()

		if database:
				cursor.execute(f"SHOW DATABASES LIKE '{database}'")
				result = cursor.fetchone()

				if not result:
					try:
						cursor.execute(f"CREATE DATABASE `{database}`")
						connection.commit()

						connection.database = database

						cursor.execute("""
							CREATE TABLE IF NOT EXISTS records (
								date DATE,
								store VARCHAR(100),
								action VARCHAR(50)
							);
						""")

						connection.commit()

						cursor.execute("""
                    CREATE TABLE IF NOT EXISTS Dresses (
                        design_id INT PRIMARY KEY AUTO_INCREMENT,
                        design_code VARCHAR(50) NOT NULL,
                        price DECIMAL(10,2) NOT NULL
                    );
                """)

						cursor.execute("""
								CREATE TABLE IF NOT EXISTS stores (
										store_id INT PRIMARY KEY AUTO_INCREMENT,
										store_name VARCHAR(100) UNIQUE NOT NULL
								);
						""")

						cursor.execute("""
								CREATE TABLE IF NOT EXISTS Dress_Stock (
										design_id INT NOT NULL,
										store_id INT NOT NULL,
										quantity INT NOT NULL,
										PRIMARY KEY (design_id, store_id),
										FOREIGN KEY (design_id) REFERENCES Dresses(design_id),
										FOREIGN KEY (store_id) REFERENCES stores(store_id)
								);
						""")

						connection.commit()

					except ms.Error as e:
						connection.close()
						raise Exception(f"Error creating database: {str(e)}")

		if database:
			connection.database = database

		return connection				
