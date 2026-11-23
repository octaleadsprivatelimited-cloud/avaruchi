import { FaWhatsapp } from "react-icons/fa";
import { useLocation } from "@/lib/navigation";
import { useStorefrontConfig } from "@/lib/storefront-config";
import { whatsappChatHref } from "../../../commerce-api/src/whatsapp-link";
import "./floating-whatsapp.css";

export function FloatingWhatsApp() {
  const { whatsappUrl } = useStorefrontConfig();
  const { pathname } = useLocation();
  const href = whatsappChatHref(whatsappUrl);
  if (!href || /^\/(?:cart|checkout|login|track|transaction)(?:\/|$)/.test(pathname)) return null;

  return (
    <a
      className="store-whatsapp"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp (opens in a new tab)"
    >
      <FaWhatsapp aria-hidden="true" focusable="false" />
      <span>WhatsApp</span>
    </a>
  );
}
