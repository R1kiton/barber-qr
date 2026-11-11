import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

const body = Geist({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BarberQR · Reserva tu cita",
  description: "Reserva tu cita en la barbería escaneando un código QR.",
};

export const viewport: Viewport = {
  themeColor: "#f4efe6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
