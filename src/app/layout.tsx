import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { Providers } from "@/components/providers";
import LayoutWrapper from "@/components/LayoutWrapper";
import Toast from "@/components/ui/Toast";
import { PageActivityLogger } from "@/components/account/PageActivityLogger";
import { AuthErrorBoundary } from "@/modules/auth/components/AuthErrorBoundary";

import { config } from "@/config";
import { getAppBranding } from "@/config/branding";
import { AppBrandingProvider } from "@/components/shared/layout/AppBranding";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Mapp Digital " + getAppBranding().name,
  description:
    "Centralized hub for managing software modules, exploring add-ons, and accessing technical documentation.",
  keywords: ["Mapp Labs", "software modules", "add-ons", "documentation"],
  authors: [{ name: "Mapp Digital" }],
  creator: "Mapp Digital",
  publisher: "Mapp Digital",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/x-icon" }, // fallback
    ],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(config.app.url),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: getAppBranding().name,
    description:
      "Centralized hub for managing software modules, exploring add-ons, and accessing technical documentation.",
    url: config.app.url,
    siteName: getAppBranding().name,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: getAppBranding().name,
    description:
      "Centralized hub for managing software modules, exploring add-ons, and accessing technical documentation.",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      "max-video-preview": -1,
      "max-image-preview": "none",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} antialiased app-background text-[#1a1a1a]`}
      >
        <AppBrandingProvider branding={getAppBranding()}>
          <Providers>
            <AuthErrorBoundary>
              <LayoutWrapper>{children}</LayoutWrapper>
            </AuthErrorBoundary>
            <Toast />
            <PageActivityLogger />
          </Providers>
        </AppBrandingProvider>
      </body>
    </html>
  );
}
