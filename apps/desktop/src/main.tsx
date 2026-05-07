import { createRoot } from "react-dom/client";
import { LangProvider } from "./i18n/index.js";
import { App } from "./App.js";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <LangProvider>
    <App />
  </LangProvider>,
);
