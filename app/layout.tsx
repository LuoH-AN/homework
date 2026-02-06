import type { Metadata } from "next";
import { Baloo_2, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import NavShell from "./components/nav-shell";
import { MeProvider } from "./components/me-context";

const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display"
});

const notoSans = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body"
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
    <html lang="zh-CN" className={`${baloo.variable} ${notoSans.variable}`}>
      <body>
        <MeProvider>
          <div className="app-shell">
            <NavShell />
            <div className="app-content">{children}</div>
          </div>
        </MeProvider>
      </body>
    </html>
  );
}
