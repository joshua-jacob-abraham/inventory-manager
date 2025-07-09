import React from "react";
import "../styles/Selected.css";

const SelectedItemsTable = ({ data, onRemove }) => {
  return (
    <div className="selected-table-container">
      <table className="selected-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Code</th>
            <th>Size</th>
            <th>Price</th>
            <th>Qty</th>
            <th>Taxable</th>
            <th>Tax</th>
            {onRemove && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={`${item.design_code}-${item.size}`}>
              <td>{index + 1}</td>
              <td>{item.design_code}</td>
              <td>{item.size}</td>
              <td>{item.price}</td>
              <td>{item.quantity}</td>
              <td>{item.taxable_amount}</td>
              <td>{item.tax_amount}</td>
              {onRemove && (
                <td>
                  <button
                    className="remove-btn"
                    onClick={() => onRemove(item.design_code)}
                  >
                    🗑
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SelectedItemsTable;
