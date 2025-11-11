import "../styles/Dash.css";
import { useState, useEffect } from "react";
import Heading from "../components/Heading.jsx";
import Login from "../components/Login.jsx";
import "../styles/Home.css";
import axios from "axios";

function Home() {
  const [isHealthy, setIsHealthy] = useState(null);

  useEffect(() => {
    const checkHealth = async (attempt = 1) => {
      try {
        const res = await axios.get("http://localhost:8000/health/db");

        if (res.data.mysql === "ok") {
          setIsHealthy(true);
        } else {
          alert("Unexpected response from backend. Try restarting.");
          setIsHealthy(false);
        }
      } catch (err) {
        if (attempt < 4) {
          if (attempt === 1) {
            alert("Backend not responding. Trying again in 5 seconds.\nYou can also restart and reopen.");
          }

          setTimeout(() => {
            checkHealth(attempt + 1);
          }, 5000);
        } else {
          alert("Backend still not responding after multiple attempts.\nPlease restart your laptop and try again.");
          setIsHealthy(false);
        }
      }
    };

    checkHealth();
  }, []);

  return (
    isHealthy && (
      <div className="dashboard">
        <Heading name={"inventerogenesis"} />
        <div className="signupDash">
          <Login />
        </div>
      </div>
    )
  );
}

export default Home;
