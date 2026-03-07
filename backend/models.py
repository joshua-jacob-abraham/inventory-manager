from pydantic import BaseModel
from typing import Dict, Union, Optional

#define schemas for data transfer(how data should be structured.)

class StockItem(BaseModel):
    item : str
    design_code : str
    size : Union[int, str]
    price : float
    quantity : int
    gst_applicable : bool
    gst_rate: Optional[int] = None
    hsn_code: Optional[str] = "62092000"
    taxable_amount: Optional[float] = None
    tax_amount: Optional[float] = None    
    custom_fields: Optional[Dict[str, str]] = None

    def to_dict(self):
        return {
            'item' : self.item,
            'design_code': self.design_code,
            'size': self.size,
            'price': self.price,
            'quantity': self.quantity,
            'gst_applicable' : self.gst_applicable,
            'gst_rate': self.gst_rate,
            'hsn_code': self.hsn_code,
            'taxable_amount': self.taxable_amount,
            'tax_amount': self.tax_amount,
            'custom_fields': self.custom_fields
        }

class ReturnedItem(BaseModel):
    design_code : str
    size : Union[int, str]
    quantity : int