import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import GlobalRequestLoader from "@/components/common/GlobalRequestLoader";
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
  title: "KR Exports Production",
  description: "KR Exports Production",
  icons: {
    icon: "https://res.cloudinary.com/dr8csfvlj/image/upload/v1774948152/samples/header-logo_ucz0ly.png",
    shortcut: "https://res.cloudinary.com/dr8csfvlj/image/upload/v1774948152/samples/header-logo_ucz0ly.png",
    apple: "https://res.cloudinary.com/dr8csfvlj/image/upload/v1774948152/samples/header-logo_ucz0ly.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <GlobalRequestLoader />
        <div className="min-h-screen bg-gray-50">
          <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg">
            <div className="container mx-auto flex items-center gap-3">
              <Image
                src="https://res.cloudinary.com/dr8csfvlj/image/upload/v1774948152/samples/header-logo_ucz0ly.png"
                alt="KR Exports logo"
                width={64}
                height={64}
                className="h-16 w-16 rounded bg-white p-0.5"
                priority
              />
              <div>
                <h1 className="text-xl font-bold">KR Exports Production</h1>
                <p className="text-sm opacity-90">[ 2025 - 2026 ]</p>
              </div>
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
