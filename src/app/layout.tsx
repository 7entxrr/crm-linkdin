import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import { Providers } from "@/components/providers";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Healthcare Recruitment Outreach Automation for USA Healthcare Professionals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${lexend.variable} h-full`} suppressHydrationWarning>
      <body className={`${lexend.className} min-h-full`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
