import "../styles/Return.css";
import Heading from "../components/Heading.jsx";
import CheckboxSize from "../components/CheckboxSize.jsx";
import React, { useState, useContext, useEffect } from "react";
import SelectedReturn from "../components/SelectedReturn.jsx";
import { BrandNameContext } from "../contexts/BrandNameContext.jsx";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Loading from "../components/Loading.jsx";
import DropDown from "../components/DropDown.jsx";
import flowerImg from "../assets/flower.avif";

let fetchedReturnedDesigns = [];

function ReturnStock() {
  const navigate = useNavigate();

  const handleClick = () => {
    if (!data.storeName.trim()) {
      navigate("/dash");
    }
  };

  const handleDoubleClick = () => {
    if (!data.storeName.trim()) {
      navigate("/home");
    }
  };

  const [stores, setStores] = useState([]);
  const [filteredStores, setFilteredStores] = useState([]);
  const [suggest, setSuggest] = useState(false);

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
      store.toLowerCase().includes(value.toLowerCase())
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
  const sizes = ["12", "14", "16", "18", "20", "22", "24", "26", "28", "30"];
  const [loading, setLoading] = useState(false);

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
          item.size === size ? { ...item, ...values } : item
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
        }
      );
      fetchedReturnedDesigns = response.data.data;

      setData((prev) => ({
        ...prev,
        current_designs: response.data.data,
      }));
    } catch (error) {
      console.error(
        "Error removing return item:",
        error.response?.data || error.message
      );
      alert("Failed to remove item.");
    } finally {
      setLoading(false);
    }
  };

  const [confirmed, setConfirmed] = useState(false);

  const handleAddItem = async () => {
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
          ? `${data.designCode}R`
          : `${data.designCode}${item.size}`;
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
          error.response?.data || error.message
        );
      } finally {
        setLoading(false);
      }
    }

    try {
      setLoading(true);
      const response = await axios.get(
        `http://localhost:8000/view/${newStoreKey}`
      );
      fetchedReturnedDesigns = response.data.data; //Store designs from response
      console.log(fetchedReturnedDesigns);
    } catch (error) {
      console.error(
        "Error fetching stock designs:",
        error.response?.data || error.message
      );
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
  };

  const handleSubmit = async () => {
    if (fetchedReturnedDesigns.length === 0) {
      alert("Please add designs.");
      return;
    }

    const action = isSalesMode ? "sales" : "return";
    let flag = 1;
    try {
      setLoading(true);
      const response = await axios.post(
        `http://localhost:8000/submit/${encodeURIComponent(
          brandName
        )}/${action}`,
        null,
        {
          params: {
            store_name: data.storeName,
            date: data.date,
          },
        }
      );

      console.log("Submission Response:", response.data);
      alert(
        response.data.message + ". You will be redirected to the view page." ||
          "Submission successful!"
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
        error.response?.data || error.message
      );
      if (error.response?.data?.detail?.includes("1146 (42S02)")) {
        alert(
          "Shelf hasn't been created for this store. Add stocks to the shelf first."
        );
        flag = 1;
      } else {
        alert("Failed to submit return details.");
        flag = 0;
      }
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

      fetchedReturnedDesigns = [];

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
  };

  return (
    <div className="dashboard">
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

        <input
          type="text"
          placeholder="Code Base"
          className="details codeReturn"
          value={data.designCode}
          onChange={(e) => setData({ ...data, designCode: e.target.value })}
        />
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
          <button className="actionRet actReturn" onClick={handleAddItem}>
            Add
          </button>

          <button
            className="actionRet actSales"
            onClick={handleSalesModeToggle}
          >
            {isSalesMode ? "Sales" : "Return"}
          </button>

          <button className="actionRet submitReturn" onClick={handleSubmit}>
            Submit
          </button>
        </div>

        <div className="selectedItemsReturn">
          <SelectedReturn
            data={fetchedReturnedDesigns}
            onRemove={handleRemoveReturnItem}
          />
        </div>

        <div className="grayDiv"></div>
      </div>
    </div>
  );
}

export default ReturnStock;
