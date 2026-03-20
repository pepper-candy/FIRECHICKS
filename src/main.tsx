import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAssetServiceWorker } from "@/lib/registerAssetServiceWorker";

registerAssetServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
