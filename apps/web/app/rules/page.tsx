import { createSupabaseServerClient } from "@/lib/auth/server";

import RuleReview from "./rule-review";

export default async function RulesPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();

  return (
    <main className="rules-shell">
      <div className="eyebrow">Gobernanza de reglas · WI-003</div>
      <h1>Política operativa</h1>
      <p>
        Revisa versiones inmutables, importa YAML y confirma el hash exacto
        antes de publicar. Todos los valores son ficticios para demostración
        local.
      </p>
      {data.session ? (
        <RuleReview />
      ) : (
        <section className="panel" aria-live="polite">
          Inicia sesión con una identidad local autorizada para revisar las
          reglas.
        </section>
      )}
    </main>
  );
}
