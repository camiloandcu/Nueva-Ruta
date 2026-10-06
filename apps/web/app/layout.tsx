import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import { signOut } from "@/app/login/actions";
import { createSupabaseServerClient } from "@/lib/auth/server";
import AppNavigation from "./app-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nueva Ruta",
  description: "Operaciones de alivio de deudas con trazabilidad humana",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  return (
    <html lang="es-US">
      <body>
        <header className="site-header">
          <Link aria-label="Inicio Nueva Ruta" href="/">
            Nueva Ruta
          </Link>
          {data.user ? (
            <>
              <AppNavigation />
              <form action={signOut}>
                <span>{data.user.email}</span>
                <button type="submit">Cerrar sesión</button>
              </form>
            </>
          ) : (
            <Link href="/login">Ingresar</Link>
          )}
        </header>
        {children}
      </body>
    </html>
  );
}
