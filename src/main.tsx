// Initialize theme before render to prevent flash
const savedTheme = localStorage.getItem("app-theme") || "dark";
const resolved = savedTheme === "auto"
  ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  : savedTheme;
if (resolved === "dark") document.documentElement.classList.add("dark");
else document.documentElement.classList.remove("dark");

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
