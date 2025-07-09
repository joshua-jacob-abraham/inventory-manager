import React, { useContext, useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";
import axios from "axios";
import { BrandNameContext } from "../contexts/BrandNameContext.jsx";
import CircularLoader from "../components/CircularLoader.jsx";

const DropDown = lazy(() => import("../components/DropDown.jsx"));

const Login = () => {
  const [brands, setBrands] = useState([]);
  const [filteredBrands, setFilteredBrands] = useState([]);
  const [suggest, setSuggest] = useState(false);

  const { brandName, setBrandName } = useContext(BrandNameContext);

  useEffect(() => {
    setBrandName("");
    axios
      .get("http://localhost:8000/brands")
      .then((res) => {
        setBrands(res.data.brands);
        setFilteredBrands(res.data.brands);
      })
      .catch((err) => console.error(err));
  }, []);

  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const value = e.target.value;
    setBrandName(value);

    const filtered = brands.filter((brand) =>
      brand.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredBrands(filtered);
  };

  const handleSelectSuggestion = (selectedName) => {
    setBrandName(selectedName);
    setFilteredBrands([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedBrandName = brandName.trim();
    if (trimmedBrandName) {
      setBrandName(trimmedBrandName);
      console.log("Updated Brand Name:", trimmedBrandName);
    }
    console.log("Form submitted");
    navigate("/dash");
  };

  return (
    <div className="loginDash">
      <h1>Brand Name</h1>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <input
            type="text"
            id="brandName"
            name="brandName"
            value={brandName}
            className="formDat"
            onChange={handleInputChange}
            onFocus={() => setSuggest(true)}
            autoComplete="off"
            required
          />

          {suggest && brandName.trim() !== "" && (
            <Suspense fallback={<CircularLoader />}>
              <DropDown
                options={filteredBrands}
                onSelect={handleSelectSuggestion}
                className="brand-name-suggestions"
              />
            </Suspense>
          )}
        </div>

        <div className="submitSection">
          <button type="submit" className="submitbutton">
            Submit
          </button>
        </div>
      </form>
    </div>
  );
};

export default Login;
