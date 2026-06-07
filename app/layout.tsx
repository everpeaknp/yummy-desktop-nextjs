import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yummy - Restaurant Management",
  description: "Next.js Admin Dashboard for Yummy",
};

import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { GlobalLoaderOverlay } from "@/components/global-loader-overlay";
import { AppProviders } from "@/components/providers";
import { AppUpdaterNotifier } from "@/components/app-updater-notifier";

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
      </body>
    </html>
  );
}
