import "../styles/Dash.css";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import Heading from "../components/Heading.jsx";
import { BrandNameContext } from "../contexts/BrandNameContext.jsx";

function Dash() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate("/dash");
  };

  const handleDoubleClick = () => {
    navigate("/home");
  };

  const { brandName } = useContext(BrandNameContext);

  console.log("Dash Page Brand Name:", brandName);

  return (
    <div className="dashboard">
      <Heading
        name={brandName}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />

      <div className="accessibility">
        <button className="thebutton new" onClick={() => navigate("/add-new")}>
          Add New Stock
        </button>
        <button
          className="thebutton return"
          onClick={() => navigate("/add-returned")}
        >
          Add Return/Sales
        </button>
        <button className="thebutton view" onClick={() => navigate("/view")}>
          View Saved Stock
        </button>
      </div>
    </div>
  );
}

export default Dash;
