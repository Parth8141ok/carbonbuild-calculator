import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { TooltipProvider } from "@/components/ui/overlays";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CarbonBuild: Construction Carbon Footprint Calculator",
    template: "%s · CarbonBuild",
  },
  description:
    "A B.Tech Civil Engineering project (Sarvajanik University, Surat, 2026): estimate the construction-stage carbon footprint of a building project from material wastage, transport and site machinery, with a full calculation audit trail.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow">
          Skip to content
        </a>
        <TooltipProvider delayDuration={150}>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </TooltipProvider>
      </body>
    </html>
  );
}
