import { useState, useEffect } from "react";

export const useDeliveryAddressMode = () => {
  const [mode, setMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("deliveryAddressMode") || "saved";
    }
    return "saved";
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setMode(localStorage.getItem("deliveryAddressMode") || "saved");
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("deliveryAddressModeChanged", handleStorageChange);
    window.addEventListener("userLocationUpdated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("deliveryAddressModeChanged", handleStorageChange);
      window.removeEventListener("userLocationUpdated", handleStorageChange);
    };
  }, []);

  return mode;
};
