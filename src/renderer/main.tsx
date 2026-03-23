import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Allow the GPU process to warm up and first paint to settle before
// enabling animations. requestAnimationFrame fires after paint, so
// two nested calls ensure at least one full frame has been composited.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.documentElement.classList.add("app-ready");
  });
});
