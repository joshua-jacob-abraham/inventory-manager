import json

from fastapi import FastAPI,HTTPException,Query
from fastapi.responses import FileResponse
import mysql.connector as ms
from fastapi.middleware.cors import CORSMiddleware
from crud import insert_into_records
from models import StockItem,ReturnedItem
from services import add_to_stores, clear_temp_data, get_code_details, is_valid_name, lookupRange, make_valid_table_name, reverse_table_name, set_custom_field_definitions, submit_new_stock,add_design_temp,temp_stock_data,from_shelf,lookup,add_design_temp_return,submit_returned_stock,remove_from_temp,lookupforprint,submit_sales_stock, safe_identifier
from database import get_db_connection
from datetime import datetime
from openpyxl.styles import Font, Alignment
from fastapi.responses import StreamingResponse, JSONResponse
import io
import pandas as pd
from openpyxl.styles import Border, Side
from typing import Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)

#health check
@app.get("/health/db")
async def check_db_health():
	try:
		connection = get_db_connection()
		connection.ping(reconnect=True)
		connection.close()
		return {"mysql": "ok"}
	except Exception as e:
		return JSONResponse(status_code=500, content={"mysql": "down", "error": str(e)})
	
#get custom fields set previous time
@app.get("/custom/{brand_name}/{store_name}")
async def getCustomFields(brand_name : str, store_name : str):
	store_name = safe_identifier(make_valid_table_name(store_name))
	brand_name = safe_identifier(make_valid_table_name(brand_name))

	try:
		connection = get_db_connection(brand_name)
		cursor = connection.cursor()

		cursor.execute("""SELECT custom_field_definitions FROM stores WHERE store_name = %s""", (store_name,))

		result = cursor.fetchone()
		if not result: 
			return {"fields": []}

		if result and result[0]:
			fields = json.loads(result[0])
		else:
			fields = []

		cursor.close()
		connection.close()	

		return {"fields": fields}

	except Exception as e:
		raise HTTPException(status_code=400, detail=str(e))	


