import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/auth/server";
import HomeWorkspace from "./home-workspace";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return (
    <main className="home-shell">
      <span className="section-kicker">Nueva Ruta Ops</span>
      <h1>Del primer mensaje a una decisión trazable.</h1>
      <p className="home-intro">
        Una operación conectada para revisar consultas, registrar acciones
        comerciales, resolver datos contradictorios y planificar contenido con
        evidencia.
      </p>
      {data.user ? (
        <HomeWorkspace />
      ) : (
        <section className="panel">
          <h2>Accede a tu espacio de trabajo</h2>
          <p>Inicia sesión para ver las áreas y acciones de tu rol.</p>
          <Link className="button-link" href="/login">
            Ingresar →
          </Link>
        </section>
      )}
    </main>
  );
}
