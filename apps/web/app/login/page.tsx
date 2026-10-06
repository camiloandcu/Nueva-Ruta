import Link from "next/link";

import { signIn } from "./actions";

type LoginPageProps = { searchParams: Promise<{ error?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="auth-shell">
      <div className="eyebrow">Acceso privado</div>
      <h1>Ingresar</h1>
      <p>
        Ingresa con la cuenta asignada a tu rol. El registro público está
        deshabilitado.
      </p>
      <form action={signIn} className="auth-form">
        <label>
          Correo electrónico
          <input autoComplete="username" name="email" required type="email" />
        </label>
        <label>
          Contraseña
          <input
            autoComplete="current-password"
            name="password"
            required
            type="password"
          />
        </label>
        {error ? (
          <p aria-live="polite" className="auth-error" role="alert">
            No se pudo iniciar sesión. Verifica los datos e inténtalo de nuevo.
          </p>
        ) : null}
        <button type="submit">Ingresar</button>
      </form>
      <Link href="/">Volver a Nueva Ruta</Link>
    </main>
  );
}
