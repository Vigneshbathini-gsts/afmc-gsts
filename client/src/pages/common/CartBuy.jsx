import React from "react";
import { useLocation } from "react-router-dom";
import Pubmenubuy from "../attendant/Pubmenubuy";

export default function CartBuy() {
  const location = useLocation();
  const basePath = location.pathname.startsWith("/attendant") ? "/attendant" : "/user";
  return <Pubmenubuy backTo={`${basePath}/cart`} />;
}

