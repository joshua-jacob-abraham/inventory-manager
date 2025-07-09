import "../styles/Dash.css";
import { useState, useEffect } from "react";
import Heading from "../components/Heading.jsx";
import Login from "../components/Login.jsx";
import "../styles/Home.css";
import axios from "axios";

function Home() {
  const [isHealthy, setIsHealthy] = useState(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await axios.get("http://localhost:8000/health/db");

        if (res.data.mysql === "ok") {
          setIsHealthy(true);
        } else {
          alert("Unexpected response from backend. Try restarting.");
          setIsHealthy(false);
        }
      } catch (err) {
        if (err.response) {
          // Server responded with an error.
          alert(`DB issue: ${err.response.data.error || "Unknown error"}`);
        } else {
          // No response.
          alert("Backend not responding. Please restart the app.");
        }
        setIsHealthy(false);
      }
    };

    checkHealth();
  }, []);

  return (
    isHealthy && (
      <div className="dashboard">
        <Heading name={"inventerogenesis"} />
        <div className="signupDash">
          <Login/>
        </div>
      </div>
    )
  );
}

export default Home;
