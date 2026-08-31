import type { Metadata, Viewport } from "next";
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
  applicationName: "CatCare",
  appleWebApp: {
    capable: true,
    title: "CatCare",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#8e7dbe",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${dmSans.className} antialiased`}>{children}</body>
    </html>
  );
}
