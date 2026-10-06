import { createSupabaseServerClient } from "@/lib/auth/server";

import CreatorContentPlanning from "./planning";

export default async function CreatorContentPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return (
    <main className="operations-shell">
      <div className="eyebrow">Sistema de contenido</div>
      <h1>Creadores y contenido</h1>
      <p>
        Explora los perfiles, la evidencia que prioriza cada fuente y los
        guiones pendientes de revisión.
      </p>
      {data.session ? (
        <CreatorContentPlanning />
      ) : (
        <section className="panel">Autenticación requerida.</section>
      )}
    </main>
  );
}
