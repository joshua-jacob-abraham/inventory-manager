import { useState } from "react";
import menuIcon from "../assets/menu.svg";

import "../styles/Help.css";

const Help = () => {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="help">
      <button className="helpButton" onClick={() => setShowHelp(prev => !prev)}>
        <img src={menuIcon} alt="Help" />
      </button>

      {showHelp && (
        <div className="helpBox">
          <p>In the return/sales page, click return or sales to switch modes. Showing 'Return' implies it's in return mode and 'Sales' implies it's in sales mode.</p>
          <p>Click the brand name once to open the Dashboard, and double-click it to return to the Login page, but only if all fields are empty.</p>
          <button className="helpClose" onClick={() => setShowHelp(false)}>Close</button>
        </div>
      )}
    </div>
  );
};

export default Help;
