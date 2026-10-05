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
  attribution_parameters: Record<string, string>;
  compliance_notes: string[];
  funnel_evidence: {
    linked_leads: number;
    stage_counts: Record<string, number>;
    source_ids: string[];
    interpretation: string;
  };
};
type Source = {
  business_id: string;
  source_type: string;
  source_date: string;
  channel: string;
  theme: string;
  provenance: string;
  display_text: string;
  compliance_risk: string;
  risk_reason: string;
  script_selectable: boolean;
  rank: number;
  priority_score: number | null;
  factors: Record<string, number | null>;
  factor_contributions: Record<string, number | null>;
  evidence: {
    linked_lead_count: number;
    stage_counts: Record<string, number>;
    source_age_days: number | null;
    freshness_horizon_days: number;
    compliance_risk: string;
    risk_reason: string;
  };
};
type Version = {
  id: string;
  version: number;
  creator_id: string;
  source_id: string;
  fit_rationale: string;
  body: string;
  body_checksum: string;
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
type SourceResponse = { sources: Source[]; interpretation: string };
type Access = { role: string; can_author: boolean; can_review: boolean };

const factors = [
  ["frequency", "Frecuencia"],
  ["funnel_proximity", "Proximidad al embudo"],
  ["freshness", "Vigencia (90 días)"],
  ["compliance_safety", "Seguridad de cumplimiento"],
] as const;

export default function CreatorContentPlanning() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [access, setAccess] = useState<Access>({
    role: "analyst",
    can_author: false,
    can_review: false,
  });
  const [platform, setPlatform] = useState("Todas");
  const [risk, setRisk] = useState("Todos");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [accessResponse, creatorResponse, sourceResponse, scriptResponse] =
      await Promise.all([
        fetch("/api/operations/creator-content/access", { cache: "no-store" }),
        fetch("/api/operations/creators", { cache: "no-store" }),
        fetch("/api/operations/content/sources/ranking", { cache: "no-store" }),
        fetch("/api/operations/content/scripts", { cache: "no-store" }),
      ]);
    if (
      !accessResponse.ok ||
      !creatorResponse.ok ||
      !sourceResponse.ok ||
      !scriptResponse.ok
    ) {
      setMessage(
        "No fue posible cargar la planificación. Verifica tu sesión y permisos.",
      );
      return;
    }
    setAccess(await accessResponse.json());
    setCreators(await creatorResponse.json());
    const ranked: SourceResponse = await sourceResponse.json();
    setSources(ranked.sources);
    setScripts(await scriptResponse.json());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

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
          ? "Cambio registrado. Las versiones anteriores se conservan."
          : `No se aplicó: ${typeof result.detail === "string" ? result.detail : "revisa cumplimiento, rol y duración"}`,
      );
      if (response.ok) await load();
    } catch {
      setMessage("No se pudo conectar con el servicio de planificación.");
    } finally {
      setBusy(false);
    }
  }

  const visibleCreators = creators.filter(
    (creator) => platform === "Todas" || creator.platforms.includes(platform),
  );
  const visibleSources = sources.filter(
    (source) => risk === "Todos" || source.compliance_risk === risk,
  );
  const prioritizedScripts = [...scripts].sort((first, second) => {
    const firstRank = sources.find(
      (source) => source.business_id === first.versions[0]?.source_id,
    )?.rank;
    const secondRank = sources.find(
      (source) => source.business_id === second.versions[0]?.source_id,
    )?.rank;
    return (
      (firstRank ?? Number.MAX_SAFE_INTEGER) -
      (secondRank ?? Number.MAX_SAFE_INTEGER)
    );
  });

  return (
    <div className="workspace-stack">
      <nav className="content-shortcuts" aria-label="Explorar contenido">
        <a href="#scripts">Guiones y revisiones →</a>
        <a href="#sources">Fuentes y prioridad →</a>
        <a href="#creators">Perfiles de creadores →</a>
      </nav>
      <div className="operation-grid content-grid">
        <section className="panel" id="creators">
          <h2>Perfiles ({visibleCreators.length}/5)</h2>
          <label className="filter-row">
            Plataforma
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
            >
              <option>Todas</option>
              {[...new Set(creators.flatMap((item) => item.platforms))]
                .sort()
                .map((item) => (
                  <option key={item}>{item}</option>
                ))}
            </select>
          </label>
          {visibleCreators.map((creator) => (
            <article className="evidence-card" key={creator.business_id}>
              <h3>
                {creator.fictional_name}{" "}
                <span className="badge">{creator.business_id}</span>
              </h3>
              <p>
                {creator.handle} · {creator.platforms.join(", ")}
              </p>
              <p>
                <strong>Audiencia:</strong> {creator.audience_archetype}
              </p>
              <p>
                <strong>Voz:</strong> {creator.voice}
              </p>
              <p>
                <strong>Pilares:</strong> {creator.content_pillars.join(" · ")}
              </p>
              <p>
                <strong>CTA:</strong> {creator.cta_style}
              </p>
              <p>
                <strong>Atribución:</strong>{" "}
                {Object.entries(creator.attribution_parameters)
                  .map(([key, value]) => `${key}=${value}`)
                  .join(" · ")}
              </p>
              <p>
                <strong>Notas:</strong> {creator.compliance_notes.join(" · ")}
              </p>
              <details>
                <summary>
                  Evidencia de embudo ({creator.funnel_evidence.linked_leads}{" "}
                  leads vinculados)
                </summary>
                <p>
                  {Object.entries(creator.funnel_evidence.stage_counts)
                    .map(([stage, count]) => `${stage}: ${count}`)
                    .join(" · ") || "Sin etapas observadas"}
                </p>
                <p>
                  Fuentes:{" "}
                  {creator.funnel_evidence.source_ids.join(", ") ||
                    "Sin fuentes vinculadas"}
                </p>
                <small>{creator.funnel_evidence.interpretation}</small>
              </details>
            </article>
          ))}
        </section>

        <section className="panel" id="sources">
          <h2>Fuentes ({visibleSources.length}/10)</h2>
          <p>
            Prioridad descriptiva: no representa lift causal, ROI ni resultados
            garantizados.
          </p>
          <label className="filter-row">
            Riesgo
            <select
              value={risk}
              onChange={(event) => setRisk(event.target.value)}
            >
              <option>Todos</option>
              <option value="low">Bajo</option>
              <option value="medium">Medio</option>
              <option value="high">Alto</option>
            </select>
          </label>
          {visibleSources.map((source) => (
            <article className="evidence-card" key={source.business_id}>
              <h3>
                #{source.rank} · {source.business_id}{" "}
                <span className="badge">{source.compliance_risk}</span>
              </h3>
              <p>{source.display_text}</p>
              <p>
                {source.source_type} · {source.channel} · {source.theme} ·{" "}
                {source.source_date}
              </p>
              <p>
                {source.provenance} · {source.risk_reason}
              </p>
              <p>
                Leads vinculados: {source.evidence.linked_lead_count};
                antigüedad: {source.evidence.source_age_days ?? "no disponible"}{" "}
                días. Riesgo: {source.evidence.compliance_risk}.
              </p>
              <ul>
                {factors.map(([key, label]) => (
                  <li key={key}>
                    {label}:{" "}
                    {source.factors[key] == null
                      ? "No disponible"
                      : `${source.factors[key]} (aporte ${source.factor_contributions[key]})`}
                  </li>
                ))}
              </ul>
              <p>
                Puntaje: {source.priority_score ?? "No disponible"} ·{" "}
                {source.script_selectable
                  ? "Elegible para borradores"
                  : "No elegible para aprobación de guion"}
              </p>
            </article>
          ))}
        </section>

        <section className="panel" id="scripts">
          <h2>Guiones y revisiones</h2>
          <p>
            Prioridad según la fuente vinculada. Los borradores requieren
            revisión humana. No hay acciones de publicación o programación.
          </p>
          {prioritizedScripts.map((script) => {
            const latest = script.versions[0];
            if (!latest) return null;
            return (
              <article className="evidence-card" key={script.id}>
                <h3>
                  {script.business_id} · {script.title}
                </h3>
                <p>
                  Versión {latest.version} · Creador {latest.creator_id} ·
                  Fuente {latest.source_id} · Prioridad de fuente #
                  {sources.find(
                    (source) => source.business_id === latest.source_id,
                  )?.rank ?? "sin ranking"}
                </p>
                <p>
                  <strong>Ajuste:</strong> {latest.fit_rationale}
                </p>
                <p>
                  {latest.word_count} palabras · duración estimada{" "}
                  {latest.estimated_duration_seconds} s · SHA-256{" "}
                  {latest.body_checksum}
                </p>
                <p>
                  Cumplimiento:{" "}
                  {latest.compliance_valid
                    ? "válido"
                    : latest.compliance_codes.join(", ")}{" "}
                  · Revisión: {latest.review_state}
                </p>
                <blockquote>{latest.body}</blockquote>
                {latest.review?.reason && (
                  <p>Nota de revisión: {latest.review.reason}</p>
                )}
                {access.can_author && (
                  <ScriptVersionForm
                    script={script}
                    creators={creators}
                    sources={sources}
                    disabled={busy}
                    onSubmit={(body) =>
                      void send(`content/scripts/${script.id}/versions`, body)
                    }
                  />
                )}
                {access.can_review &&
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
          })}
        </section>
        {message && (
          <p role="status" aria-live="polite">
            {message}
          </p>
        )}
      </div>
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
      <h4>Crear nueva versión de {script.business_id}</h4>
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
        Guion (estimación válida: 30–45 s)
        <textarea
          name="body"
          required
          minLength={100}
          maxLength={5000}
          rows={6}
        />
      </label>
      <button disabled={disabled} type="submit">
        Guardar versión para revisión
      </button>
    </form>
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
