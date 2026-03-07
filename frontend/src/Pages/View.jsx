import "../styles/View.css";
import axios from "axios";
import Heading from "../components/Heading.jsx";
import React, { useState, useContext } from "react";
import Check from "../components/Check.jsx";
import { BrandNameContext } from "../contexts/BrandNameContext.jsx";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Suspense, lazy } from "react";
import excelMenu from "../assets/excelMenu.svg";

const ViewedItemsTable = React.lazy(() => import("../components/Viewed.jsx"));
const DropDown = React.lazy(() => import("../components/DropDown.jsx"));
const Loading = React.lazy(() => import("../components/Loading.jsx"));
const ViewedRecordsTable = React.lazy(
  () => import("../components/ViewedRecordsTable.jsx"),
);

function ViewStock() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate("/dash");
  };

  const handleDoubleClick = () => {
    navigate("/home");
  };

  const [stores, setStores] = useState([]);
  const [filteredStores, setFilteredStores] = useState([]);
  const [suggest, setSuggest] = useState(false);

  const [isRangeView, setIsRangeView] = useState(false);

  useEffect(() => {
    axios
      .get("http://localhost:8000/stores", {
        params: {
          brand_name: brandName,
        },
      })
      .then((res) => {
        setStores(res.data.stores);
        setFilteredStores(res.data.stores);
      })
      .catch((err) => console.error(err));
  }, []);

  const handleStoreNameInputChange = (e) => {
    const value = e.target.value;
    setStoreName(value);

    const filtered = stores.filter((store) =>
      store.toLowerCase().includes(value.toLowerCase()),
    );
    if (
      filtered.length === 1 &&
      filtered[0].toLowerCase() === value.toLowerCase()
    ) {
      setFilteredStores([]);
    } else {
      setFilteredStores(filtered);
    }
  };

  const [shouldFetchRecord, setShouldFetchRecord] = useState(false);

  const handleViewRecordClick = (record) => {
    setStoreName(record.store);
    setFromDate(record.date);
    setToDate(record.date);
    setAction(record.action);

    setIsRangeView(false);
    setShouldFetchRecord(true);
  };

  useEffect(() => {
    if (shouldFetchRecord) {
      handleGet();
      setShouldFetchRecord(false);
    }
  }, [shouldFetchRecord]);

  const handleSelectSuggestion = (selectedName) => {
    setStoreName(selectedName);
    setFilteredStores([]);
  };

  const location = useLocation();
  const passedState = location.state || {};

  const [storeName, setStoreName] = useState(passedState.store_name || "");
  const [action, setAction] = useState(passedState.action || "");
  const [fromDate, setFromDate] = useState(passedState.date || "");
  const [toDate, setToDate] = useState(passedState.date || "");

  const { brandName } = useContext(BrandNameContext);
  const [isDisabled, setIsDisabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const [retrievedData, setRetrievedData] = useState([]);

  const handleCheckChange = (checked) => {
    setIsDisabled(checked);
    if (!checked) {
      setRetrievedData([]);
    }
  };

  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [pendingColumns, setPendingColumns] = useState([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [columnsApplied, setColumnsApplied] = useState(false);

  const INITIAL_COLUMNS = [
    "design_code",
    "sp_per_item",
    "qty",
    "size",
    "taxable_amount_per_item",
    "tax_amount_per_item",
  ];

  const LABEL_MAP = {
    design_code: "Code",
    sp_per_item: "Price",
    qty: "Quantity",
    size: "Size",
    gst_rate: "GST Rate",
    taxable_amount_per_item: "Taxable Amount",
    tax_amount_per_item: "Tax Amount",
    hsn_code: "HSN Code",
    item: "Item",
  };

  const handleMenuClick = async () => {
    if (!storeName || !fromDate || !action) {
      alert("Please fill store name, date and action first.");
      return;
    }

    setColumnsLoading(true);
    try {
      const res = await axios.get(
        `http://localhost:8000/columns/${brandName}`,
        {
          params: { store_name: storeName, date: fromDate, action },
        },
      );

      const fixed = res.data.fixed_columns.map((col) => ({
        key: col.toLowerCase(),
        label: LABEL_MAP[col.toLowerCase()] || col,
        isCustom: false,
      }));

      const custom = res.data.custom_field_keys.map((key) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        isCustom: true,
      }));

      const all = [...fixed, ...custom];
      setAvailableColumns(all);
      setSelectedColumns(INITIAL_COLUMNS);
      setPendingColumns(INITIAL_COLUMNS);
      setShowColumnMenu(true);
    } catch (err) {
      alert("Could not fetch columns.");
    } finally {
      setColumnsLoading(false);
    }
  };

  const togglePending = (key) => {
    setPendingColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handlePrintExcel = async () => {
    try {
      setLoading(true);
      const response = await axios.post(
        `http://localhost:8000/printExcel/${brandName}`,
        null,
        {
          params: {
            store_name: storeName,
            date: fromDate,
            action,
            selected_columns:
              columnsApplied && selectedColumns.length
                ? selectedColumns.join(",")
                : undefined,
          },
          responseType: "blob",
        },
      );

      const excelBlob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const excelUrl = URL.createObjectURL(excelBlob);
      const a = document.createElement("a");
      a.href = excelUrl;
      a.download = `${storeName}_${fromDate}_${action}_stock.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(excelUrl);
    } catch (error) {
      alert("Failed to save Excel file.");
    } finally {
      setLoading(false);
    }
  };

  const handleGet = async () => {
    if (isDisabled) {
      try {
        setLoading(true);
        const response = await axios.get(
          `http://localhost:8000/shelf/${encodeURIComponent(
            brandName,
          )}/${encodeURIComponent(storeName)}`,
        );

        setRetrievedData(response.data.data);
        console.log(response);
        if (response.data.data.length == 0) {
          setLoading(false);
          alert(response.data.message);
        }
      } catch (error) {
        console.error(
          "Error viewing shelf:",
          error.response?.data || error.message,
        );
        setLoading(false);
        alert("Failed to view shelf.");
      } finally {
        setLoading(false);
      }
    } else {
      try {
        setLoading(true);

        if (fromDate === toDate) {
          const response = await axios.get(
            `http://localhost:8000/view_action/${encodeURIComponent(
              brandName,
            )}/${encodeURIComponent(storeName)}/${fromDate}/${action}`,
          );
          setRetrievedData(response.data.data);
          setIsRangeView(false);

          if (response.data.data.length == 0) {
            setLoading(false);
            setTimeout(() => {
              alert(response.data.message);
            }, 0);
          }
        } else {
          const response = await axios.get(
            `http://localhost:8000/view_range/${encodeURIComponent(brandName)}`,
            {
              params: {
                fromDate: fromDate,
                toDate: toDate,
                store_name: storeName || undefined,
                action: action || undefined,
              },
            },
          );
          setRetrievedData(response.data.data);
          setIsRangeView(true);
          if (response.data.data.length == 0) {
            setLoading(false);
            setTimeout(() => {
              alert(response.data.message);
            }, 0);
          }
        }
      } catch (error) {
        console.error(
          "Error viewing the data:",
          error.response?.data || error.message,
        );
        setLoading(false);
        alert("Failed to view the data.");
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (passedState.autoFetch) {
      handleGet();
    }
  }, []);

  return (
    <div className="dashboard">
      <Heading
        name={brandName}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />

      {loading && (
        <Suspense fallback={null}>
          <Loading />
        </Suspense>
      )}

      <div className="viewstock">
        <div
          style={{
            position: "relative",
            gridColumn: "span 2",
            display: "grid",
          }}
        >
          <input
            type="text"
            placeholder="Store name"
            className="details storeView"
            value={storeName}
            onChange={handleStoreNameInputChange}
            onFocus={() => setSuggest(true)}
          />

          {suggest && storeName.trim() !== "" && (
            <Suspense fallback={null}>
              <DropDown
                options={filteredStores}
                onSelect={handleSelectSuggestion}
                className="store-name-suggestions-view"
              />
            </Suspense>
          )}
        </div>

        <input
          type="text"
          placeholder="new or return or sales"
          className="details act"
          disabled={isDisabled}
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />

        <input
          type="date"
          className="fromDateView"
          disabled={isDisabled}
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />

        <input
          type="date"
          className="toDateView"
          disabled={isDisabled}
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />

        <Check onChange={handleCheckChange} />

        <button className="get" onClick={handleGet}>
          GET
        </button>

        <div className="excelOps" style={{ position: "relative" }}>
          <button
            className="printExcel"
            onClick={handlePrintExcel}
            disabled={isDisabled}
          >
            Save as Excel
          </button>

          <button
            className="action"
            onClick={handleMenuClick}
            disabled={columnsLoading}
          >
            <img className="excelMenu" src={excelMenu} alt="excelMenu" />
          </button>

          {showColumnMenu && (
            <div
              className="column-menu"
              style={{
                position: "absolute",
                top: "110%",
                right: 0,
                background: "#fff",
                border: "1px solid #ccc",
                borderRadius: "8px",
                padding: "12px",
                zIndex: 100,
                minWidth: "200px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <strong style={{
                  userSelect : "none",
                }}>Select Columns</strong>
                <button
                  onClick={() => setShowColumnMenu(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "16px",
                  }}
                >
                  ✕
                </button>
              </div>

              {availableColumns.map((col) => (
                <label
                  key={col.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "6px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={pendingColumns.includes(col.key)}
                    onChange={() => togglePending(col.key)}
                  />
                  {col.label}
                  {col.isCustom && (
                    <span style={{ fontSize: "12px", color: "#888" }}>
                      (custom)
                    </span>
                  )}
                </label>
              ))}

              <button
                className="apply"
                onClick={() => {
                  setSelectedColumns(pendingColumns);
                  setColumnsApplied(true);
                  setShowColumnMenu(false);
                }}
              >
                Apply
              </button>
            </div>
          )}
        </div>

        <div className="viewedItems">
          {isRangeView ? (
            <Suspense fallback={null}>
              <ViewedRecordsTable
                records={retrievedData}
                onViewRecord={handleViewRecordClick}
              />
            </Suspense>
          ) : (
            <Suspense fallback={null}>
              <ViewedItemsTable
                data={retrievedData}
                isDisabled={isDisabled}
                selectedColumns={columnsApplied ? selectedColumns : null}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

export default ViewStock;
