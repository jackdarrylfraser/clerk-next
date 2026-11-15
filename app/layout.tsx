import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DevAuthBypassProvider } from "@/components/dev-auth-bypass-provider";
import Navigation from "@/components/navigation";
import SiteFooter from "@/components/site-footer";
import { isDevAuthBypassEnabled, isPublicOnlyMode } from "@/lib/auth";
import "./globals.css";
import "katex/dist/katex.min.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Subscribe",
  description: "Choose a plan and manage your subscription.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DevAuthBypassProvider enabled={isDevAuthBypassEnabled}>
          <Navigation publicOnlyMode={isPublicOnlyMode} />
          {children}
          <SiteFooter />
        </DevAuthBypassProvider>
      </body>
    </html>
  );
}