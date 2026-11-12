import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Hanken_Grotesk, Sora } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin", "latin-ext"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: {
    default: "PannonGuard HR",
    template: "%s · PannonGuard HR",
  },
  description: "Munkavállalók, iratok és felvétel a PannonGuard Komplex rendszerben",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hu" className={`${hanken.variable} ${sora.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
