"use client";

import { useCallback, useEffect, useState } from "react";

type Creator = {
  business_id: string;
  fictional_name: string;
  handle: string;
  platforms: string[];
  audience_archetype: string;
  voice: string;
  content_pillars: string[];
  cta_style: string;
  funnel_evidence: { linked_leads: number; interpretation: string };
};
type Source = {
  business_id: string;
  source_type: string;
  source_date: string;
  channel: string;
  theme: string;
  display_text: string;
  compliance_risk: string;
  risk_reason: string;
  script_selectable: boolean;
  rank: number;
  priority_score: number | null;
  evidence: { linked_lead_count: number; source_age_days: number | null };
};
type Version = {
  id: string;
  version: number;
  creator_id: string;
  source_id: string;
  fit_rationale: string;
  body: string;
  word_count: number;
  estimated_duration_seconds: number;
  compliance_valid: boolean;
  compliance_codes: string[];
  review_state: string;
  review: { decision: string; reason?: string } | null;
};
type Script = {
  id: string;
  business_id: string;
  title: string;
  versions: Version[];
};
type Access = { role: string; can_author: boolean; can_review: boolean };
type Section<T> = { data: T | null; loading: boolean; error: string };
type Tab = "overview" | "sources" | "scripts" | "creators";

const initial = <T,>(): Section<T> => ({
  data: null,
  loading: true,
  error: "",
});

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`/api/operations/${path}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`No se pudo cargar (${response.status}).`);
  return response.json() as Promise<T>;
}

export default function CreatorContentPlanning() {
  const [tab, setTab] = useState<Tab>("overview");
  const [access, setAccess] = useState<Section<Access>>(initial);
  const [creators, setCreators] = useState<Section<Creator[]>>(initial);
  const [sources, setSources] = useState<Section<Source[]>>(initial);
  const [scripts, setScripts] = useState<Section<Script[]>>(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadAccess = useCallback(async () => {
    setAccess((value) => ({ ...value, loading: true, error: "" }));
    try {
      setAccess({
        data: await request<Access>("creator-content/access"),
        loading: false,
        error: "",
      });
    } catch (error) {
      setAccess({
        data: null,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el acceso.",
      });
    }
  }, []);
  const loadCreators = useCallback(async () => {
    setCreators((value) => ({ ...value, loading: true, error: "" }));
    try {
      setCreators({
        data: await request<Creator[]>("creators"),
        loading: false,
        error: "",
      });
    } catch (error) {
      setCreators({
        data: null,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los creadores.",
      });
    }
  }, []);
  const loadSources = useCallback(async () => {
    setSources((value) => ({ ...value, loading: true, error: "" }));
    try {
      const payload = await request<{ sources: Source[] }>(
        "content/sources/ranking",
      );
      setSources({ data: payload.sources, loading: false, error: "" });
    } catch (error) {
      setSources({
        data: null,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las fuentes.",
      });
    }
  }, []);
  const loadScripts = useCallback(async () => {
    setScripts((value) => ({ ...value, loading: true, error: "" }));
    try {
      setScripts({
        data: await request<Script[]>("content/scripts"),
        loading: false,
        error: "",
      });
    } catch (error) {
      setScripts({
        data: null,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los guiones.",
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([
        loadAccess(),
        loadCreators(),
        loadSources(),
        loadScripts(),
      ]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAccess, loadCreators, loadScripts, loadSources]);
  const refresh = useCallback(async () => {
    await Promise.all([loadCreators(), loadSources(), loadScripts()]);
  }, [loadCreators, loadScripts, loadSources]);
  const creatorRows = creators.data ?? [];
  const sourceRows = sources.data ?? [];
  const scriptRows = scripts.data ?? [];
  const pendingScripts = scriptRows.filter(
    (script) => script.versions[0]?.review_state === "pending_review",
  );

  async function send(path: string, body: unknown) {
    setBusy(true);
    try {
      const response = await fetch(`/api/operations/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      setMessage(
        response.ok
          ? "Cambio registrado. El historial se conserva."
          : typeof result.detail === "string"
            ? result.detail
            : "La acción no fue aceptada.",
      );
      if (response.ok) await refresh();
    } catch {
      setMessage("No fue posible registrar el cambio. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-stack content-workspace">
      <section className="panel content-header">
        <div>
          <span className="section-kicker">Planificación editorial</span>
          <h2>De evidencia a guion revisado</h2>
          <p>
            Explora primero qué requiere atención y abre el detalle solo cuando
            lo necesites.
          </p>
        </div>
        <nav className="workspace-tabs" aria-label="Vistas de contenido">
          {(
            [
              ["overview", "Resumen"],
              ["sources", "Fuentes"],
              ["scripts", "Guiones"],
              ["creators", "Creadores"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={tab === value ? "is-active" : "secondary-button"}
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </nav>
      </section>
      {tab === "overview" && (
        <section className="content-overview" aria-label="Resumen de contenido">
          <SummaryCard
            title="Fuentes priorizadas"
            value={sources.loading ? "…" : String(sourceRows.length)}
            detail="Ordenadas por evidencia y cumplimiento."
            action="Ver fuentes"
            onClick={() => setTab("sources")}
          />
          <SummaryCard
            title="Guiones por revisar"
            value={scripts.loading ? "…" : String(pendingScripts.length)}
            detail="La publicación siempre requiere revisión humana."
            action="Abrir guiones"
            onClick={() => setTab("scripts")}
          />
          <SummaryCard
            title="Perfiles disponibles"
            value={creators.loading ? "…" : String(creatorRows.length)}
            detail="Voz, audiencia y contexto de cada creador."
            action="Ver creadores"
            onClick={() => setTab("creators")}
          />
          {access.error && (
            <LoadFailure
              label="permisos"
              error={access.error}
              retry={loadAccess}
            />
          )}
        </section>
      )}
      {tab === "sources" && (
        <section className="panel content-list-panel">
          <SectionHeading
            title="Fuentes priorizadas"
            detail="El ranking describe evidencia disponible; no promete resultados."
          />
          {sources.error ? (
            <LoadFailure
              label="fuentes"
              error={sources.error}
              retry={loadSources}
            />
          ) : sources.loading ? (
            <p>Cargando fuentes…</p>
          ) : (
            sourceRows.map((source) => (
              <article className="content-row" key={source.business_id}>
                <span className="rank">#{source.rank}</span>
                <div>
                  <h3>{source.theme}</h3>
                  <p>{source.display_text}</p>
                  <small>
                    {source.channel} · {source.source_date} ·{" "}
                    {source.evidence.linked_lead_count} leads vinculados
                  </small>
                </div>
                <div>
                  <span className="badge">{source.compliance_risk}</span>
                  <small>
                    {source.script_selectable
                      ? "Disponible para guion"
                      : source.risk_reason}
                  </small>
                </div>
              </article>
            ))
          )}
        </section>
      )}
      {tab === "scripts" && (
        <section className="panel content-list-panel">
          <SectionHeading
            title="Guiones y revisiones"
            detail="Los guiones se guardan como versiones; ninguna acción publica contenido."
          />
          {scripts.error ? (
            <LoadFailure
              label="guiones"
              error={scripts.error}
              retry={loadScripts}
            />
          ) : scripts.loading ? (
            <p>Cargando guiones…</p>
          ) : (
            scriptRows.map((script) => {
              const latest = script.versions[0];
              if (!latest) return null;
              return (
                <article className="script-card" key={script.id}>
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">
                        {script.business_id}
                      </span>
                      <h3>{script.title}</h3>
                    </div>
                    <span className="badge">{latest.review_state}</span>
                  </div>
                  <p>{latest.fit_rationale}</p>
                  <blockquote>{latest.body}</blockquote>
                  <small>
                    v{latest.version} · {latest.creator_id} · {latest.source_id}{" "}
                    · {latest.word_count} palabras ·{" "}
                    {latest.estimated_duration_seconds} s
                  </small>
                  {latest.review?.reason && (
                    <p className="review-note">{latest.review.reason}</p>
                  )}
                  {access.data?.can_author && (
                    <ScriptVersionForm
                      script={script}
                      creators={creatorRows}
                      sources={sourceRows}
                      disabled={busy}
                      onSubmit={(body) =>
                        void send(`content/scripts/${script.id}/versions`, body)
                      }
                    />
                  )}
                  {access.data?.can_review &&
                    latest.review_state === "pending_review" && (
                      <ScriptReviewForm
                        versionId={latest.id}
                        disabled={busy}
                        onSubmit={(body) =>
                          void send(
                            `content/script-versions/${latest.id}/review`,
                            body,
                          )
                        }
                      />
                    )}
                </article>
              );
            })
          )}
        </section>
      )}
      {tab === "creators" && (
        <section className="panel content-list-panel">
          <SectionHeading
            title="Perfiles de creadores"
            detail="Usa el perfil para mantener tono y contexto, no como evidencia de resultados."
          />
          {creators.error ? (
            <LoadFailure
              label="creadores"
              error={creators.error}
              retry={loadCreators}
            />
          ) : creators.loading ? (
            <p>Cargando perfiles…</p>
          ) : (
            creatorRows.map((creator) => (
              <article className="creator-card" key={creator.business_id}>
                <div>
                  <span className="section-kicker">
                    {creator.business_id} · {creator.platforms.join(" / ")}
                  </span>
                  <h3>{creator.fictional_name}</h3>
                  <p>{creator.audience_archetype}</p>
                </div>
                <dl>
                  <div>
                    <dt>Voz</dt>
                    <dd>{creator.voice}</dd>
                  </div>
                  <div>
                    <dt>CTA</dt>
                    <dd>{creator.cta_style}</dd>
                  </div>
                  <div>
                    <dt>Leads vinculados</dt>
                    <dd>{creator.funnel_evidence.linked_leads}</dd>
                  </div>
                </dl>
              </article>
            ))
          )}
        </section>
      )}
      {message && (
        <p className="inline-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </div>
  );
}
function SummaryCard({
  title,
  value,
  detail,
  action,
  onClick,
}: {
  title: string;
  value: string;
  detail: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <article className="summary-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
      <button type="button" className="secondary-button" onClick={onClick}>
        {action} →
      </button>
    </article>
  );
}
function LoadFailure({
  label,
  error,
  retry,
}: {
  label: string;
  error: string;
  retry: () => Promise<void>;
}) {
  return (
    <div className="load-failure" role="alert">
      <strong>No se pudieron cargar {label}.</strong>
      <span>{error}</span>
      <button type="button" onClick={() => void retry()}>
        Reintentar
      </button>
    </div>
  );
}
function ScriptVersionForm({
  script,
  creators,
  sources,
  disabled,
  onSubmit,
}: {
  script: Script;
  creators: Creator[];
  sources: Source[];
  disabled: boolean;
  onSubmit: (body: Record<string, string>) => void;
}) {
  const eligible = sources.filter((source) => source.script_selectable);
  return (
    <details className="editor-details">
      <summary>Crear nueva versión de {script.business_id}</summary>
      <form
        action={(form) =>
          onSubmit({
            creator_id: String(form.get("creator_id")),
            source_id: String(form.get("source_id")),
            fit_rationale: String(form.get("fit_rationale")),
            body: String(form.get("body")),
          })
        }
      >
        <label>
          Creador
          <select name="creator_id">
            {creators.map((creator) => (
              <option key={creator.business_id}>{creator.business_id}</option>
            ))}
          </select>
        </label>
        <label>
          Fuente
          <select name="source_id">
            {eligible.map((source) => (
              <option key={source.business_id}>{source.business_id}</option>
            ))}
          </select>
        </label>
        <label>
          Razón de ajuste
          <input name="fit_rationale" required minLength={10} maxLength={600} />
        </label>
        <label>
          Guion (30–45 s)
          <textarea
            name="body"
            required
            minLength={100}
            maxLength={5000}
            rows={6}
          />
        </label>
        <button disabled={disabled} type="submit">
          Guardar para revisión
        </button>
      </form>
    </details>
  );
}
function ScriptReviewForm({
  versionId,
  disabled,
  onSubmit,
}: {
  versionId: string;
  disabled: boolean;
  onSubmit: (body: Record<string, string>) => void;
}) {
  return (
    <form
      className="review-form"
      action={(form) =>
        onSubmit({
          decision: String(form.get("decision")),
          reason: String(form.get("reason")),
        })
      }
    >
      <h4>Revisión supervisora · {versionId.slice(0, 8)}</h4>
      <label>
        Decisión
        <select name="decision">
          <option value="approved">Aprobar borrador</option>
          <option value="changes_requested">Solicitar cambios</option>
          <option value="rejected">Rechazar</option>
        </select>
      </label>
      <label>
        Motivo
        <input name="reason" required minLength={5} maxLength={500} />
      </label>
      <button disabled={disabled} type="submit">
        Registrar revisión
      </button>
    </form>
  );
}
