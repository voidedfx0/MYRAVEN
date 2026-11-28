import type { Metadata } from "next";
import "./globals.css";
import NotificationListener from "@/components/notification-listener";
import GlobalBackButton from "@/components/global-back-button";

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
      <body>
        {children}
        <NotificationListener />
        <GlobalBackButton />
      </body>
    </html>
  );
}
