import "../styles/DropDown.css";

function DropDown({ options, onSelect, className = "" }) {
  if (!options || options.length === 0) return null;

  console.log(options);

  return (
    <div className={`${className}`}>
      {options.map((opt, index) => (
        <div key={index} className="suggestion-card" onClick={() => onSelect(opt)}>
          {opt}
        </div>
      ))}
    </div>
  );
}

export default DropDown;
