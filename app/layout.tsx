import type { Metadata } from "next";
import "./globals.css";
import Storefront from "./storefront";

export const metadata: Metadata = {
  title: {
    default: "Avaruchi | A little pickle. A lot of home.",
    template: "%s | Avaruchi",
  },
  description:
    "Explore Avaruchi's pickle collection. Shop flavours, build your basket, and follow every order.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
