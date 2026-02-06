import type { Metadata } from "next";
import { Sora, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-sora"
});

const notoSans = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto"
});

export const metadata: Metadata = {
  title: "作业提交",
  description: "通过 Telegram 群组提交作业"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${sora.variable} ${notoSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
