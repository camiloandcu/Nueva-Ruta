"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Lead = {
  source_event_id: string;
  crm_lead_id: string;
  business_id: string;
  external_event_id: string;
  decision_id: string;
  received_at: string;
  channel: string;
  redacted_body: string;
  redaction_types: string[];
  decision: string;
  reason_code: string;
  correlation_id: string;
  extracted_fields: {
    approximate_debt: number | null;
    debt_type: "credit_card" | "medical" | "personal_loan" | null;
    state: string | null;
    preferred_language: "es" | "en" | null;
    preferred_contact_time: string | null;
    wants_counselor: boolean | null;
  } | null;
  extraction_source: "deterministic" | "ai_assisted" | null;
  extraction_corrected_at: string | null;
};
type Draft = {
  id: string;
  decision_id: string;
  content: string;
  status: string;
  approved_content: string | null;
};
type Result = {
  lead_id: string;
  decision: string;
  reason_code: string;
  correlation_id: string;
  ai_attempt_status: string;
  failure_layer: string;
  normalized_reason: string;
  draft_id: string | null;
  escalation_id: string | null;
};

const examples = [
  {
    id: "complete",
    label: "Consulta completa",
    channel: "ctwa",
    message:
      "Tengo aproximadamente $12,000 en tarjetas y vivo en TX. ¿Puedo hablar con un consejero?",
  },
  {
    id: "incomplete",
    label: "Faltan datos",
    channel: "organic",
    message: "Necesito orientación sobre mis tarjetas, ¿qué datos necesitan?",
  },
  {
    id: "risk",
    label: "Revisión humana",
    channel: "organic",
    message:
      "Recibí una demanda y quiero hablar con una persona antes de continuar.",
  },
  {
    id: "optout",
    label: "Solicitud de baja",
    channel: "organic",
    message: "No me escriban más, por favor.",
  },
] as const;

const decisions: Record<string, string> = {
  respond: "Preparar respuesta",
  escalate_human: "Escalar a una persona",
  ignore: "No continuar contacto",
};
const reasons: Record<string, string> = {
  safe_inquiry: "Consulta apta para revisión",
  legal_or_risk: "Lenguaje legal o de riesgo",
  requested_handoff: "Solicitó atención humana",
  sensitive_data: "Información sensible",
  explicit_opt_out: "Retiró consentimiento",
  synthetic_sla_fixture: "Revisión de SLA",
};
const debtTypeLabels: Record<string, string> = {
  credit_card: "Tarjetas de crédito",
  medical: "Deuda médica",
  personal_loan: "Préstamo personal",
};

