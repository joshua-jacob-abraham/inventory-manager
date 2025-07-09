from models import StockItem,ReturnedItem

def create_table(cursor,table_name : str):
    cursor.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            ITEM VARCHAR(20), 
            DESIGN_CODE VARCHAR(20), 
            SP_PER_ITEM INT, GST_RATE INT,
            HSNCODE VARCHAR(10) DEFAULT '62092000', TAXABLE_AMOUNT_PER_ITEM FLOAT, TAX_AMOUNT_PER_ITEM FLOAT,
            QTY INT, SIZE VARCHAR(4),
            PRIMARY KEY(item,design_code,sp_per_item,gst_rate,taxable_amount_per_item,tax_amount_per_item,qty,size)
        )
        """
    )
    
def insert_item(cursor,table_name : str, stock_item : StockItem):
	cursor.execute(
        f"""
        INSERT INTO {table_name} (item,design_code, sp_per_item, gst_rate, hsncode, taxable_amount_per_item, tax_amount_per_item, qty, size)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            stock_item.item,
            stock_item.design_code,
            stock_item.price,
            stock_item.gst_rate,
            stock_item.hsn_code,
            stock_item.taxable_amount,
            stock_item.tax_amount,
            stock_item.quantity,
            stock_item.size
        ),
	)

def insert_into_returned(cursor,table_name : str,store_key : str, returned_item : ReturnedItem):
    cursor.execute(
        f"""
        INSERT INTO {table_name} (item,design_code, sp_per_item, gst_rate, hsncode, taxable_amount_per_item, tax_amount_per_item, qty, size)
        SELECT item,design_code, sp_per_item, gst_rate, hsncode, taxable_amount_per_item, tax_amount_per_item, %s, size
        FROM {store_key} WHERE design_code = %s""",(returned_item.quantity, returned_item.design_code)
    )

def insert_into_records(cursor, storeName : str, action : str, date : str):
     cursor.execute(
            f"""
            INSERT INTO records (date,store,action) VALUES (%s, %s, %s)""", (date, storeName, action)
     )
