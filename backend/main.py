from fastapi import FastAPI,HTTPException,Query
from fastapi.responses import FileResponse
import mysql.connector as ms
from fastapi.middleware.cors import CORSMiddleware
from models import StockItem,ReturnedItem
from services import make_valid_table_name, submit_new_stock,add_design_temp,temp_stock_data,from_shelf,lookup,add_design_temp_return,submit_returned_stock,remove_from_temp,generate_pdf_bytes,lookupforprint,submit_sales_stock
from database import get_db_connection
from datetime import datetime
from openpyxl.styles import Font, Alignment
from fastapi.responses import StreamingResponse, JSONResponse
import io
import pandas as pd

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

#add new items
@app.post("/add/new")
async def add_stock_item(
	stock_item : StockItem,
	store_name : str = Query(...), 
	date : str = Query(...)
	):
	
	date_obj = datetime.strptime(date, "%Y-%m-%d")
	formatted_date = date_obj.strftime("%d_%b_%Y")

	store_name = make_valid_table_name(store_name)
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
	
	store_name = make_valid_table_name(store_name)
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
	
	store_name = make_valid_table_name(store_name)
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
	store_name = make_valid_table_name(store_name)
	brand_name = make_valid_table_name(brand_name)

	try:
		connection = get_db_connection(brand_name)
		shelf = from_shelf(store_name, connection)
		connection.close()

		if not shelf:
			return {"message": f"No stock found for {store_name}.", "data": []}

		return {"message": f"Stock at {store_name}.", "data": shelf}
	
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))
	
#view action on a date
@app.get("/view_action/{brand_name}/{store_name}/{date}/{action}")
async def view_action(brand_name : str,store_name : str, date: str, action : str):
	store_name = make_valid_table_name(store_name)
	brand_name = make_valid_table_name(brand_name)

	try:
		connection = get_db_connection(brand_name)
		action_on_date = lookup(store_name,date,action,connection)
		connection.close()

		if not action_on_date:
			return {"message": f"Action not performed at {store_name} on {date}. ", "data" : []}

		return {"message": f"{action} stock on {date} at {store_name}.", "data": action_on_date}
	
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


@app.post("/submit/{brand_name}/{action}")
async def submition_handler(
	brand_name : str,
	action : str,
	store_name : str = Query(...), 
	date : str = Query(...)
	):

	brand_name = make_valid_table_name(brand_name)
	store_name = make_valid_table_name(store_name)

	date_obj = datetime.strptime(date, "%Y-%m-%d")
	formatted_date = date_obj.strftime("%d_%b_%Y")
	
	store_key = f"{store_name}_{formatted_date}_{action}"
	table_name = f"{store_name}_{formatted_date}_{action}"

	try:
		connection = get_db_connection(brand_name)
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

#print table
@app.post("/printPDF/{brand_name}")
async def print_pdf(
	brand_name : str,
	store_name : str = Query(...),
	date : str = Query(...),
	action : str = Query(...)
	):
	
	store_name = make_valid_table_name(store_name)
	brand_name = make_valid_table_name(brand_name)

	date_obj = datetime.strptime(date,"%Y-%m-%d")
	formatted_date = date_obj.strftime("%d_%b_%Y")

	connection = get_db_connection(brand_name)

	stock_data = lookupforprint(store_name,date,action,connection)
	if stock_data is None or not stock_data:
		raise HTTPException(status_code=404, detail="No stock data found for the specified parameters.")

	pdf_bytes = generate_pdf_bytes(brand_name,store_name, date, action, stock_data)

	return StreamingResponse(
			io.BytesIO(pdf_bytes),
			media_type="application/pdf",
			headers={"Content-Disposition": f"attachment; filename={store_name}_{formatted_date}_{action}_stock.pdf"}
	)

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

	brand_name = make_valid_table_name(brand_name)
	store_name = make_valid_table_name(store_name)

	connection = get_db_connection(brand_name)

	stock_data = lookupforprint(store_name, date, action, connection)

	if stock_data is None or not stock_data:
			raise HTTPException(status_code=404, detail="No stock data found for the specified parameters.")

	df = pd.DataFrame(stock_data)
	df.index = range(1, len(df) + 1)

	excel_bytes_io = io.BytesIO()

	with pd.ExcelWriter(excel_bytes_io, engine='openpyxl') as writer:
			sheet_name = "Stock Data"
			df.to_excel(writer, index=True, startrow=3, sheet_name=sheet_name, index_label="S.No")

			workbook = writer.book
			worksheet = writer.sheets[sheet_name]

			worksheet.merge_cells("A1:H1")
			header_cell = worksheet["A1"]
			header_cell.value = f"Brand: {brand_name} | Store: {store_name} | Date: {date} | {action} stocks"
			header_cell.font = Font(bold=True, size=14, name="Times New Roman")
			header_cell.alignment = Alignment(horizontal="center", vertical="center")

			column_widths = {
					"A": 12,  # S.No
					"B": 12,  # item
					"C": 18,  # design_code
					"D": 12,  # size
					"E": 14,  # sp_per_item
					"F": 10,  # qty
					"G": 11,  # gst_rate
					"H": 18,  # taxable_amount
					"I": 18   # tax_amount
			}

			for col, width in column_widths.items():
					worksheet.column_dimensions[col].width = width
	
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