function dateText(value: string) {
  return new Date(value).toLocaleString("es-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
function detail(value: unknown) {
  return typeof value === "string"
    ? value
    : "Revisa los datos o vuelve a intentarlo.";
}

export default function ReviewQueue() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [channel, setChannel] = useState<"ctwa" | "organic">("ctwa");
  const [messageText, setMessageText] = useState<string>(examples[0].message);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [leadResponse, draftResponse] = await Promise.all([
      fetch("/api/operations/operational/redacted-leads", {
        cache: "no-store",
      }),
      fetch("/api/operations/drafts", { cache: "no-store" }),
    ]);
    if (!leadResponse.ok || !draftResponse.ok) {
      setError(
        "No fue posible cargar las entradas. Revisa tu sesión y permisos.",
      );
      setLoading(false);
      return;
    }
    const nextLeads = (await leadResponse.json()) as Lead[];
    setLeads(nextLeads);
    setDrafts((await draftResponse.json()) as Draft[]);
    const requested = new URLSearchParams(window.location.search).get("lead");
    setSelectedId((current) => {
      if (current && nextLeads.some((lead) => lead.source_event_id === current))
        return current;
      return requested ?? nextLeads[0]?.source_event_id ?? null;
    });
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selected = leads.find((lead) => lead.source_event_id === selectedId);
  const hasDetectedFields = Object.values(
    selected?.extracted_fields ?? {},
  ).some((value) => value !== null);
  const requestedLead = new URLSearchParams(
    typeof window === "undefined" ? "" : window.location.search,
  ).get("lead");
  const selectedDrafts = drafts.filter(
    (draft) => draft.decision_id === selected?.decision_id,
  );
  async function ingest() {
    const message = messageText.trim();
    if (!message) {
      setMessage("Escribe un mensaje antes de procesarlo.");
      return;
    }
    setBusy(true);
    setMessage("");
    const id = crypto.randomUUID();
    try {
      const response = await fetch("/api/operations/ingestion/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_event_id: "web-" + id,
          inbound_at: new Date().toISOString(),
          channel,
          source_detail:
            channel === "ctwa" ? "Anuncio de creador" : "Entrada directa",
          creator_business_id: channel === "ctwa" ? "CR-001" : null,
          message,
          fictional_phone: "+15550185",
          consent: {
            status: "granted",
            source: "inbound",
            conversation_window_open: true,
          },
          synthetic: true,
          correlation_id: "web-" + id,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(detail(payload.detail));
      const processed = payload as Result;
      setResult(processed);
      setSelectedId(processed.lead_id);
      setMessage(
        "Entrada registrada y clasificada. Revisa la decisión y su siguiente acción.",
      );
      await load();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "No se procesó la entrada.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function approve(draft: Draft) {
    setBusy(true);
    try {
      const response = await fetch(
        "/api/operations/drafts/" + draft.id + "/approve",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: edits[draft.id] ?? draft.content,
            correlation_id: "review-" + crypto.randomUUID(),
          }),
        },
      );
      const payload = await response.json();
      setMessage(
        response.ok
          ? "Borrador aprobado y auditado. No se envió un mensaje."
          : "Aprobación bloqueada: " + detail(payload.detail),
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-stack">
      <section className="panel intake-panel">
        <div>
          <span className="section-kicker">01 · Entrada y decisión</span>
          <h2>Procesar un mensaje nuevo</h2>
          <p>
            Escribe una consulta realista o carga un caso rápido. La entrada se
            registra, se clasifica y conserva su trazabilidad.
          </p>
        </div>
        <div className="intake-controls">
          <label className="intake-channel">
            Origen
            <select
              value={channel}
              onChange={(event) =>
                setChannel(event.target.value as "ctwa" | "organic")
              }
            >
              <option value="ctwa">Anuncio de creador</option>
              <option value="organic">Entrada directa</option>
            </select>
          </label>
          <label className="intake-message">
            Mensaje entrante
            <textarea
              value={messageText}
              maxLength={4000}
              rows={4}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder="Escribe el mensaje que quieres procesar…"
            />
          </label>
          <div className="quick-cases" aria-label="Casos rápidos">
            <span>Casos rápidos</span>
            {examples.map((item) => (
              <button
                type="button"
                className="secondary-button"
                key={item.id}
                onClick={() => {
                  setChannel(item.channel);
                  setMessageText(item.message);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button disabled={busy} onClick={() => void ingest()}>
            {busy ? "Procesando…" : "Ingresar mensaje"}
          </button>
        </div>
      </section>
      {result && (
        <section className="result-banner" role="status">
          <strong>{decisions[result.decision] ?? result.decision}</strong>
          <span>{reasons[result.reason_code] ?? result.reason_code}</span>
          <small>
            {leads.find((lead) => lead.source_event_id === result.lead_id)
              ?.business_id ?? "Caso en registro"}
          </small>
          <small>
            Asistencia: {result.ai_attempt_status} · {result.normalized_reason}
          </small>
        </section>
      )}
      {message && (
        <p className="inline-message" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="inline-message error-panel" role="alert">
          {error}
        </p>
      )}
      <div className="review-layout">
        <section className="panel inbox-panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">02 · Evidencia</span>
              <h2>Entradas recientes</h2>
            </div>
            <span className="count-pill">{leads.length}</span>
          </div>
          {loading && <p>Cargando entradas…</p>}
          {!loading && leads.length === 0 && (
            <p>Procesa un mensaje para abrir el primer caso.</p>
          )}
          <div className="inbox-list">
            {leads.map((lead) => (
              <button
                key={lead.source_event_id}
                className={
                  "inbox-item" +
                  (selectedId === lead.source_event_id ? " is-selected" : "")
                }
                onClick={() => setSelectedId(lead.source_event_id)}
                aria-pressed={selectedId === lead.source_event_id}
              >
                <span className="inbox-item-top">
                  <strong>{lead.business_id}</strong>
                  <small>{dateText(lead.received_at)}</small>
                </span>
                <span>{lead.redacted_body}</span>
                <span className={"badge badge-" + lead.decision}>
                  {decisions[lead.decision] ?? lead.decision}
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="panel case-panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">03 · Acción humana</span>
              <h2>Detalle del caso</h2>
            </div>
            {selected && (
              <span className={"badge badge-" + selected.decision}>
                {decisions[selected.decision] ?? selected.decision}
              </span>
            )}
          </div>
          {!selected ? (
            <p role={requestedLead ? "alert" : undefined}>
              {requestedLead
                ? "La entrada solicitada no está disponible. Selecciona otra de la bandeja."
                : "Selecciona una entrada para revisar su evidencia."}
            </p>
          ) : (
            <>
              <p className="case-identity">
                Caso <strong>{selected.business_id}</strong>
              </p>
              <p className="case-message">“{selected.redacted_body}”</p>
              <section
                className="extracted-summary"
                aria-label="Datos detectados del mensaje"
              >
                <div className="section-heading">
                  <h3>Datos detectados automáticamente</h3>
                  <span className="badge">
                    {!hasDetectedFields
                      ? "Sin datos detectados"
                      : selected.extraction_source === "ai_assisted"
                        ? "IA + reglas"
                        : selected.extraction_source === "deterministic"
                          ? "Reglas de extracción"
                          : "Sin extracción"}
                    {selected.extraction_corrected_at ? " · corregido" : ""}
                  </span>
                </div>
                <p>
                  {hasDetectedFields
                    ? "Datos aproximados leídos del mensaje. Una persona debe confirmarlos; no determinan elegibilidad."
                    : "Este mensaje no aportó datos verificables para extraer. La clasificación y el borrador siguen disponibles para revisión."}
                </p>
                {hasDetectedFields && (
                  <dl className="evidence-grid">
                    <div>
                      <dt>Monto mencionado</dt>
                      <dd>
                        {selected.extracted_fields?.approximate_debt == null
                          ? "No detectado"
                          : `Aprox. ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(selected.extracted_fields.approximate_debt)}`}
                      </dd>
                    </div>
                    <div>
                      <dt>Tipo de deuda</dt>
                      <dd>
                        {selected.extracted_fields?.debt_type
                          ? debtTypeLabels[selected.extracted_fields.debt_type]
                          : "No detectado"}
                      </dd>
                    </div>
                    <div>
                      <dt>Estado mencionado</dt>
                      <dd>
                        {selected.extracted_fields?.state ?? "No detectado"}
                      </dd>
                    </div>
                    <div>
                      <dt>Idioma</dt>
                      <dd>
                        {selected.extracted_fields?.preferred_language === "en"
                          ? "Inglés"
                          : selected.extracted_fields?.preferred_language ===
                              "es"
                            ? "Español"
                            : "No detectado"}
                      </dd>
                    </div>
                    <div>
                      <dt>Pidió consejero</dt>
                      <dd>
                        {selected.extracted_fields?.wants_counselor === true
                          ? "Sí"
                          : selected.extracted_fields?.wants_counselor === false
                            ? "No"
                            : "No detectado"}
                      </dd>
                    </div>
                    <div>
                      <dt>Horario preferido</dt>
                      <dd>
                        {selected.extracted_fields?.preferred_contact_time ||
                          "No detectado"}
                      </dd>
                    </div>
                  </dl>
                )}
              </section>
              <dl className="evidence-grid">
                <div>
                  <dt>Recibido</dt>
                  <dd>{dateText(selected.received_at)}</dd>
                </div>
                <div>
                  <dt>Canal</dt>
                  <dd>
                    {selected.channel === "ctwa" ? "Anuncio CTWA" : "Orgánico"}
                  </dd>
                </div>
                <div>
                  <dt>Decisión</dt>
                  <dd>{decisions[selected.decision] ?? selected.decision}</dd>
                </div>
                <div>
                  <dt>Razón</dt>
                  <dd>
                    {reasons[selected.reason_code] ?? selected.reason_code}
                  </dd>
                </div>
              </dl>
              <details>
                <summary>Identificadores de auditoría</summary>
                <p>
                  ID de entrada: <code>{selected.source_event_id}</code>
                </p>
                <p>
                  Correlación: <code>{selected.correlation_id}</code>
                </p>
              </details>
              {selected.redaction_types.length > 0 && (
                <p className="inline-message">
                  Contenido sensible redactado:{" "}
                  {selected.redaction_types.join(", ")}
                </p>
              )}
              {selectedDrafts.length > 0 ? (
                selectedDrafts.map((draft) => (
                  <div key={draft.id} className="draft-editor">
                    <div className="section-heading">
                      <h3>Borrador de respuesta</h3>
                      <span className="badge">
                        {draft.status === "pending" ? "Pendiente" : "Aprobado"}
                      </span>
                    </div>
                    <label>
                      Texto para revisión
                      <textarea
                        value={
                          edits[draft.id] ??
                          draft.approved_content ??
                          draft.content
                        }
                        readOnly={draft.status !== "pending"}
                        onChange={(event) =>
                          setEdits((current) => ({
                            ...current,
                            [draft.id]: event.target.value,
                          }))
                        }
                        rows={5}
                      />
                    </label>
                    {draft.status === "pending" && (
                      <button
                        disabled={busy}
                        onClick={() => void approve(draft)}
                      >
                        Aprobar sin entregar
                      </button>
                    )}
                    <small>
                      La aprobación registra evidencia; la entrega de contenido
                      sustantivo requiere otra acción.
                    </small>
                    {draft.status === "approved" && (
                      <Link
                        href={`/operations/crm?lead=${selected.crm_lead_id}`}
                      >
                        Continuar este caso en CRM →
                      </Link>
                    )}
                  </div>
                ))
              ) : selected.decision === "escalate_human" ? (
                <div className="next-action">
                  <strong>Requiere atención humana</strong>
                  <p>La tarea, su prioridad y vencimiento están en CRM.</p>
                  <Link href="/operations/work">Ver escalaciones →</Link>
                </div>
              ) : (
                <p>Esta decisión no genera borrador de respuesta.</p>
              )}
              <div className="related-links">
                <Link href="/rules">Ver reglas →</Link>
                <Link href={`/operations/crm?lead=${selected.crm_lead_id}`}>
                  Abrir este caso en CRM →
                </Link>
                <Link href="/operations/ai">Ver ejecuciones →</Link>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
