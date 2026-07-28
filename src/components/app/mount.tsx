import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/App";

export async function mountApp(): Promise<void> {
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing #root element");
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
