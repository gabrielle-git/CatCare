import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const dmSans = localFont({
  src: "./fonts/dm-sans-latin.woff2",
  display: "swap",
  variable: "--font-dm-sans",
  weight: "100 1000",
});

export const metadata: Metadata = {
  title: "CatCare",
  description: "Saúde, rotina e memórias dos seus pets em um só lugar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${dmSans.className} antialiased`}>{children}</body>
    </html>
  );
}
