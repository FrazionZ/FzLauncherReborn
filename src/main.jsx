import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { dirname, join, resolve } from '@tauri-apps/api/path';

let keyCodeLangStore = 'fr';

ReactDOM.createRoot(document.getElementById("root")).render(
  <App />,
);
