import type { Metadata } from "next";
import { Inter, Crimson_Text } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-sans",
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
        className={`${inter.variable} ${serif.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
