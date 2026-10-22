import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";

const inter = localFont({
  src: "../assets/fonts/inter-latin.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yummy - Restaurant Management",
  description: "Next.js Admin Dashboard for Yummy",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { GlobalLoaderOverlay } from "@/components/global-loader-overlay";
import { AppProviders } from "@/components/providers";
import { AppUpdaterNotifier } from "@/components/app-updater-notifier";
import { Analytics } from "@vercel/analytics/next";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.className,
          inter.variable,
        )}
      >
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AppUpdaterNotifier />
            <AppProviders>
              <GlobalLoaderOverlay />
              {children}
            </AppProviders>
            <Toaster />
            <SonnerToaster position="top-right" richColors closeButton />
          </ThemeProvider>
          <Analytics />
      </body>
    </html>
  );
}
