import React, { createContext, useState, useEffect } from "react";

// Create the context
export const BrandNameContext = createContext();

// Create a provider component
export const BrandNameProvider = ({ children }) => {
  const [brandName, setBrandName] = useState(() => {
    return localStorage.getItem("brandName") || "inventerogenesis";
  });
  const [needsRefresh, setNeedsRefresh] = useState(false);

  useEffect(() => {
    localStorage.setItem("brandName", brandName);
  }, [brandName]);

  console.log("BrandNameProvider Value:", brandName);

  return (
    <BrandNameContext.Provider
      value={{ brandName, setBrandName, needsRefresh, setNeedsRefresh }}
    >
      {children}
    </BrandNameContext.Provider>
  );
};
