import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import "@/lib/utils/suppressHydrationWarnings";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "KR Production System - Smart Spin Lite",
  description: "Production Management System for Kayaar Exports Private Limited",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <div className="min-h-screen bg-gray-50">
          <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg">
            <div className="container mx-auto">
              <h1 className="text-xl font-bold">Smart Spin Lite - Production Management System</h1>
              <p className="text-sm opacity-90">Kayaar Exports Private Limited [ 2025 - 2026 ]</p>
            </div>
          </header>
          <main>
            {children}
          </main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
