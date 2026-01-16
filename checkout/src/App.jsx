import { Routes, Route, BrowserRouter } from "react-router-dom";
import Checkout from "./pages/Checkout";
import Success from "./pages/Success";
import Failure from "./pages/Failure";
import "./sdk/styles.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/success" element={<Success />} />
        <Route path="/failure" element={<Failure />} />
        <Route path="/" element={<Checkout />} />
      </Routes>
    </BrowserRouter>
  );
}
