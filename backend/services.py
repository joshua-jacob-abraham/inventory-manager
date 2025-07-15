from crud import *
from models import StockItem,ReturnedItem
import mysql.connector as ms
from datetime import datetime
from fastapi import HTTPException
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib import colors
import re

temp_stock_data = {}

def is_valid_name(name: str) -> bool:
    return bool(re.match(r'^[a-zA-Z0-9_]+$', name))

def make_valid_table_name(name: str):
    return name.strip().replace(" ", "_")

def reverse_table_name(name: str):
    return name.strip().replace("_", " ")

def add_to_stores(store_name: str, connection):
    cursor = connection.cursor()

    cursor.execute("SELECT store_name FROM stores WHERE store_name = %s", (store_name,))
    result = cursor.fetchone()

    if not result:
        cursor.execute("INSERT INTO stores (store_name) VALUES (%s)", (store_name,))
        connection.commit()

    cursor.close()        

def add_design_temp(store_key : str, stock_item : StockItem):
    if store_key not in temp_stock_data:
        temp_stock_data[store_key] = []
    temp_stock_data[store_key].append(stock_item)
    return temp_stock_data[store_key]

def submit_new_stock(store_name : str, store_key: str, table_name: str, connection):
    store_name = make_valid_table_name(store_name)
    table_name = make_valid_table_name(table_name)

    if store_key not in temp_stock_data or not temp_stock_data[store_key]:
        raise ValueError("No designs to submit.")

    cursor = connection.cursor()

    cursor.execute(f"SHOW TABLES LIKE '{table_name}'")
    table_exists = cursor.fetchone()

    if not table_exists:
        create_table(cursor, table_name)

    for stock_item in temp_stock_data[store_key]:
        insert_item(cursor, table_name, stock_item)

    connection.commit()
    cursor.close()
    
    update_store(store_name,store_key,True,connection)
    update_dress_stock(store_name, temp_stock_data[store_key], connection, is_add=True)
    
    del temp_stock_data[store_key]

def update_dress_stock(store_name: str, stock_items: list, connection, is_add: bool):
    cursor = connection.cursor()

    # Ensure store exists
    cursor.execute("SELECT store_id FROM stores WHERE store_name = %s", (store_name,))
    result = cursor.fetchone()
    if result:
        store_id = result[0]
    else:
        cursor.execute("INSERT INTO stores (store_name) VALUES (%s)", (store_name,))
        connection.commit()
        store_id = cursor.lastrowid

    for item in stock_items:
        # item must have: design_code, price, quantity

        # Ensure design exists
        cursor.execute(
            "SELECT design_id FROM Dresses WHERE design_code = %s AND price = %s",
            (item.design_code, item.price)
        )
        result = cursor.fetchone()

        if result:
            design_id = result[0]
        else:
            cursor.execute(
                "INSERT INTO Dresses (design_code, price) VALUES (%s, %s)",
                (item.design_code, item.price)
            )
            connection.commit()
            design_id = cursor.lastrowid

        # Check if stock already exists
        cursor.execute(
            "SELECT quantity FROM Dress_Stock WHERE design_id = %s AND store_id = %s",
            (design_id, store_id)
        )
        result = cursor.fetchone()

        if result:
            existing_qty = result[0]
            new_qty = existing_qty + item.quantity if is_add else max(existing_qty - item.quantity, 0)

            cursor.execute(
                "UPDATE Dress_Stock SET quantity = %s WHERE design_id = %s AND store_id = %s",
                (new_qty, design_id, store_id)
            )
        else:
            # Only insert if quantity is non-zero and it's an add operation
            if is_add and item.quantity > 0:
                cursor.execute(
                    "INSERT INTO Dress_Stock (design_id, store_id, quantity) VALUES (%s, %s, %s)",
                    (design_id, store_id, item.quantity)
                )

    connection.commit()
    cursor.close()


#store name as table name
#status 1 for new stock, 0 for returned and sales.
def update_store(store_name : str, store_key : str, status : bool, connection):
    store_name = make_valid_table_name(store_name)

    cursor = connection.cursor()
    create_table(cursor,store_name)
    connection.commit()

    if(status):
        for stock_item in temp_stock_data[store_key]:
            insert_item(cursor,store_name,stock_item)
            connection.commit()
    else:
        for returned_item in temp_stock_data[store_key]:
            cursor.execute(
                f"""
                UPDATE {store_name} 
                SET qty = GREATEST(qty - %s, 0) 
                WHERE design_code = %s""",
                (returned_item.quantity, returned_item.design_code)
            )
            connection.commit()

        cursor.execute(f"""DELETE FROM {store_name} WHERE qty <= 0""")
        connection.commit()
    cursor.close()

