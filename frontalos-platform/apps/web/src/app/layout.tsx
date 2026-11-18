import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { BRANDING } from "@/lib/branding";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const SITE_TITLE = "FrontalOS by Cortix — ADHD Digital Therapeutics";
const SITE_DESCRIPTION =
  "One platform, three experiences — for the child, the family, and the clinician. FrontalOS unifies gamified patient care, calm family insight, and clinical-grade behavioral analytics.";

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: "%s",
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: BRANDING.favicon,
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "FrontalOS",
    type: "website",
    locale: "en_US",
    images: [BRANDING.logoFull],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [BRANDING.logoFull],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-canvas font-sans text-ink antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-secondary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-dark focus:shadow-lg"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}