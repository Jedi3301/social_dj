import type { Metadata } from "next";
import { ThemeInit } from "@/components/ThemeInit";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social — Connect & Share",
  description: "Join Social, the modern platform to connect, share, and discover people who matter to you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeInit />
        {children}
      </body>
    </html>
  );
}
