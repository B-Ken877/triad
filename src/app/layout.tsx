import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRIAD",
  description:
    "TRIAD is a multi-project AI collaboration workspace: isolated project channels, durable project records and one central, reliable messaging API for humans and agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col antialiased">{children}</body>
    </html>
  );
}
