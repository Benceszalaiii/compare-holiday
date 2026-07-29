import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nyaraláshasonlító",
  description:
    "Privát kutatófelület nyaralási úti célok teljes költség szerinti összehasonlításához.",
};

export const viewport: Viewport = {
  themeColor: "#1b1a24",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="hu"
      className={cn(
        "dark h-full antialiased",
        geistSans.variable,
        jetbrainsMono.variable,
      )}
    >
      <head>
        <script
          async
          crossOrigin="anonymous"
          src="https://tweakcn.com/live-preview.min.js"
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
