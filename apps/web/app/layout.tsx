import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Nueva Ruta",
  description: "Operaciones de alivio de deudas con trazabilidad humana",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-US">
      <body>{children}</body>
    </html>
  );
}
