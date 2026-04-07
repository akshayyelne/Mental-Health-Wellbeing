import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soulora — Recenter your Soul",
  description: "Mindful living & holistic care powered by AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