#view shelf
def from_shelf(store_name : str,connection):
    store_name = make_valid_table_name(store_name)
    cursor = connection.cursor(dictionary = True)
    
    try:
        cursor.execute(f"""SELECT item,design_code, sp_per_item, qty, size FROM {store_name}""")
        shelf = cursor.fetchall()
        return shelf
    except ms.errors.ProgrammingError as e:
        raise Exception(f"Error fetching data: {e}")
    except Exception as e:
        raise Exception(f"Unexpected error: {e}")
    finally:
        cursor.close()

#view code details
def get_code_details(design_code: str, connection):
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT design_id, design_code, price 
            FROM Dresses 
            WHERE LOWER(design_code) LIKE %s
        """, (f"%{design_code.lower()}%",))

        designs = cursor.fetchall()

        if not designs:
            return None

        results = []

        for design in designs:
            design_id = design["design_id"]
            code = design["design_code"]
            price = design["price"]

            # Fetch locations for this design and price
            cursor.execute("""
                SELECT s.store_name, ds.quantity, d.price
                FROM Dress_Stock ds
                JOIN stores s ON ds.store_id = s.store_id
                JOIN Dresses d ON ds.design_id = d.design_id
                WHERE ds.design_id = %s
            """, (design_id,))

            locations = cursor.fetchall()

            results.append({
                "design_code": code,
                "price": price,
                "locations": locations
            })

        return results

    finally:
        cursor.close()       

#view action on a date
def lookup(store_name : str, date : str, action : str, connection):
    store_name = make_valid_table_name(store_name)
    cursor = connection.cursor(dictionary = True)
    
    date_obj = datetime.strptime(date,"%Y-%m-%d")
    formatted_date = date_obj.strftime("%d_%b_%Y")
    
    the_table = ""
    if action == "new":
        the_table = f"{store_name}_{formatted_date}_new_stock"
    elif action == "return":
        the_table = f"{store_name}_{formatted_date}_return_stock"  
    elif action == "sales":
        the_table = f"{store_name}_{formatted_date}_sales_stock"

    try:
        cursor.execute(f"""SELECT 
            DESIGN_CODE AS design_code, 
            SIZE AS size, 
            SP_PER_ITEM AS sp_per_item, 
            QTY AS qty, 
            GST_RATE AS gst_rate, 
            TAXABLE_AMOUNT_PER_ITEM AS taxable_amount, 
            TAX_AMOUNT_PER_ITEM AS tax_amount 
            FROM {the_table};""")
        shelf = cursor.fetchall()
        return shelf
    except ms.errors.ProgrammingError as e:
        if e.errno == 1146:
            return None
        raise Exception(f"Error fetching data: {e}")
    except Exception as e:
        raise Exception(f"Unexpected error: {e}")
    finally:
        cursor.close()

#lookup range
def lookupRange(fromDate, toDate, store_name, action, connection):
    cursor = connection.cursor()
    
    query = "SELECT date, store, action FROM records WHERE date BETWEEN %s AND %s"
    params = [fromDate, toDate]

    if store_name:
        query += " AND store = %s"
        params.append(store_name)

    if action:
        query += " AND action = %s"
        params.append(action)

    cursor.execute(query, params)
    rows = cursor.fetchall()

    col_names = [desc[0] for desc in cursor.description]
    result = [dict(zip(col_names, row)) for row in rows]

    return result        

#return logic
def add_design_temp_return(store_key : str, returned_item : ReturnedItem):
    if store_key not in temp_stock_data:
        temp_stock_data[store_key] = []
    temp_stock_data[store_key].append(returned_item)
    return temp_stock_data[store_key]

def submit_returned_stock(store_name : str, store_key: str, table_name: str, date : str, connection):
    store_name = make_valid_table_name(store_name)
    table_name = make_valid_table_name(table_name)

    if store_key not in temp_stock_data or not temp_stock_data[store_key]:
        raise ValueError("No designs to submit.")

    cursor = connection.cursor()

    cursor.execute(f"SHOW TABLES LIKE '{table_name}'")
    table_exists = cursor.fetchone()

    if not table_exists:
        create_table(cursor, table_name)
        
    new_store_key = f"{store_name}"
    for returned_item in temp_stock_data[store_key]:
        insert_into_returned(cursor, table_name, new_store_key, returned_item)

    connection.commit()
    cursor.close()
    
    update_store(store_name,store_key,False,connection)
    update_dress_stock(store_name, temp_stock_data[store_key], connection, is_add=False)
    
    del temp_stock_data[store_key]

#submit sales
def submit_sales_stock(store_name : str, store_key: str, table_name: str, date : str, connection):
    store_name = make_valid_table_name(store_name)
    table_name = make_valid_table_name(table_name)

    if store_key not in temp_stock_data or not temp_stock_data[store_key]:
        raise ValueError("No designs to submit.")

    cursor = connection.cursor()

    cursor.execute(f"SHOW TABLES LIKE '{table_name}'")
    table_exists = cursor.fetchone()

    if not table_exists:
        create_table(cursor, table_name)
        
    new_store_key = f"{store_name}"
    for sales_item in temp_stock_data[store_key]:
        insert_into_returned(cursor, table_name, new_store_key, sales_item)

    connection.commit()
    cursor.close()
    
    update_store(store_name,store_key,False,connection)
    update_dress_stock(store_name, temp_stock_data[store_key], connection, is_add=False)

    del temp_stock_data[store_key]

#remove from temp
def remove_from_temp(store_key : str, code : str):
    index = -1
    flag = 0

    if store_key not in temp_stock_data or not temp_stock_data[store_key]:
        raise HTTPException(status_code=404, detail="Temp list is empty")

    for item in temp_stock_data[store_key]:
        index = index + 1
        if item.design_code == code:
            break
    else:
        flag = 1
        raise ValueError(f"Design code '{code}' not found for store key '{store_key}'.")
    
    if flag == 0:
        del temp_stock_data[store_key][index]
    return temp_stock_data[store_key]    


#lookupforprint
def lookupforprint(store_name : str, date : str, action : str, connection):
    store_name = make_valid_table_name(store_name)

    cursor = connection.cursor(dictionary = True)
    
    date_obj = datetime.strptime(date,"%Y-%m-%d")
    formatted_date = date_obj.strftime("%d_%b_%Y")
    
    the_table = ""
    if action == "new":
        the_table = f"{store_name}_{formatted_date}_new_stock"
    elif action == "return":
        the_table = f"{store_name}_{formatted_date}_return_stock"    

    try:
        cursor.execute(f"""SELECT 
            ITEM AS item,
            DESIGN_CODE AS design_code, 
            SIZE AS size, 
            SP_PER_ITEM AS sp_per_item, 
            QTY AS qty, 
            GST_RATE AS gst_rate, 
            TAXABLE_AMOUNT_PER_ITEM AS taxable_amount, 
            TAX_AMOUNT_PER_ITEM AS tax_amount 
            FROM {the_table};""")
        shelf = cursor.fetchall()
        return shelf
    except ms.errors.ProgrammingError as e:
        if e.errno == 1146:
            return None
        raise Exception(f"Error fetching data: {e}")
    except Exception as e:
        raise Exception(f"Unexpected error: {e}")
    finally:
        cursor.close()


#pdf
import io
from reportlab.lib.pagesizes import letter, landscape

def generate_pdf_bytes(brand_name: str ,store_name: str, date: str, action: str, stock_data: list) -> bytes:
    brand_name = make_valid_table_name(brand_name)
    store_name = make_valid_table_name(store_name)
    
    date_obj = datetime.strptime(date, "%Y-%m-%d")
    formatted_date = date_obj.strftime("%d_%b_%Y")

    margin_top = 36
    margin_bottom = 36
    margin_left = 36
    margin_right = 36

    page_width, page_height = landscape(letter)
    available_width = page_width - margin_left - margin_right

    buffer = io.BytesIO()  # Create an in-memory buffer

    pdf = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        rightMargin=margin_right,
        leftMargin=margin_left,
        topMargin=margin_top,
        bottomMargin=margin_bottom
    )

    heading_style = ParagraphStyle(
        name="Heading1",
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        alignment=1,
        textColor="black",
        spaceAfter=10,
    )
    subheading_style = ParagraphStyle(
        name="Heading2",
        fontSize=14,
        fontName="Helvetica",
        leading=18,
        alignment=1,
        textColor="darkgray",
        spaceAfter=10,
    )

    main_heading = Paragraph(brand_name.capitalize(), heading_style)
    sub_heading = Paragraph(f"{store_name.capitalize()} | {formatted_date} | {action.capitalize()} Stock", subheading_style)

    # Table data
    has_gst = any(item.get("gst_rate", 0) > 0 for item in stock_data)

    if has_gst:
        table_data = [["S.No", "Item", "Design Code", "Price", "GST Rate", "HSNCODE", "TAXABLE", "TAX", "Quantity", "Size"]]
    else:
        table_data = [["S.No", "Item", "Design Code", "Price", "Quantity", "Size"]]

    for index, item in enumerate(stock_data, start=1):
        if has_gst:
            table_data.append([
                str(index),
                item["item"],
                item["design_code"],
                f"{item['sp_per_item']:.2f}",
                item.get("gst_rate", 0),
                item.get("hsncode", "62092000"),
                f"{item.get('taxable_amount', 0):.2f}",
                f"{item.get('tax_amount', 0):.2f}",
                item["qty"],
                item["size"]
            ])
        else:
            table_data.append([
                str(index),
                item["item"],
                item["design_code"],
                f"{item['sp_per_item']:.2f}",
                item["qty"],
                item["size"]
            ])

    num_columns = len(table_data[0])
    colWidths = [available_width / num_columns] * num_columns

    table = Table(table_data, colWidths=colWidths)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.whitesmoke),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))

    pdf.build([main_heading, sub_heading, Spacer(1, 10), table])

    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes  # Return the PDF content as bytes
