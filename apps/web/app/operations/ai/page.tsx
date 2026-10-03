import { createSupabaseServerClient } from "@/lib/auth/server";

import AiTimeline from "./timeline";

export default async function AiOperationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return (
    <main className="operations-shell">
      <div className="eyebrow">Observabilidad segura · WI-004</div>
      <h1>Ejecuciones de asistencia</h1>
      <p>Taxonomía correlacionada sin texto de mensajes, secretos ni razonamiento interno.</p>
      {data.session ? <AiTimeline /> : <section className="panel">Autenticación requerida.</section>}
    </main>
  );
}
