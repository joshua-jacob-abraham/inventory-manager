import "../styles/New.css";
import { useNavigate } from "react-router-dom";
import React, { useState, useContext, useEffect, useRef } from "react";
import Heading from "../components/Heading.jsx";
import Checkbox from "../components/Checkbox.jsx";
import { Suspense, lazy } from "react";
import axios from "axios";
import CheckGST from "../components/CheckGST.jsx";
import { BrandNameContext } from "../contexts/BrandNameContext.jsx";
import Loading from "../components/Loading.jsx";
import DropDown from "../components/DropDown.jsx";
import dustbin from "../assets/dustbin.svg";
import plus from "../assets/plus.svg";

const SelectedItemsTable = lazy(() => import("../components/Selected.jsx"));

function NewStock() {
  const navigate = useNavigate();
  const [fetchedDesigns, setFetchedDesigns] = useState([]);

  const handleClick = () => {
    if (!data.storeName.trim()) {
      setFetchedDesigns([]);
      navigate("/dash");
    }
  };

  const handleDoubleClick = () => {
    if (!data.storeName.trim()) {
      navigate("/home");
    }
  };

  const { brandName } = useContext(BrandNameContext);
  const inputRef = useRef(null);
  const inputFieldRef = useRef(null);

  const [stores, setStores] = useState([]);
  const [filteredStores, setFilteredStores] = useState([]);
  const [suggest, setSuggest] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addingCustomSize, setAddingCustomSize] = useState(false);

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
    setData((prevData) => ({
      ...prevData,
      storeName: value,
    }));

    const filtered = stores.filter((store) =>
      store.toLowerCase().includes(value.toLowerCase()),
    );
    setFilteredStores(filtered);
  };

  const handleSelectSuggestion = (selectedName) => {
    setData((prevData) => ({
      ...prevData,
      storeName: selectedName,
    }));
    setFilteredStores([]);
  };

  const defaultSizes = [
    "12",
    "14",
    "16",
    "18",
    "20",
    "22",
    "24",
    "26",
    "28",
    "30",
  ];
  const [customSizes, setCustomSizes] = useState([]);
  const sizes = [...new Set([...defaultSizes, ...customSizes])];
  const [newSizeInput, setNewSizeInput] = useState("");
  const [newFieldInput, setNewFieldInput] = useState("");

  const handleAddCustomSize = () => {
    const size = parseInt(newSizeInput.trim(), 10);

    if (!isNaN(size) && !customSizes.includes(size.toString())) {
      setCustomSizes((prev) => [...prev, size.toString()]);
    }
    setNewSizeInput("");
    setAddingCustomSize(false);
  };

  const handleAddCustomField = () => {
    const value = newFieldInput.trim();
    const formatted = value.charAt(0).toUpperCase() + value.slice(1);

    if (
      formatted !== "" &&
      !customFields.some(
        (field) => field.name.toLowerCase() === formatted.toLowerCase(),
      )
    ) {
      setCustomFields((prev) => [...prev, { name: formatted, value: "" }]);
    }
    setNewFieldInput("");
    setAddingCustomField(false);
  };

  const handleCustomFieldChange = (index, value) => {
    setCustomFields((prev) =>
      prev.map((field, i) => (i === index ? { ...field, value } : field)),
    );
  };

  const [loading, setLoading] = useState(false);

  const [data, setData] = useState({
    storeName: "",
    designCode: "",
    item: "",
    date: "",
    stockItems: [],
    storeKey: "",
    current_designs: [],
    gstApplicable: false,
  });

  const [addingCustomField, setAddingCustomField] = useState(false);
  const showAddCustomFieldInput = () => {
    setAddingCustomField(true);
    setTimeout(() => {
      inputFieldRef.current?.focus();
    }, 0);
  };

  const [resetCheck, setReset] = useState(false);

  const recalculateGST = (stockItems, gstApplicable) => {
    return stockItems.map((item) => {
      const gst_rate = gstApplicable ? (item.price < 2500 ? 5 : 12) : 0;

      const taxable_amount =
        gst_rate > 0 ? item.price / (1 + gst_rate / 100) : item.price;
      const tax_amount = item.price - taxable_amount;

      return {
        ...item,
        gst_rate,
        gst_applicable: gstApplicable,
        taxable_amount: parseFloat(taxable_amount.toFixed(2)),
        tax_amount: parseFloat(tax_amount.toFixed(2)),
      };
    });
  };

  const handleCheckboxChange = (id, values) => {
    const size = parseInt(id, 10);

    setData((prev) => {
      const existingItem = prev.stockItems.find((item) => item.size === size);
      let updatedStockItems;

      if (existingItem) {
        updatedStockItems = prev.stockItems.map((item) =>
          item.size === size ? { ...item, ...values } : item,
        );
      } else {
        updatedStockItems = [...prev.stockItems, { size, ...values }];
      }

      const sanitizedItems = updatedStockItems.map((item) => ({
        ...item,
        price: parseFloat(item.price) || 0,
        quantity: parseInt(item.quantity, 10) || 0,
      }));

      // Recalculate GST after adding/updating stock item
      return {
        ...prev,
        stockItems: recalculateGST(sanitizedItems, prev.gstApplicable),
      };
    });
  };

  const updateGSTForStockItems = (isGSTApplicable) => {
    setData((prev) => ({
      ...prev,
      gstApplicable: isGSTApplicable,
      stockItems: recalculateGST(prev.stockItems, isGSTApplicable),
    }));
  };

  const handleRemoveDesign = async (designCode) => {
    try {
      const res = await axios.post(
        `http://localhost:8000/remove/temp/${encodeURIComponent(designCode)}`,
        null,
        {
          params: {
            store_key: data.storeKey,
          },
        },
      );
      setFetchedDesigns(res.data.data);
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to remove the design.");
      console.error(err);
    }
  };

  const handleClearAll = async () => {
    try {
      await axios.post("http://localhost:8000/clear/temp", null, {
        params: {
          store_key: data.storeKey,
        },
      });
      setFetchedDesigns([]);
    } catch (err) {
      console.error("Error clearing temp data:", err);
    }
  };

  const [confirmed, setConfirmed] = useState(false);

  const handleAddStockItem = async () => {
    if (isAdding) return;
    if (!confirmed) {
      alert("Confirm design code, store-name, sizes and date before adding.");
      setConfirmed(true);
      return;
    }

    if (
      !data.storeName.trim() ||
      !data.designCode.trim() ||
      !data.date.trim() ||
      !data.item.trim()
    ) {
      alert("Please fill in all the fields.");
      return; // Exit the function if any of the fields are empty
    }

    setIsAdding(true);
    document.querySelectorAll(".detail").forEach((input) => input.blur());

    console.log("Add button clicked");

    const validStockItems = data.stockItems.filter((item) => {
      const isPriceValid =
        item.price !== "" && item.price !== 0 && !isNaN(parseFloat(item.price));
      const isQuantityValid =
        item.quantity !== "" &&
        item.quantity !== 0 &&
        !isNaN(parseInt(item.quantity, 10));
      return isPriceValid && isQuantityValid;
    });

    let newStoreKey = "";
    let updatedDesigns = [];

    for (let item of validStockItems) {
      console.log(item);
    }

    for (let item of validStockItems) {
      const completeDesignCode =
        item.size == 12
          ? `${data.designCode}-R`
          : `${data.designCode}-${item.size}`;

      const capitalizedItem =
        data.item.charAt(0).toUpperCase() + data.item.slice(1).toLowerCase();
      const upperDesignCode = completeDesignCode.toUpperCase();

      const payload = {
        item: capitalizedItem,
        design_code: upperDesignCode,
        size: item.size == 12 ? "R" : item.size,
        price: parseFloat(item.price),
        quantity: parseInt(item.quantity, 10),
        gst_applicable: item.gst_applicable || false,
        gst_rate: item.gst_rate || 0,
        hsn_code: item.hsn_code || "62092000",
        taxable_amount: item.taxable_amount || null,
        tax_amount: item.tax_amount || 0,
      };

      console.log(payload);

      try {
        setLoading(true);
        const response = await axios.post(
          "http://localhost:8000/add/new",
          payload,
          {
            params: {
              store_name: data.storeName,
              date: data.date,
            },
          },
        );

        const { store_key, current_designs } = response.data;

        newStoreKey = store_key;
        updatedDesigns = current_designs;
      } catch (error) {
        console.error(
          "Error adding stock item:",
          error.response?.data || error.message,
        );
        setIsAdding(false);
      } finally {
        setLoading(false);
      }
    }

    try {
      setLoading(true);
      const response = await axios.get(
        `http://localhost:8000/view/${newStoreKey}`,
      );
      setFetchedDesigns(response.data.data);
    } catch (error) {
      console.error(
        "Error fetching stock designs:",
        error.response?.data || error.message,
      );
      setIsAdding(false);
    } finally {
      setLoading(false);
    }

    setData({
      storeName: data.storeName,
      designCode: "",
      item: "",
      date: data.date,
      stockItems: validStockItems,
      storeKey: newStoreKey,
      current_designs: updatedDesigns,
      gstApplicable: data.gstApplicable,
    });

    document
      .querySelectorAll('.box .checkbox-wrapper-52 input[type="checkbox"]')
      .forEach((checkbox) => {
        checkbox.checked = false;
      });

    setReset(true);

    setTimeout(() => {
      setReset(false);
    }, 0);

    setIsAdding(false);
    setConfirmed(false);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (fetchedDesigns.length === 0) {
      alert("Please add designs.");
      return;
    }

    setIsSubmitting(true);
    let submissionSuccessful = false;
    const action = "new";

    try {
      setLoading(true);
      const response = await axios.post(
        `http://localhost:8000/submit/${encodeURIComponent(
          brandName,
        )}/${action}`,
        null,
        {
          params: {
            store_name: data.storeName,
            date: data.date,
          },
        },
      );

      console.log("Submission Response:", response.data);
      alert(
        response.data.message + ". You will be redirected to the view page." ||
          "Submission successful!",
      );

      submissionSuccessful = true;

      navigate("/view", {
        state: {
          store_name: data.storeName,
          date: data.date,
          action: action,
          autoFetch: true,
        },
      });
    } catch (error) {
      console.error(
        "Error submitting data:",
        error.response?.data || error.message,
      );
      alert("Failed to submit stock details.");
      setIsSubmitting(false);
    } finally {
      setLoading(false);
    }

    if (submissionSuccessful) {
      setData({
        storeName: "",
        designCode: "",
        item: "",
        date: "",
        stockItems: [],
        storeKey: "",
        current_designs: [],
        gstApplicable: false,
      });

      setFetchedDesigns([]);

      document
        .querySelectorAll('.box .checkbox-wrapper-52 input[type="checkbox"]')
        .forEach((checkbox) => {
          checkbox.checked = false;
        });

      setReset(true);

      setTimeout(() => {
        setReset(false);
      }, 0);
    }

    setIsSubmitting(false);
  };

  const [customFields, setCustomFields] = useState([]);

  const baseRow = 3;
  const visibleFields = customFields.length + (addingCustomField ? 1 : 0);
  const change = Math.ceil(visibleFields / 3);
  const tableRowStart = baseRow + change;

  const isShowable = (visibleFields) % 3 != 0;

  return (
    <div className="dashboard">
      <Heading
        name={brandName}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />

      {loading && <Loading />}

      <div className="newstock">
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
            className="details store"
            value={data.storeName}
            onChange={handleStoreNameInputChange}
            onFocus={() => setSuggest(true)}
          />

          {suggest && data.storeName.trim() !== "" && (
            <DropDown
              options={filteredStores}
              onSelect={handleSelectSuggestion}
              className="store-name-suggestions"
            />
          )}
        </div>

        <input
          type="text"
          placeholder="Design Code Base"
          className="details code"
          value={data.designCode}
          onChange={(e) => setData({ ...data, designCode: e.target.value })}
        />

        <div className="container">
          <input
            type="text"
            placeholder="Item"
            className="details itemtype"
            value={data.item}
            onChange={(e) => setData({ ...data, item: e.target.value })}
          />

          <button className="action clearAll" onClick={handleClearAll}>
            <img className="dustbin" src={dustbin} alt="clearAll" />
          </button>
        </div>

        <div className="dateCustomField">
          <input
            type="date"
            className="date"
            value={data.date}
            onChange={(e) => setData({ ...data, date: e.target.value })}
          />

          <button
            className="action addCustomFieldButton"
            onClick={showAddCustomFieldInput}
          >
            <img className="plus" src={plus} alt="addCustomField" />
          </button>
        </div>

        <CheckGST
          checked={data.gstApplicable}
          onChange={(isChecked) => updateGSTForStockItems(isChecked)}
        />

        <div className="sizeAction">
          <div className="thesizes">
            {sizes.map((size) => (
              <Checkbox
                key={size}
                id={size}
                label={size == 12 ? `R` : `${size}"`}
                reset={resetCheck}
                onChange={handleCheckboxChange}
              />
            ))}

            {!addingCustomSize && (
              <div
                className="addCustomSize"
                onClick={() => {
                  setAddingCustomSize(true);
                  setTimeout(() => {
                    inputRef.current?.focus();
                  }, 0);
                }}
              >
                <p style={{ padding: 0, margin: 0, cursor: "pointer" }}>+</p>
              </div>
            )}

            {addingCustomSize && (
              <div className="customSizeInputContainer">
                <div className="customSizeInputDeco"></div>

                <div className="customSizeInputDiv">
                  <input
                    className="customSizeInput"
                    type="text"
                    ref={inputRef}
                    placeholder="Size"
                    value={newSizeInput}
                    onChange={(e) => setNewSizeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddCustomSize();
                      if (e.key === "Escape") setAddingCustomSize(false);
                    }}
                  />
                </div>

                <button
                  className="customSizeInputAddButton"
                  onClick={handleAddCustomSize}
                >
                  +
                </button>
              </div>
            )}
          </div>

          <div className="theaction">
            <button
              className="action actAdd"
              onClick={handleAddStockItem}
              disabled={isAdding || loading}
            >
              Add
            </button>

            <button
              className="action actSubmit"
              onClick={handleSubmit}
              disabled={isSubmitting || loading}
            >
              Submit
            </button>
          </div>
        </div>

        {/* Sanitize field to remove spaces when using later */}
        {customFields.map((field, i) => (
          <input
            key={field.name}
            className="customField"
            placeholder={field.name}
            value={field.value}
            onChange={(e) => handleCustomFieldChange(i, e.target.value)}
          />
        ))}

        {addingCustomField && (
          <div className="customSizeInputContainer">
            <div className="customSizeInputDiv">
              <input
                className="customSizeInput customFieldInput"
                type="text"
                ref={inputFieldRef}
                placeholder="New Field"
                value={newFieldInput}
                onChange={(e) => setNewFieldInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCustomField();
                  if (e.key === "Escape") {
                    setNewFieldInput("");
                    setAddingCustomField(false);
                  }
                }}
              />
            </div>

            <button
              className="customSizeInputAddButton customFieldInputAddButton"
              onClick={handleAddCustomField}
            >
              +
            </button>
          </div>
        )}

        {isShowable && (
          <div
            className="customFieldInputDeco"
            style={{
              gridRow: `${tableRowStart - 1}`,
              gridColumn: `${((visibleFields % 3) + 1)} / span ${3 - (visibleFields % 3)}`,
            }}
          ></div>
        )}

        <div
          className="selectedItems"
          style={{ gridRow: `${tableRowStart} / span ${9 - change}` }}
        >
          <Suspense fallback={null}>
            <SelectedItemsTable
              data={fetchedDesigns}
              onRemove={handleRemoveDesign}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default NewStock;
