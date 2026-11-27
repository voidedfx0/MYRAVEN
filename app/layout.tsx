import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MYRAVEN — Money moves. Intelligence connects.",
  description:
    "A global intelligent payments and financial orchestration platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
