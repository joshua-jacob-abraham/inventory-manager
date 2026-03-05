import "../styles/Return.css";
import Heading from "../components/Heading.jsx";
import CheckboxSize from "../components/CheckboxSize.jsx";
import React, { useState, useContext, useEffect } from "react";
import { Suspense, lazy, useRef } from "react";
import { BrandNameContext } from "../contexts/BrandNameContext.jsx";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Loading from "../components/Loading.jsx";
import DropDown from "../components/DropDown.jsx";
import flowerImg from "../assets/flower.avif";
import dustbin from "../assets/dustbin.svg";

const SelectedReturn = lazy(() => import("../components/SelectedReturn.jsx"));

function ReturnStock() {
  const [fetchedReturnedDesigns, setFetchedReturnedDesigns] = useState([]);
  const navigate = useNavigate();

  const handleClick = () => {
    if (!data.storeName.trim()) {
      setFetchedReturnedDesigns([]);
      navigate("/dash");
    }
  };

  const handleDoubleClick = () => {
    if (!data.storeName.trim()) {
      navigate("/home");
    }
  };

  const inputRef = useRef(null);

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

  const handleClearAll = async () => {
    try {
      await axios.post("http://localhost:8000/clear/temp", null, {
        params: {
          store_key: data.storeKey,
        },
      });
      setFetchedReturnedDesigns([]);
    } catch (err) {
      console.error("Error clearing temp data:", err);
    }
  };

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

  const { brandName } = useContext(BrandNameContext);
  const [loading, setLoading] = useState(false);

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

  const handleAddCustomSize = () => {
    const size = parseInt(newSizeInput.trim(), 10);

    if (!isNaN(size) && !customSizes.includes(size.toString())) {
      setCustomSizes((prev) => [...prev, size.toString()]);
    }
    setNewSizeInput("");
    setAddingCustomSize(false);
  };

  const [data, setData] = useState({
    storeName: "",
    designCode: "",
    date: "",
    returnItems: [],
    storeKey: "",
    current_designs: [],
  });

  const [resetCheck, setReset] = useState(false);
  const [isSalesMode, setSalesMode] = useState(false);

  const handleSalesModeToggle = () => {
    setSalesMode((prevMode) => {
      const newMode = !prevMode;
      console.log(`Toggled Sales Mode: ${newMode}`);
      return newMode;
    });
  };

  const handleCheckboxChange = (id, values) => {
    const size = parseInt(id, 10);

    setData((prev) => {
      const existingItem = prev.returnItems.find((item) => item.size === size);
      let updatedReturnItems;

      if (existingItem) {
        updatedReturnItems = prev.returnItems.map((item) =>
          item.size === size ? { ...item, ...values } : item,
        );
      } else {
        updatedReturnItems = [...prev.returnItems, { size, ...values }];
      }

      const sanitizedItems = updatedReturnItems.map((item) => ({
        ...item,
        quantity: parseInt(item.quantity, 10) || 0,
      }));

      return {
        ...prev,
        returnItems: sanitizedItems,
      };
    });
  };

  const handleRemoveReturnItem = async (code) => {
    if (!data.storeKey) return;

    try {
      setLoading(true);
      const response = await axios.post(
        `http://localhost:8000/remove/temp/${code}`,
        null,
        {
          params: { store_key: data.storeKey },
        },
      );
      console.log(response.data.data);
      setFetchedReturnedDesigns(response.data.data);

      setData((prev) => ({
        ...prev,
        current_designs: response.data.data,
      }));
    } catch (error) {
      console.error(
        "Error removing return item:",
        error.response?.data || error.message,
      );
      alert("Failed to remove item.");
    } finally {
      setLoading(false);
    }
  };

  const [confirmed, setConfirmed] = useState(false);

  const handleAddItem = async () => {
    if (isAdding) return;

    if (!confirmed) {
      alert("Confirm design code, store-name, sizes and date before adding.");
      setConfirmed(true);
      return;
    }

    console.log(data.returnItems);
    console.log(data.storeName);
    console.log(data.designCode);

    if (
      !data.storeName.trim() ||
      !data.designCode.trim() ||
      !data.date.trim()
    ) {
      alert("Please fill in all the fields.");
      return; // Exit the function if any of the fields are empty
    }

    setIsAdding(true);
    document.querySelectorAll(".detail").forEach((input) => input.blur());
    console.log("Add button clicked");
    const validReturnItems = data.returnItems.filter((item) => {
      const isQuantityValid =
        item.quantity !== "" &&
        item.quantity !== 0 &&
        !isNaN(parseInt(item.quantity, 10));
      return isQuantityValid;
    });

    let newStoreKey = "";
    let updatedDesigns = [];

    for (let item of validReturnItems) {
      console.log(item);
    }

    for (let item of validReturnItems) {
      const completeDesignCode =
        item.size == 12
          ? `${data.designCode}-R`
          : `${data.designCode}-${item.size}`;
      const payload = {
        design_code: completeDesignCode,
        size: item.size == 12 ? "R" : item.size,
        quantity: parseInt(item.quantity, 10),
      };

      console.log(payload);

      const url = isSalesMode
        ? "http://localhost:8000/add/sales"
        : "http://localhost:8000/add/return";

      try {
        setLoading(true);
        const response = await axios.post(url, payload, {
          params: {
            store_name: data.storeName,
            date: data.date,
          },
        });

        const { store_key, current_designs } = response.data;

        newStoreKey = store_key;
        updatedDesigns = current_designs;
      } catch (error) {
        console.error(
          `Error adding ${isSalesMode ? "sales" : "return"} item:`,
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
      setFetchedReturnedDesigns(response.data.data); //Store designs from response
      console.log(fetchedReturnedDesigns);
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
      date: data.date,
      returnItems: validReturnItems,
      storeKey: newStoreKey,
      current_designs: updatedDesigns,
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

    setConfirmed(false);
    setIsAdding(false);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (fetchedReturnedDesigns.length === 0) {
      alert("Please add designs.");
      return;
    }

    setIsSubmitting(true);
    const action = isSalesMode ? "sales" : "return";
    let flag = 1;
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
      if (error.response?.data?.detail?.includes("1146 (42S02)")) {
        alert(
          "Shelf hasn't been created for this store. Add stocks to the shelf first.",
        );
        flag = 1;
      } else {
        alert("Failed to submit return details.");
        flag = 0;
      }
      setIsSubmitting(false);
    } finally {
      setLoading(false);
    }

    if (flag == 1) {
      setData({
        storeName: "",
        designCode: "",
        date: "",
        returnItems: [],
        storeKey: "",
        current_designs: [],
      });

      setFetchedReturnedDesigns([]);

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

  return (
    <div
      className="dashboard"
      style={{
        maxWidth: "1000px",
      }}
    >
      <Heading
        name={brandName}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />

      {loading && <Loading />}

      <div className="stock">
        <div
          style={{
            position: "relative",
            gridColumn: "span 1",
            display: "grid",
          }}
        >
          <input
            type="text"
            placeholder="Store name"
            className="details storeReturn"
            value={data.storeName}
            onChange={handleStoreNameInputChange}
            onFocus={() => setSuggest(true)}
          />

          {suggest && data.storeName.trim() !== "" && (
            <DropDown
              options={filteredStores}
              onSelect={handleSelectSuggestion}
              className="store-name-suggestions-return"
            />
          )}
        </div>

        <div className="container">
          <input
            type="text"
            placeholder="Code Base"
            className="details codeReturn"
            value={data.designCode}
            onChange={(e) => setData({ ...data, designCode: e.target.value })}
          />

          <button className="actionRet clearAll" onClick={handleClearAll}>
            <img className="dustbin" src={dustbin} alt="clearAll" />
          </button>
        </div>

        <input
          type="date"
          className="dateReturn"
          value={data.date}
          onChange={(e) => setData({ ...data, date: e.target.value })}
        />

        <div className="thesizesReturn">
          {sizes.map((size) => (
            <CheckboxSize
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

        <div className="flowerBox">
          <img
            src={flowerImg}
            alt="Flower"
            className="flower"
            draggable={false}
          />
        </div>

        <div className="theactionReturn">
          <button
            className="actionRet actReturn"
            onClick={handleAddItem}
            disabled={isAdding || loading}
          >
            Add
          </button>

          <button
            className="actionRet actSales"
            onClick={handleSalesModeToggle}
          >
            {isSalesMode ? "Sales" : "Return"}
          </button>

          <button
            className="actionRet submitReturn"
            onClick={handleSubmit}
            disabled={isSubmitting || loading}
          >
            Submit
          </button>
        </div>

        <div className="selectedItemsReturn">
          <Suspense fallback={null}>
            <SelectedReturn
              data={fetchedReturnedDesigns}
              onRemove={handleRemoveReturnItem}
            />
          </Suspense>
        </div>

        <div className="grayDiv"></div>
      </div>
    </div>
  );
}

export default ReturnStock;
