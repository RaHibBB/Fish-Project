import type { Metadata, Viewport } from "next";
import { Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";

const notoBengali = Noto_Sans_Bengali({
  variable: "--font-sans",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "খামারের হিসাব",
  description: "চৌধুরী ব্রাদার্স এগ্রো — খরচ ও পার্টনারদের টাকার হিসাব",
  appleWebApp: { capable: true, title: "খামারের হিসাব", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0f8a6a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bn" className={`${notoBengali.variable} h-full antialiased`}>
      <body className="min-h-full bg-muted/40">{children}</body>
    </html>
  );
}
