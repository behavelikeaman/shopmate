import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

import { SiteHeader } from "@/components/SiteHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShopMate",
  description: "소규모 판매자를 위한 온라인 쇼핑몰",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} antialiased`}>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
