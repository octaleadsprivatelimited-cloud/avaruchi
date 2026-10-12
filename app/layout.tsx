import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import "./globals.css";
import Storefront from "./storefront";

export const metadata: Metadata = {
  title: {
    default: "Avaruchi | ప్రతి ముద్దలో తెలుగు సంప్రదాయం",
    template: "%s | Avaruchi",
  },
  description:
    "Avaruchi by Lakshmis Tapasi Treats, established in 2026 in Ramanthapur, Hyderabad. ప్రతి ముద్దలో తెలుగు సంప్రదాయం. Shop pickles and follow your orders.",
  icons: {
    icon: BRAND.logoIcon,
    shortcut: BRAND.logoIcon,
    apple: BRAND.logoIcon,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Storefront>{children}</Storefront>
      </body>
    </html>
  );
}
