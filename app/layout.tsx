import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ramadan Kareem | 3D Web Card",
  description: "An interactive 3D Gaussian Splatting web card for Ramadan & Eid.",
  openGraph: {
    title: "Ramadan Kareem",
    description: "An interactive 3D Gaussian Splatting web card.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
