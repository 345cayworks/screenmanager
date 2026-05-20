import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "OptiSigns Client Playlist Portal",
  description: "Cayworks Display Manager — controlled OptiSigns playlist editing for client portfolios.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
