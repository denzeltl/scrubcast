import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Inter_Tight } from "next/font/google";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, THEME_COLOR, siteUrl } from "@/lib/site";
import { ServerWarmupBanner } from "@/components/ServerWarmupBanner";

// Inter for reading, Inter Tight 800 for headings, Geist Mono for every number
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["600", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// A function, not a constant, so SITE_URL is read when the server runs rather than at build.
// Share images, icons and the manifest are picked up from src/app by file convention.
export function generateMetadata(): Metadata {
  const title = `${SITE_NAME} — ${SITE_TAGLINE}`;
  return {
    metadataBase: siteUrl(),
    title,
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description: SITE_DESCRIPTION,
      url: "/",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: SITE_DESCRIPTION,
    },
  };
}

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interTight.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServerWarmupBanner />
        {children}
      </body>
    </html>
  );
}
