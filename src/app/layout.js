import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import GlobalRequestLoader from "@/components/common/GlobalRequestLoader";
import NumberInputWheelGuard from "@/components/common/NumberInputWheelGuard";
import AppHeader from "@/components/layout/AppHeader";
import ActionConfirmation from "@/components/common/ActionConfirmation";
import { withBasePath } from "@/lib/app-path";
import { getCurrentUser } from "@/lib/security/auth";
import { AuthUserProvider } from "@/components/auth/AuthUserContext";
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
    icon: withBasePath("/icon.png"),
    shortcut: withBasePath("/icon.png"),
    apple: withBasePath("/icon.png"),
  },
};

export default async function RootLayout({ children }) {
  const user = await getCurrentUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthUserProvider user={user}>
          <GlobalRequestLoader />
          <NumberInputWheelGuard />
          <ActionConfirmation />
          <div className="min-h-screen bg-gray-50">
            {user && <AppHeader user={user} />}
            {children}
          </div>
          <Toaster />
        </AuthUserProvider>
      </body>
    </html>
  );
}
