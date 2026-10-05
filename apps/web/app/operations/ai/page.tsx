import { createSupabaseServerClient } from "@/lib/auth/server";

import AiTimeline from "./timeline";

export default async function AiOperationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return (
    <main className="operations-shell">
      <div className="eyebrow">Decisiones y respaldo operativo</div>
      <h1>Ejecuciones de asistencia</h1>
      <p>
        Consulta cómo se procesó cada entrada y abre su caso usando el
        identificador de correlación.
      </p>
      {data.session ? (
        <AiTimeline />
      ) : (
        <section className="panel">Autenticación requerida.</section>
      )}
    </main>
  );
}
