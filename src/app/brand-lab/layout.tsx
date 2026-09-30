import { Fraunces } from "next/font/google";

/**
 * Brand Lab layout — independent of AppShell / CatCare chrome.
 * Fraunces is NOT in the repo as a local file; loaded via next/font/google
 * for this route only (same approach as cuidadim-brand-kit).
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-cuidadim-display",
  display: "swap",
});

export const metadata = {
  title: "Cuidadim · Brand Lab",
  robots: { index: false, follow: false },
};

export default function BrandLabLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${fraunces.variable} min-h-svh`}>{children}</div>;
}
