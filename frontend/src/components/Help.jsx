import { useState, useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";
import menuIcon from "../assets/menu.svg";
import axios from "axios";
import { BrandNameContext } from "../contexts/BrandNameContext.jsx";
import CircularLoader from "../components/CircularLoader.jsx";

import "../styles/Help.css";

const Help = () => {
  const location = useLocation();
  const [atHome, setAtHome] = useState(false);
  const [atDash, setAtDash] = useState(false);
  const [atNewOrReturn, setAtNewOrReturn] = useState(false);

  useEffect(() => {
    setAtHome(location.pathname === "/home");
    setAtDash(location.pathname === "/dash");
    setAtNewOrReturn(
      location.pathname === "/add-new" || location.pathname === "add-returned"
    );
  }, [location.pathname]);

  const [loading, setLoading] = useState(false);

  const [showHelp, setShowHelp] = useState(false);
  const [renameBrand, setRenameBrand] = useState(false);
  const [renameStore, setRenameStore] = useState(false);
  const [renameMode, setRenameMode] = useState(false);

  const [oldBrand, setOldBrand] = useState("");
  const [newBrand, setNewBrand] = useState("");

  const { brandname, setBrandName, setNeedsRefresh } = useContext(BrandNameContext);

  const [oldStore, setOldStore] = useState("");
  const [newStore, setNewStore] = useState("");

  const handleSubmit = async () => {
    if (renameBrand) {
      if (!oldBrand.trim() || !newBrand.trim()) {
        alert("Both old and new brand names are required.");
        return;
      }

      try {
        setLoading(true);
        const res = await axios.post(
          "http://localhost:8000/alter/brandname",
          null,
          {
            params: {
              old_name: oldBrand,
              new_name: newBrand,
            },
          }
        );

        if (oldBrand == brandname) {
          setBrandName(newBrand.trim());
        }
        
        setNeedsRefresh(true);
        setLoading(false);

        setTimeout(() => {
          alert(res.data.message);
        }, 0);

        setRenameMode(false);
        setRenameBrand(false);

        setOldBrand("");
        setNewBrand("");
      } catch (err) {
        alert(err.response?.data?.detail || "Something went wrong.");
        setLoading(false);
      }
    }
  };

  return (
    <div className="help">
      <button
        className="helpButton"
        onClick={() => setShowHelp((prev) => !prev)}
      >
        {loading ? (
          <CircularLoader size={20} color="#580303" thickness={2} />
        ) : (
          <img src={menuIcon} alt="Help" />
        )}
      </button>

      {showHelp && (
        <div className="helpBox">
          {atNewOrReturn && (
            <p>
              In the return/sales page, click return or sales to switch modes.
              Showing 'Return' implies it's in return mode and 'Sales' implies
              it's in sales mode.
            </p>
          )}
          <p>
            Click the brand name once to open the Dashboard, and double-click it
            to return to the Login page, but only if all fields are empty.
          </p>

          {atNewOrReturn && (
            <p>
              To correct any mistakes, simply reuse the same code with the right
              details. You can also submit now and add more stocks later if
              needed.
            </p>
          )}

          {!atNewOrReturn && (
            <p>
              Brand name can only be changed from the home page, while store
              name changes must be made from the dashboard.
            </p>
          )}

          {renameBrand && (
            <div className="brandRename renameBox">
              <input
                className="names"
                placeholder="Old Brand Name"
                onChange={(e) => {
                  setOldBrand(e.target.value);
                }}
              ></input>
              <input
                className="names"
                placeholder="New Brand Name"
                onChange={(e) => {
                  setNewBrand(e.target.value);
                }}
              ></input>
            </div>
          )}

          {renameStore && (
            <div className="storeRename renameBox">
              <input className="names" placeholder="Old Store Name"></input>
              <input className="names" placeholder="New Store Name"></input>
            </div>
          )}

          {!renameMode && atHome && (
            <button
              className="renameButton"
              onClick={() => {
                setRenameMode(true);
                setRenameBrand(true);
              }}
            >
              Change brandname
            </button>
          )}
          {!renameMode && atDash && (
            <button
              className="renameButton"
              onClick={() => {
                setRenameMode(true);
                setRenameStore(true);
              }}
            >
              Change storename
            </button>
          )}

          {renameMode && (
            <button className="renameButton" onClick={handleSubmit}>
              Submit
            </button>
          )}

          <button
            className="helpClose"
            onClick={() => {
              setShowHelp(false);
              setRenameMode(false);
              setRenameBrand(false);
              setRenameStore(false);
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default Help;
