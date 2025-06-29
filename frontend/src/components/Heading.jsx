import "../styles/Heading.css";
import Help from "../components/Help.jsx";

function Heading({ name, onClick, onDoubleClick}) {
  return (
    <>
      <div
        className="brand"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        {name}
      </div>

      <Help/>
    </>
  );
}

export default Heading;
