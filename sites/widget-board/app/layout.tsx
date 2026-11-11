import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Widget Board — A little space for anything",
  description: "Your private collection of small, native widget boards, updated by conversation.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