#rename brandname
@app.post("/alter/brandname")
async def alterName(
	old_name : str = Query(...),
	new_name : str = Query(...)
):
	old_name = make_valid_table_name(old_name)
	new_name = make_valid_table_name(new_name)

	if not is_valid_name(old_name) or not is_valid_name(new_name):
		raise HTTPException(status_code=400, detail="Brand name should have only letters, numbers and spaces.")

	try:
		connection = get_db_connection()
		cursor = connection.cursor()

		cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{new_name}`;")
		cursor.execute(f"""
					SELECT table_name 
					FROM information_schema.tables 
					WHERE table_schema = '{old_name}';
			""")
		tables = cursor.fetchall()
		for each in tables:
			print(each)

		for (table_name,) in tables:
				cursor.execute(f"""
						RENAME TABLE `{old_name}`.`{table_name}` TO `{new_name}`.`{table_name}`;
				""")

		cursor.execute(f"DROP DATABASE `{old_name}`;")

		connection.commit()
		cursor.close()

		connection.close()

		return {
			"message" : f"BrandName changed from `{reverse_table_name(old_name)}` to `{reverse_table_name(new_name)}` successfully",
			"new_name" : reverse_table_name(new_name)
		}		
	except Exception as e:
		raise HTTPException(status_code=400, detail=str(e))	

#get brandnames and store names
@app.get("/brands")
async def get_brands():
	try:
		connection = get_db_connection()
		cursor = connection.cursor()
		
		cursor.execute("""
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('mysql', 'information_schema','performance_schema', 'sys');
        """)
		brands = [row[0] for row in cursor.fetchall()]
		for i in range(0,len(brands)):
			brands[i] = reverse_table_name(brands[i])

		connection.close()
		return {"brands": brands}
	except Exception as e:
		raise HTTPException(status_code=400, detail=str(e))

@app.get("/stores")
async def get_stores(
	brand_name : str
):
	try:
		connection = get_db_connection(brand_name)
		cursor = connection.cursor()
		
		cursor.execute("SELECT store_name FROM stores;")

		thestores = [row[0] for row in cursor.fetchall()]
		for i in range(0,len(thestores)):
			thestores[i] = reverse_table_name(thestores[i])

		connection.close()
		return {"stores": thestores}
	except Exception as e:
		raise HTTPException(status_code=400, detail=str(e))		

#add new items
@app.post("/add/new")
async def add_stock_item(
	stock_item : StockItem,
	store_name : str = Query(...), 
	date : str = Query(...)
	):
	
	date_obj = datetime.strptime(date, "%Y-%m-%d")
	formatted_date = date_obj.strftime("%d_%b_%Y")

	store_name = safe_identifier(make_valid_table_name(store_name))
	store_key = f"{store_name}_{formatted_date}_new_stock"

	try:
		temp_data = add_design_temp(store_key,stock_item)
		return {
			"store_key" : store_key,
			"current_designs" : temp_data
		}

	except Exception as e:
		raise HTTPException(status_code=400, detail=str(e))

#returned
@app.post("/add/return")
async def add_returned_item(
	returned_item : ReturnedItem,
	store_name : str = Query(...), 
	date : str = Query(...)
	):
	
	date_obj = datetime.strptime(date, "%Y-%m-%d")
	formatted_date = date_obj.strftime("%d_%b_%Y")
	
	store_name = safe_identifier(make_valid_table_name(store_name))
	store_key = f"{store_name}_{formatted_date}_return_stock"

	try:
		temp_data = add_design_temp_return(store_key,returned_item)
		return {
			"message" : "Stock item added to returned list",
			"store_key" : store_key,
			"current_designs" : temp_data
		}

	except Exception as e:
		raise HTTPException(status_code=400, detail=str(e))

#sales
@app.post("/add/sales")
async def add_sales_item(
	returned_item : ReturnedItem,
	store_name : str = Query(...), 
	date : str = Query(...)
	):
	
	date_obj = datetime.strptime(date, "%Y-%m-%d")
	formatted_date = date_obj.strftime("%d_%b_%Y")
	
	store_name = safe_identifier(make_valid_table_name(store_name))
	store_key = f"{store_name}_{formatted_date}_sales_stock"

	try:
		temp_data = add_design_temp_return(store_key,returned_item)
		return {
			"message" : "Stock item added to returned list",
			"store_key" : store_key,
			"current_designs" : temp_data
		}

	except Exception as e:
		raise HTTPException(status_code=400, detail=str(e))

@app.get("/view/{store_key}")
async def view_stock(store_key: str):
    if store_key not in temp_stock_data or not temp_stock_data[store_key]:
        raise HTTPException(status_code=404, detail="Add designs.")
    
    return {"message": "Temporary stock items", "data": temp_stock_data[store_key]}	

#view shelf
@app.get("/shelf/{brand_name}/{store_name}")
async def view_shelf(brand_name : str, store_name : str):
	store_name = safe_identifier(make_valid_table_name(store_name))
	brand_name = safe_identifier(make_valid_table_name(brand_name))

	try:
		connection = get_db_connection(brand_name)
		shelf = from_shelf(store_name, connection)
		connection.close()

		if not shelf:
			return {"message": f"No stock found for {store_name}.", "data": []}

		return {"message": f"Stock at {store_name}.", "data": shelf}
	
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))

#view code.
@app.get("/view_code/{brand_name}/{design_code}")
async def view_code(brand_name: str, design_code: str):
    brand_name = make_valid_table_name(brand_name)
    design_code = design_code.strip()

    try:
        connection = get_db_connection(brand_name)
        code_data = get_code_details(design_code, connection)
        connection.close()

        if not code_data:
            return {
                "message": f"Design code '{design_code}' not found.",
                "data": {}
            }

        return {
            "message": f"Stock locations for design code '{design_code}'.",
            "data": code_data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

#view action on a date
@app.get("/view_action/{brand_name}/{store_name}/{date}/{action}")
async def view_action(brand_name : str,store_name : str, date: str, action : str):
	store_name = safe_identifier(make_valid_table_name(store_name))
	brand_name = safe_identifier(make_valid_table_name(brand_name))

	try:
		connection = get_db_connection(brand_name)
		action_on_date = lookup(store_name,date,action,connection)
		connection.close()

		if not action_on_date:
			return {"message": f"Action not performed at {store_name} on {date}. ", "data" : []}

		return {"message": f"{action} stock on {date} at {store_name}.", "data": action_on_date}
	
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))
	
#view records in date range
@app.get("/view_range/{brand_name}")
async def view_range(
    brand_name: str,
    fromDate: str,
    toDate: str,
    store_name: Optional[str] = Query(None),
    action: Optional[str] = Query(None)
):
    brand_name = safe_identifier(make_valid_table_name(brand_name))

    try:
        connection = get_db_connection(brand_name)
        action_on_range= lookupRange(fromDate, toDate, store_name, action, connection)
        connection.close()

        if not action_on_range:
            return {
                "message": f"No actions performed from {fromDate} to {toDate}.",
                "data": []
            }

        return {
            "message": f"Records from {fromDate} to {toDate}",
            "data": action_on_range
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/submit/{brand_name}/{action}")
async def submition_handler(
	brand_name : str,
	action : str,
	store_name : str = Query(...), 
	date : str = Query(...)
	):

	brand_name = safe_identifier(make_valid_table_name(brand_name))
	store_name = safe_identifier(make_valid_table_name(store_name))

	date_obj = datetime.strptime(date, "%Y-%m-%d")
	formatted_date = date_obj.strftime("%d_%b_%Y")
	
	table_name = f"{store_name}_{formatted_date}_{action}"

	try:
		connection = get_db_connection(brand_name)
		add_to_stores(store_name,connection)
		
		cursor = connection.cursor()
		insert_into_records(cursor,reverse_table_name(store_name),action,date)
		connection.commit()
		cursor.close()

		if(action == "new"):
			store_key = f"{store_name}_{formatted_date}_new_stock"
			table_name = f"{store_name}_{formatted_date}_new_stock"
			submit_new_stock(store_name, store_key,table_name,connection)
		elif action == "return":
			store_key = f"{store_name}_{formatted_date}_return_stock"
			table_name = f"{store_name}_{formatted_date}_return_stock"
			submit_returned_stock(store_name, store_key,table_name,formatted_date,connection)
		elif action == "sales":
			store_key = f"{store_name}_{formatted_date}_sales_stock"
			table_name = f"{store_name}_{formatted_date}_sales_stock"
			submit_sales_stock(store_name, store_key,table_name,formatted_date,connection)	

		connection.close()

		return {
			"message" : "Stock details submitted successfully"
		}
	
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))
	
#remove from temp
@app.post("/remove/temp/{code}")
async def remove(
	code : str,
	store_key : str = Query(...)
	):
	
	temp_data = remove_from_temp(store_key,code)
	
	return {
		"message" : "Updated added list",
		"data" : temp_data
	}

@app.post("/clear/temp")
async def clearTemp(store_key: str = Query(...)):
    temp_data = clear_temp_data(store_key)
    return {
        "message": f"Cleared temp data for store '{store_key}'.",
        "data": temp_data,
    }

#print excel
@app.post("/printExcel/{brand_name}")
async def print_table_excel(
	brand_name: str,
	store_name: str = Query(...),
	date: str = Query(...),
	action: str = Query(...)
):
	date_obj = datetime.strptime(date, "%Y-%m-%d")
	formatted_date = date_obj.strftime("%d_%b_%Y")

	brand_name = safe_identifier(make_valid_table_name(brand_name))
	store_name = safe_identifier(make_valid_table_name(store_name))

	connection = get_db_connection(brand_name)

	stock_data = lookupforprint(store_name, date, action, connection)

	if stock_data is None or not stock_data:
			raise HTTPException(status_code=404, detail="No stock data found for the specified parameters.")

	has_gst = any(float(item.get("gst_rate", 0)) > 0 for item in stock_data)

	columns = [
			("item", "ITEM"),
			("design_code", "CODE"),
			("size", "SIZE"),
			("sp_per_item", "PRICE"),
			("qty", "QUANTITY"),
	]

	if has_gst:
			columns += [
					("gst_rate", "GST_RATE"),
					("taxable_amount", "TAXABLE"),
					("tax_amount", "TAX"),
			]		

	df = pd.DataFrame(stock_data)
	df = df[[col[0] for col in columns]]
	df.columns = [col[1] for col in columns]
	df.index = range(1, len(df) + 1)

	excel_bytes_io = io.BytesIO()

	with pd.ExcelWriter(excel_bytes_io, engine='openpyxl') as writer:
			sheet_name = "Stock Data"
			df.to_excel(writer, index=True, startrow=3, sheet_name=sheet_name, index_label="S.No")

			workbook = writer.book
			worksheet = writer.sheets[sheet_name]

			worksheet["C1"] = brand_name.upper()
			worksheet["D1"] = store_name.upper()
			worksheet["D2"] = formatted_date.upper()
			worksheet["E2"] = f"{action.upper()} STOCKS"

			for cell in ["C1", "D1"]:
				worksheet[cell].font = Font(bold=False)
				worksheet[cell].alignment = Alignment(horizontal="center", vertical="center")
	
			column_widths = {
					"A": 12,  # S.No
					"B": 14,  # item
					"C": 18,  # design_code
					"D": 14,  # size
					"E": 14,  # sp_per_item
					"F": 10,  # qty
					"G": 11,  # gst_rate
					"H": 18,  # taxable_amount
					"I": 18   # tax_amount
			}

			for col, width in column_widths.items():
				worksheet.column_dimensions[col].width = width

			thin_border = Border(
				left=Side(style="thin", color="000000"),
				right=Side(style="thin", color="000000"),
				top=Side(style="thin", color="000000"),
				bottom=Side(style="thin", color="000000")
			)		

			max_column = 9 if has_gst else 6

			for row in worksheet.iter_rows(min_row=1, max_row=worksheet.max_row, min_col=1, max_col=max_column):
				for cell in row:
						cell.alignment = Alignment(horizontal="center", vertical="center")
						cell.border = thin_border
	
	excel_bytes_io.seek(0)

	return StreamingResponse(
			excel_bytes_io,
			media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			headers={
					"Content-Disposition": f"attachment; filename={store_name}_{formatted_date}_{action}_stock.xlsx"
			}
	)

if __name__ == "__main__":
    import uvicorn
    print("Running FastAPI server...")
    uvicorn.run(app, host="127.0.0.1", port=8000)