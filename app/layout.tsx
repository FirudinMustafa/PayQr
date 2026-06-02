import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayQR — Dijital Cüzdan & QR Ödeme",
  description:
    "Finans Teknolojileri ödevi: QR kod ile ödeme ve dijital cüzdan demo uygulaması.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
