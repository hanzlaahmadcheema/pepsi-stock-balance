import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { NavigationProgressBar } from "@/components/ui/navigation-progress";
import "./globals.css";

/**
 * Atkinson Hyperlegible is drawn for maximum legibility: wider letterforms,
 * distinct character shapes and taller x-height. It is the reading face for
 * cashiers and warehouse staff of every age, and it stays clear on the cheap,
 * low-density counter monitors this app runs on.
 */
const appSans = Atkinson_Hyperlegible({
  variable: "--font-app-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
});

/** Ledger figures: every amount, crate count, invoice number and timestamp. */
const appMono = Geist_Mono({
  variable: "--font-app-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pepsi Stock Balance",
  description: "Stock & balance tracking system for Pepsi distribution",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Theme: paper (light) is the default. Night Depot is opt-in.
                  var theme = localStorage.getItem('pepsi_theme');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }

                  // Text size: the operator's own reading size, remembered.
                  var size = localStorage.getItem('pepsi_text_size');
                  if (size !== 'medium' && size !== 'large' && size !== 'largest') {
                    size = 'large';
                  }
                  document.documentElement.setAttribute('data-text-size', size);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${appSans.variable} ${appMono.variable} antialiased`}>
        <Suspense fallback={null}>
          <NavigationProgressBar />
        </Suspense>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:inline-flex focus:min-h-12 focus:items-center focus:gap-2 focus:bg-navy focus:px-5 focus:py-3 focus:text-lg focus:font-bold focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none"
        >
          Skip to main content
        </a>
        <div id="main-content" className="pb-20 lg:pb-0">{children}</div>
      </body>
    </html>
  );
}
