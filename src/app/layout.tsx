import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShopMate",
  description: "여러 판매자의 상품을 한 번에 담아 주문하는 온라인 쇼핑몰",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} flex min-h-screen flex-col antialiased`}>
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
