import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import type { StoreBootstrap } from "./lib/store-data";
import "./styles.css";
import "./feature-fixes.css";
import "./portal-nav-fix.css";
import "./commerce-growth.css";
import "./auth-growth.css";
import "./upload.css";
import "./customer-operations.css";
import "./mobile-commerce.css";
import "./analytics-consent.css";
import "./product-detail.css";
import "./branding-settings.css";
import "./home-delivery.css";
import "./avaruchi-reference.css";
import "./avaruchi-adaptations.css";
import "./catalog-navigation.css";

declare global {
  interface Window {
    __AVARUCHI_BOOTSTRAP__?: StoreBootstrap;
  }
}
const root = document.getElementById("root")!;
const app = (
  <BrowserRouter>
    <App bootstrap={window.__AVARUCHI_BOOTSTRAP__} />
  </BrowserRouter>
);
if (window.__AVARUCHI_BOOTSTRAP__) hydrateRoot(root, app);
else createRoot(root).render(app);
