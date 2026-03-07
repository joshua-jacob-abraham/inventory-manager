import React from "react";
import "../styles/Selected.css";

const COLUMN_MAP = [
  { key: "design_code", label: "Code", render: (item) => item.design_code },
  { key: "hsn_code", label: "HSN Code", render: (item) => item.hsn_code },
  { key: "size", label: "Size", render: (item) => item.size },
  { key: "sp_per_item", label: "Price", render: (item) => item.sp_per_item },
  { key: "qty", label: "Qnty", render: (item) => item.qty },
  {
    key: "gst_rate",
    label: "GST Rate",
    render: (item) => (item.gst_rate != null ? `${item.gst_rate}%` : "-"),
  },
  {
    key: "taxable_amount_per_item",
    label: "Taxable Amount",
    render: (item) => item.taxable_amount,
  },
  {
    key: "tax_amount_per_item",
    label: "Tax Amount",
    render: (item) => item.tax_amount,
  },
];

const ViewedItemsTable = ({ data, isDisabled, selectedColumns }) => {
  const visibleColumns = selectedColumns
    ? COLUMN_MAP.filter((col) => selectedColumns.includes(col.key))
    : COLUMN_MAP.filter((col) =>
        isDisabled
          ? ![
              "gst_rate",
              "taxable_amount_per_item",
              "tax_amount_per_item",
              "hsn_code",
            ].includes(col.key)
          : !["hsn_code"].includes(col.key),
      );

  const customKeys = selectedColumns
    ? selectedColumns.filter((k) => !COLUMN_MAP.find((c) => c.key === k))
    : [];

  return (
    <div className="selected-table-container">
      <table className="selected-table">
        <thead>
          <tr>
            {visibleColumns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
            {customKeys.map((key) => (
              <th key={key}>{key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={`${item.design_code}-${index}`}>
              {visibleColumns.map((col) => (
                <td key={col.key}>{col.render(item)}</td>
              ))}
              {customKeys.map((key) => (
                <td key={key}>{item[key] ?? "-"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ViewedItemsTable;
