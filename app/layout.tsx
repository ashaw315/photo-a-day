import type { Metadata } from "next";
import { Geist, Geist_Mono, Crimson_Text } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const serif = Crimson_Text({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: "Photo a Day",
  description: "A personal daily photo gallery",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
