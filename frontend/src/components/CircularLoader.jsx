import '../styles/CircularLoader.css';

const CircularLoader = ({ size = 40, color = '#3498db', thickness = 4 }) => {
  return (
    <div
      className="circular-loader"
      style={{
        width: size,
        height: size,
        borderWidth: thickness,
        borderColor: `${color} transparent ${color} transparent`,
      }}
    />
  );
};

export default CircularLoader;
