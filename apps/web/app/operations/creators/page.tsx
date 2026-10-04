import { createSupabaseServerClient } from "@/lib/auth/server";

import CreatorContentPlanning from "./planning";

export default async function CreatorContentPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return (
    <main className="operations-shell">
      <div className="eyebrow">Planificación de contenido · WI-008</div>
      <h1>Creadores y contenido</h1>
      <p>
        Perfiles, fuentes y borradores ficticios para análisis descriptivo. No
        se publica, programa ni recopila contenido de redes.
      </p>
      {data.session ? (
        <CreatorContentPlanning />
      ) : (
        <section className="panel">Autenticación requerida.</section>
      )}
    </main>
  );
}
