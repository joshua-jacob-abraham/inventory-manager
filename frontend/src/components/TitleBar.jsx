import "../styles/TitleBar.css";

import minimizeIcon from "../assets/minimize.svg";
import maximizeIcon from "../assets/square.svg";
import closeIcon from "../assets/close.svg";

const TitleBar = () => {
  const handleMinimize = () => {
    window.electron.minimize();
  };

  const handleMaximize = () => {
    window.electron.maximize();
  };

  const handleClose = () => {
    window.electron.close();
  };

  return (
    <div className="custom-titlebar">
      <div className="title">Inventory Manager</div>
      <div className="window-controls">
        <button onClick={handleMinimize}>
          <img className="minimize" src={minimizeIcon} alt="Minimize" />
        </button>
        <button onClick={handleMaximize}>
          <img src={maximizeIcon} alt="Maximize" />
        </button>
        <button onClick={handleClose}>
          <img src={closeIcon} alt="Close" />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
