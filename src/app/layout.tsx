import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { CaseSyncManager } from "@/components/CaseSyncManager";
import { ThemeProvider } from "@/lib/theme-context";
import { Analytics } from "@vercel/analytics/next";

// Sets the "dark" class on <html> synchronously, before hydration, from the
// same localStorage key theme-context.tsx reads — otherwise the page would
// briefly flash light before ThemeProvider's effect runs on mount.
const THEME_INIT_SCRIPT = `try{if(localStorage.getItem('lexcase-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export const metadata: Metadata = {
  title: "LexCase | Legal Case Management",
  description: "Case, hearing, and task management for lawyers and law firms.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LexCase",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e40af",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background text-ink">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
        <ServiceWorkerRegister />
        <CaseSyncManager />
        <Analytics />
      </body>
    </html>
  );
}
