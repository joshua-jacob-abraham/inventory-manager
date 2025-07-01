import { useState, useContext } from "react";
import menuIcon from "../assets/menu.svg";
import axios from "axios";
import { BrandNameContext } from "../contexts/BrandNameContext.jsx";

import "../styles/Help.css";

const Help = () => {
  const [showHelp, setShowHelp] = useState(false);
  const [renameBrand, setRenameBrand] = useState(false);
  const [renameStore, setRenameStore] = useState(false);
  const [renameMode, setRenameMode] = useState(false);

  const [oldBrand, setOldBrand] = useState("");
  const [newBrand, setNewBrand] = useState("");

  const { brandname, setBrandName } = useContext(BrandNameContext);

  const [oldStore, setOldStore] = useState("");
  const [newStore, setNewStore] = useState("");

  const handleSubmit = async () => {
    if (renameBrand) {
      if (!oldBrand.trim() || !newBrand.trim()) {
        alert("Both old and new brand names are required.");
        return;
      }

      try {
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

        alert(res.data.message);

        setRenameMode(false);
        setRenameBrand(false);
        setOldBrand("");
        setNewBrand("");
      } catch (err) {
        alert(err.response?.data?.detail || "Something went wrong.");
      }
    }
  };

  return (
    <div className="help">
      <button
        className="helpButton"
        onClick={() => setShowHelp((prev) => !prev)}
      >
        <img src={menuIcon} alt="Help" />
      </button>

      {showHelp && (
        <div className="helpBox">
          <p>
            In the return/sales page, click return or sales to switch modes.
            Showing 'Return' implies it's in return mode and 'Sales' implies
            it's in sales mode.
          </p>
          <p>
            Click the brand name once to open the Dashboard, and double-click it
            to return to the Login page, but only if all fields are empty.
          </p>

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

          {!renameMode && (
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
          {!renameMode && (
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
