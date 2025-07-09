import React, { Suspense, lazy } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { BrandNameProvider } from "./contexts/BrandNameContext.jsx";
import TitleBar from "./components/TitleBar.jsx";
import CircularLoader from "./components/CircularLoader.jsx";

const Dash = lazy(() => import("./Pages/Dash.jsx"));
const NewStock = lazy(() => import("./Pages/New.jsx"));
const ReturnStock = lazy(() => import("./Pages/Return.jsx"));
const ViewStock = lazy(() => import("./Pages/View.jsx"));
const Home = lazy(() => import("./Pages/Home.jsx"));

function App() {
  return (
    <BrandNameProvider>
      <TitleBar />

      <Router>
        <Suspense fallback={<CircularLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/dash" element={<Dash />} />
            <Route path="/add-new" element={<NewStock />} />
            <Route path="/add-returned" element={<ReturnStock />} />
            <Route path="/view" element={<ViewStock />} />
          </Routes>
        </Suspense>
      </Router>
    </BrandNameProvider>
  );
}

export default App;
