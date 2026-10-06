import { createSupabaseServerClient } from "@/lib/auth/server";

import RuleReview from "./rule-review";

export default async function RulesPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();

  return (
    <main className="rules-shell">
      <div className="eyebrow">Política operativa</div>
      <h1>Política operativa</h1>
      <p>
        Revisa la versión activa, prepara un cambio y compara sus diferencias
        antes de publicarlo.
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
