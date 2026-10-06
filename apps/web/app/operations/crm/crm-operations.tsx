"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  CrmMessageEvidence,
  type MessageEvidence,
} from "./crm-message-evidence";
import ExtractedFieldsEditor, {
  type ExtractedFields,
} from "./extracted-fields-editor";
import {
  channelLabel,
  dispositionLabel,
  nextCaseAction,
  reasonLabel,
  stageLabel,
  statusLabel,
} from "../../../lib/operational-labels";

type Lead = {
  id: string;
  business_id: string;
  source_event_id: string | null;
  commercial_stage: string;
  fictional_phone: string | null;
  opted_out: boolean | null;
  redacted_body: string | null;
  consent_status: string;
  source_channel: string | null;
  extracted_fields: ExtractedFields | null;
  extraction_source: "deterministic" | "ai_assisted" | null;
  extraction_corrected_at: string | null;
};
type Escalation = {
  id: string;
  reason_code: string;
  priority: string;
  lifecycle_state: string;
  owner_id: string | null;
  due_at: string;
  sla_breached: boolean;
  redacted_summary: string;
  crm_lead_id: string | null;
  business_id: string | null;
};
type TeamMember = { id: string; display_name: string; role: string };
type CrmAccess = { id: string; role: "operator" | "supervisor" };
type Delivery = {
  id: string;
  status: string;
  attempt_count: number;
  last_error_category: string | null;
  crm_lead_id: string;
  business_id: string;
};
type Attempt = {
  id: number;
  outbox_event_id: string;
  outcome: string;
  error_category: string | null;
  completed_at: string;
  crm_lead_id: string;
  business_id: string;
};
type Recovery = {
  id: string;
  reason_code: string;
  details: string;
  created_at: string;
  crm_lead_id: string;
  business_id: string;
};
type FollowupDraft = {
  id: string;
  crm_lead_id: string;
  content: string;
  status: string;
  content_checksum: string;
  business_id: string;
};
type DispositionEvent = {
  id: string;
  crm_lead_id: string;
  disposition: string;
  prior_stage: string;
  resulting_stage: string;
  reason: string;
  side_effect_status: string;
  occurred_at: string;
  correlation_id: string;
};
const dispositionOptions = [
  "No Answer",
  "Info Sent",
  "Transferido",
  "Call Back",
  "No le interesa",
];

const stageOrder = [
  "new",
  "under_review",
  "prequalified",
  "contact_attempted",
  "info_sent",
  "callback_scheduled",
  "transferred",
  "enrolled",
  "closed_not_interested",
];

export default function CrmOperations({
  view = "cases",
}: {
  view?: "cases" | "operation";
}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [recovery, setRecovery] = useState<Recovery[]>([]);
  const [followupDrafts, setFollowupDrafts] = useState<FollowupDraft[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [access, setAccess] = useState<CrmAccess | null>(null);
  const [queueView, setQueueView] = useState<"all" | "mine" | "unassigned">(
    "all",
  );
  const [visibleEscalationCount, setVisibleEscalationCount] = useState(8);
  const [assignmentSelection, setAssignmentSelection] = useState<
    Record<string, string>
  >({});
  const [dispositions, setDispositions] = useState<DispositionEvent[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [requestedLeadId, setRequestedLeadId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState("");
  const [caseSearch, setCaseSearch] = useState("");
  const [message, setMessage] = useState("");
  const [messageScope, setMessageScope] = useState<"case" | "queue">("case");
  const [mode, setMode] = useState("success");
  const [refreshKey, setRefreshKey] = useState(0);
  const [messageEvidence, setMessageEvidence] = useState<MessageEvidence[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [disposition, setDisposition] = useState("No Answer");
  const [dispositionReason, setDispositionReason] = useState("");
  const [manualReference, setManualReference] = useState("");
  const [sectionErrors, setSectionErrors] = useState<Record<string, boolean>>(
    {},
  );
  const [sectionsLoaded, setSectionsLoaded] = useState<Record<string, boolean>>(
    {},
  );
  const [evidenceError, setEvidenceError] = useState(false);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [deliveryFeedback, setDeliveryFeedback] = useState("");

  const loadSection = useCallback(async (path: string) => {
    try {
      const response = await fetch(`/api/operations/crm/${path}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(path);
      const loaded = await response.json();
      setSectionErrors((current) => ({ ...current, [path]: false }));
      setSectionsLoaded((current) => ({ ...current, [path]: true }));
      if (path === "leads") {
        const typed = loaded as Lead[];
        setLeads(typed);
        const requested = new URLSearchParams(window.location.search).get(
          "lead",
        );
        setRequestedLeadId(requested);
        setSelectedLeadId(
          (current) => current || requested || typed[0]?.id || "",
        );
      }
      if (path === "escalations") setEscalations(loaded);
      if (path === "deliveries") setDeliveries(loaded);
      if (path === "recovery") setRecovery(loaded);
      if (path === "delivery-attempts") setAttempts(loaded);
      if (path === "follow-up-drafts") setFollowupDrafts(loaded);
      if (path === "team") setTeam(loaded);
      if (path === "access") setAccess(loaded);
      if (path === "dispositions") setDispositions(loaded);
    } catch {
      setSectionErrors((current) => ({ ...current, [path]: true }));
      setSectionsLoaded((current) => ({ ...current, [path]: true }));
    }
  }, []);

  const load = useCallback(async () => {
    await Promise.all(
      [
        "leads",
        "escalations",
        "deliveries",
        "recovery",
        "delivery-attempts",
        "follow-up-drafts",
        "team",
        "access",
        "dispositions",
      ].map(loadSection),
    );
  }, [loadSection]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, refreshKey]);

  useEffect(() => {
    const followUrl = () => {
      const requested = new URLSearchParams(window.location.search).get("lead");
      setRequestedLeadId(requested);
      setSelectedLeadId(requested ?? leads[0]?.id ?? "");
      setMessageEvidence([]);
      setSelectedDeliveryId("");
      setDisposition("No Answer");
      setDispositionReason("");
      setManualReference("");
      setMessage("");
    };
    window.addEventListener("popstate", followUrl);
    return () => window.removeEventListener("popstate", followUrl);
  }, [leads]);

  useEffect(() => {
    if (!selectedLeadId) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setEvidenceLoading(true);
      setEvidenceError(false);
      void fetch(
        `/api/operations/crm/leads/${selectedLeadId}/message-evidence`,
        {
          cache: "no-store",
        },
      )
        .then(async (response) => {
          if (!response.ok)
            throw new Error("No se pudo cargar la evidencia del caso.");
          return (await response.json()) as MessageEvidence[];
        })
        .then((evidence) => {
          if (!active) return;
          setMessageEvidence(evidence);
          setSelectedDeliveryId(
            evidence.find((item) => item.delivery_event_id)
              ?.delivery_event_id ?? "",
          );
        })
        .catch(() => {
          if (active) setEvidenceError(true);
        })
        .finally(() => {
          if (active) setEvidenceLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [selectedLeadId, refreshKey]);

  const filteredLeads = leads.filter(
    (lead) =>
      lead.id === selectedLeadId ||
      ((!stageFilter || lead.commercial_stage === stageFilter) &&
        (!caseSearch ||
          `${lead.business_id} ${lead.redacted_body ?? ""}`
            .toLocaleLowerCase()
            .includes(caseSearch.toLocaleLowerCase()))),
  );
  const availableStages = stageOrder.filter((stage) =>
    leads.some((lead) => lead.commercial_stage === stage),
  );
  const selectedLead = leads.find((lead) => lead.id === selectedLeadId);
  const selectedHistory = dispositions.filter(
    (event) => event.crm_lead_id === selectedLeadId,
  );
  const pendingDeliveryCount = deliveries.filter((item) =>
    ["pending", "retry_scheduled"].includes(item.status),
  ).length;
  const visibleEscalations = escalations
    .filter((task) => {
      if (queueView === "mine") return task.owner_id === access?.id;
      if (queueView === "unassigned") return !task.owner_id;
      return true;
    })
    .sort((first, second) => {
      const firstRank =
        (first.priority === "urgent" ? 2 : 0) + (first.sla_breached ? 1 : 0);
      const secondRank =
        (second.priority === "urgent" ? 2 : 0) + (second.sla_breached ? 1 : 0);
      return (
        secondRank - firstRank ||
        new Date(first.due_at).getTime() - new Date(second.due_at).getTime()
      );
    });
  const ownerName = (ownerId: string | null) =>
    ownerId
      ? (team.find((member) => member.id === ownerId)?.display_name ??
        "Responsable no disponible")
      : "Sin responsable";
  const retrySection = (path: string) =>
    sectionErrors[path] && (
      <p role="alert">
        No se pudo cargar esta sección.{" "}
        <button type="button" onClick={() => void loadSection(path)}>
          Reintentar
        </button>
      </p>
    );
  const loadingSection = (path: string) =>
    !sectionsLoaded[path] && <p>Cargando sección…</p>;
  function selectLead(id: string) {
    setSelectedLeadId(id);
    setRequestedLeadId(id);
    setMessageEvidence([]);
    setSelectedDeliveryId("");
    setDisposition("No Answer");
    setDispositionReason("");
    setManualReference("");
    setMessage("");
  }
  const caseLink = (businessId: string | null, id: string | null) =>
    id && businessId ? (
      <Link
        className="case-record-link"
        href={`/operations/crm?lead=${id}`}
        onClick={() => selectLead(id)}
      >
        {businessId} · Abrir caso
      </Link>
    ) : (
      <span className="case-record-link">Sin caso CRM vinculado</span>
    );

  async function command(path: string, body: unknown, method = "POST") {
    if (busyPath) return false;
    setBusyPath(path);
    if (path === "deliveries/process") setDeliveryFeedback("");
    setMessageScope(
      path.startsWith("leads/") || path === "transfers/approve"
        ? "case"
        : "queue",
    );
    try {
      const response = await fetch(`/api/operations/crm/${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "GET" ? undefined : JSON.stringify(body),
      });
      const result = await response.json();
      if (path === "deliveries/process") {
        setDeliveryFeedback(
          response.ok
            ? result.processed > 0
              ? `${result.processed} entrega${result.processed === 1 ? "" : "s"} procesada${result.processed === 1 ? "" : "s"}. Revisa el estado y el historial de intentos debajo.`
              : "No había entregas listas para procesar. Aprueba una transferencia desde un caso o espera el próximo reintento programado."
            : "No se procesaron las entregas. Revisa el simulador y vuelve a intentar.",
        );
      }
      setMessage(
        response.ok
          ? result.lifecycle_state
            ? `Estado de la escalación actualizado: ${statusLabel(result.lifecycle_state)}.`
            : result.prior_stage && result.commercial_stage
              ? "Disposición registrada: " +
                stageLabel(result.prior_stage) +
                " → " +
                stageLabel(result.commercial_stage)
              : "Acción registrada. La evidencia se actualizó."
          : "No se aplicó: " +
              (typeof result.detail === "string"
                ? result.detail
                : "revisa el estado y los datos requeridos."),
      );
      if (response.ok) setRefreshKey((value) => value + 1);
      return response.ok;
    } catch {
      if (path === "deliveries/process") {
        setDeliveryFeedback(
          "No se pudo conectar con el procesador. Vuelve a intentar.",
        );
      }
      setMessage(
        "No se pudo conectar con el CRM. Vuelve a intentar la acción.",
      );
      return false;
    } finally {
      setBusyPath(null);
    }
  }

  async function submitDisposition(form: FormData, lead: Lead) {
    const disposition = String(form.get("disposition"));
    if (disposition === "Call Back" && !String(form.get("callback_at"))) {
      setMessageScope("case");
      setMessage("Selecciona una fecha futura para la devolución de llamada.");
      return;
    }
    const body: Record<string, unknown> = {
      disposition,
      idempotency_key: crypto.randomUUID(),
      reason: dispositionReason,
      correlation_id: `crm-${crypto.randomUUID()}`,
      explicit_opt_out:
        disposition === "No le interesa" &&
        Boolean(form.get("explicit_opt_out")),
    };
    if (disposition === "Info Sent") {
      const enteredReference = manualReference.trim();
      if (enteredReference) body.external_action_reference = enteredReference;
      else if (selectedDeliveryId) body.delivery_event_id = selectedDeliveryId;
      else {
        setMessageScope("case");
        setMessage(
          "Registra una entrega simulada o documenta la acción manual antes de marcar Info Sent.",
        );
        return;
      }
    }
    if (disposition === "Call Back") {
      body.callback_at = new Date(
        String(form.get("callback_at")),
      ).toISOString();
      body.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    if (await command(`leads/${lead.id}/dispositions`, body)) {
      setDispositionReason("");
      setManualReference("");
    }
  }

  return (
    <div className="workspace-stack">
      {view === "cases" && (
        <section className="panel crm-selector">
          <div className="section-heading">
            <div>
              <h2>Seleccionar caso</h2>
            </div>
            <span className="count-pill">{leads.length} casos</span>
          </div>
          <p>
            Filtra por etapa o busca un código LEAD para continuar el caso
            correcto.
          </p>
          <div
            className="stage-picker"
            role="group"
            aria-label="Etapas comerciales"
          >
            <button
              type="button"
              aria-pressed={!stageFilter}
              onClick={() => setStageFilter("")}
            >
              Todas <span>{leads.length}</span>
            </button>
            {availableStages.map((stage) => (
              <button
                type="button"
                key={stage}
                aria-pressed={stageFilter === stage}
                onClick={() => setStageFilter(stage)}
              >
                {stageLabel(stage)}{" "}
                <span>
                  {
                    leads.filter((lead) => lead.commercial_stage === stage)
                      .length
                  }
                </span>
              </button>
            ))}
          </div>
          <div className="filter-row">
            <label>
              Buscar caso
              <input
                type="search"
                value={caseSearch}
                onChange={(event) => setCaseSearch(event.target.value)}
                placeholder="LEAD-123 o texto de la consulta"
              />
            </label>
            <label>
              Caso
              <select
                value={selectedLeadId}
                onChange={(event) => {
                  selectLead(event.target.value);
                  window.history.replaceState(
                    null,
                    "",
                    `?lead=${event.target.value}`,
                  );
                }}
              >
                {filteredLeads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.business_id} · {stageLabel(lead.commercial_stage)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="selection-hint">
            {filteredLeads.length} opciones · El caso abierto sigue visible
            aunque cambies los filtros.
          </p>
          {retrySection("leads")}
          {loadingSection("leads")}
        </section>
      )}
      <div
        className={`operation-grid crm-workspace ${view === "cases" ? "crm-cases" : ""}`}
      >
        {view === "cases" && (
          <section className="panel">
            <h2>Caso seleccionado</h2>
            {messageScope === "case" && message && (
              <p className="inline-message" role="status" aria-live="polite">
                {message}
              </p>
            )}
            {selectedLead &&
              [selectedLead].map((lead) => (
                <article key={lead.id} className="evidence-card">
                  <strong>{lead.business_id}</strong>
                  <span className="badge">
                    {stageLabel(lead.commercial_stage)}
                  </span>
                  <p>
                    Origen: {channelLabel(lead.source_channel)} ·
                    Consentimiento: {statusLabel(lead.consent_status)}
                  </p>
                  <p className="case-next-action">
                    <strong>Siguiente paso:</strong>{" "}
                    {nextCaseAction(
                      lead.commercial_stage,
                      Boolean(lead.opted_out),
                      messageEvidence.some((item) => !item.delivery_event_id),
                    )}
                  </p>
                  {lead.source_event_id && (
                    <Link
                      href={`/operations/review?lead=${lead.source_event_id}`}
                    >
                      Ver entrada de este caso →
                    </Link>
                  )}
                  {lead.redacted_body && <p>{lead.redacted_body}</p>}
                  {lead.source_event_id && (
                    <ExtractedFieldsEditor
                      leadId={lead.id}
                      fields={lead.extracted_fields}
                      source={lead.extraction_source}
                      correctedAt={lead.extraction_corrected_at}
                      onSaved={() => setRefreshKey((value) => value + 1)}
                    />
                  )}
                  <p>Teléfono: {lead.fictional_phone ?? "No disponible"}</p>
                  {lead.opted_out && (
                    <p>Contacto revocado · transferencia bloqueada</p>
                  )}
                  <details>
                    <summary>Identificadores de auditoría</summary>
                    <p>
                      ID del caso: <code>{lead.id}</code>
                    </p>
                    {lead.source_event_id && (
                      <p>
                        ID de entrada: <code>{lead.source_event_id}</code>
                      </p>
                    )}
                  </details>
                  {["new", "under_review"].includes(lead.commercial_stage) &&
                    !lead.opted_out && (
                      <button
                        onClick={() =>
                          void command(`leads/${lead.id}/qualify`, {
                            reason: "Revisión manual de elegibilidad",
                            correlation_id: `crm-${crypto.randomUUID()}`,
                          })
                        }
                      >
                        Marcar como pre-calificado
                      </button>
                    )}
                  <CrmMessageEvidence
                    commercialStage={lead.commercial_stage}
                    optedOut={lead.opted_out}
                    evidence={messageEvidence}
                    loading={evidenceLoading}
                    error={evidenceError}
                    retry={() => setRefreshKey((value) => value + 1)}
                    recordDelivery={(draftKind, draftId) => {
                      void command(`leads/${lead.id}/message-deliveries`, {
                        draft_kind: draftKind,
                        draft_id: draftId,
                        idempotency_key: crypto.randomUUID(),
                        correlation_id: `crm-${crypto.randomUUID()}`,
                      });
                    }}
                  />
                  {["new", "under_review"].includes(lead.commercial_stage) &&
                    !lead.opted_out && (
                      <p className="action-prerequisite" role="note">
                        Para registrar una disposición, primero pulsa{" "}
                        <strong>Marcar como pre-calificado</strong>. Después
                        podrás registrar una entrega simulada si eliges
                        «Información enviada».
                      </p>
                    )}
                  <form action={(form) => void submitDisposition(form, lead)}>
                    <label>
                      Disposición
                      <select
                        name="disposition"
                        value={disposition}
                        onChange={(event) => setDisposition(event.target.value)}
                      >
                        {dispositionOptions.map((value) => (
                          <option key={value} value={value}>
                            {dispositionLabel(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Motivo
                      <input
                        name="reason"
                        value={dispositionReason}
                        onChange={(event) =>
                          setDispositionReason(event.target.value)
                        }
                        required
                        maxLength={300}
                      />
                    </label>
                    {disposition === "Info Sent" && (
                      <>
                        <label>
                          Entrega simulada del caso
                          <select
                            value={selectedDeliveryId}
                            onChange={(event) =>
                              setSelectedDeliveryId(event.target.value)
                            }
                          >
                            <option value="">Sin entrega simulada</option>
                            {messageEvidence
                              .filter((item) => item.delivery_event_id)
                              .map((item) => (
                                <option
                                  key={item.delivery_event_id}
                                  value={item.delivery_event_id ?? ""}
                                >
                                  {item.draft_kind === "intake"
                                    ? "Entrada"
                                    : "Seguimiento"}{" "}
                                  · {item.content.slice(0, 60)}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Referencia de acción manual externa (si no usas
                          entrega simulada)
                          <input
                            name="external_action_reference"
                            value={manualReference}
                            onChange={(event) =>
                              setManualReference(event.target.value)
                            }
                            maxLength={200}
                          />
                        </label>
                      </>
                    )}
                    {disposition === "Call Back" && (
                      <label>
                        Fecha y hora de devolución de llamada
                        <input
                          name="callback_at"
                          type="datetime-local"
                          required
                        />
                      </label>
                    )}
                    {disposition === "No le interesa" && (
                      <label>
                        <input name="explicit_opt_out" type="checkbox" /> La
                        persona pidió explícitamente no recibir más contacto
                      </label>
                    )}
                    <button
                      type="submit"
                      disabled={
                        lead.opted_out ||
                        lead.commercial_stage === "enrolled" ||
                        (disposition !== "No le interesa" &&
                          ![
                            "prequalified",
                            "contact_attempted",
                            "info_sent",
                            "callback_scheduled",
                            "transferred",
                          ].includes(lead.commercial_stage))
                      }
                    >
                      Registrar disposición
                    </button>
                  </form>
                  <button
                    onClick={() =>
                      void command("transfers/approve", {
                        crm_lead_id: lead.id,
                        idempotency_key: crypto.randomUUID(),
                        reason: "Aprobación explícita del operador",
                        correlation_id: `crm-${crypto.randomUUID()}`,
                      })
                    }
                    disabled={
                      lead.opted_out ||
                      ![
                        "prequalified",
                        "contact_attempted",
                        "info_sent",
                        "callback_scheduled",
                      ].includes(lead.commercial_stage)
                    }
                  >
                    Aprobar transferencia
                  </button>
                </article>
              ))}
            {!selectedLead && (
              <p role={requestedLeadId ? "alert" : undefined}>
                {requestedLeadId
                  ? "El caso solicitado no está disponible. Selecciona otro caso de la lista."
                  : "Selecciona un lead para continuar."}
              </p>
            )}
            <div className="audit-section" id="audit">
              <h3>Historial de disposiciones</h3>
              {selectedHistory.length === 0 && (
                <p>Aún no hay disposiciones registradas para este lead.</p>
              )}
              {selectedHistory.map((event) => (
                <article key={event.id} className="audit-event">
                  <strong>{dispositionLabel(event.disposition)}</strong>
                  <span>
                    {stageLabel(event.prior_stage)} →{" "}
                    {stageLabel(event.resulting_stage)}
                  </span>
                  <small>
                    {new Date(event.occurred_at).toLocaleString("es-US")} ·{" "}
                    {event.side_effect_status === "approved_draft"
                      ? "Aprobación histórica · sin constancia de entrega"
                      : event.side_effect_status === "simulated_delivery"
                        ? "Entrega simulada registrada"
                        : event.side_effect_status === "manual_action_recorded"
                          ? "Acción manual documentada"
                          : event.side_effect_status}
                  </small>
                  <p>{event.reason}</p>
                  <code>{event.correlation_id}</code>
                </article>
              ))}
            </div>
            {retrySection("dispositions")}
            {loadingSection("dispositions")}
          </section>
        )}

        {view === "operation" && (
          <section className="panel crm-operations-panel" id="escalations">
            <h2>Escalaciones de toda la operación</h2>
            <nav
              className="operation-jump-links"
              aria-label="Colas de la operación"
            >
              <a href="#escalations">Escalaciones · {escalations.length}</a>
              <a href="#recovery">Recuperación · {recovery.length}</a>
              <a href="#followups">Seguimiento · {followupDrafts.length}</a>
              <a href="#partner-deliveries">Entregas · {deliveries.length}</a>
            </nav>
            {messageScope === "queue" && message && (
              <p className="inline-message" role="status" aria-live="polite">
                {message}
              </p>
            )}
            <p>
              Filtra la cola por responsable. Cada tarjeta muestra su prioridad,
              vencimiento y siguiente acción. Solo supervisión puede asignar o
              cerrar casos.
            </p>
            {retrySection("access")}
            {loadingSection("access")}
            <div
              className="queue-filter"
              role="group"
              aria-label="Filtrar escalaciones"
            >
              <label>
                Ver casos
                <select
                  value={queueView}
                  onChange={(event) => {
                    setQueueView(event.target.value as typeof queueView);
                    setVisibleEscalationCount(8);
                  }}
                >
                  <option value="all">Toda la operación</option>
                  <option value="mine">Asignados a mí</option>
                  <option value="unassigned">Sin responsable</option>
                </select>
              </label>
              <span>{visibleEscalations.length} casos en esta vista</span>
            </div>
            {visibleEscalations.slice(0, visibleEscalationCount).map((task) => (
              <article
                key={task.id}
                className="escalation-card"
                data-escalation-id={task.id}
                data-priority={task.priority}
              >
                <div className="section-heading">
                  <div>
                    <span className="section-kicker escalation-priority">
                      {statusLabel(task.priority)}
                    </span>
                    <h3>{reasonLabel(task.reason_code)}</h3>
                  </div>
                  <span className="badge">
                    {statusLabel(task.lifecycle_state)}
                  </span>
                </div>
                <p>{task.redacted_summary}</p>
                {caseLink(task.business_id, task.crm_lead_id)}
                <dl className="escalation-meta">
                  <div>
                    <dt>Vence</dt>
                    <dd>{new Date(task.due_at).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Responsable</dt>
                    <dd>{ownerName(task.owner_id)}</dd>
                  </div>
                </dl>
                {task.sla_breached && (
                  <span className="badge badge-escalate_human">
                    SLA vencido
                  </span>
                )}
                {task.lifecycle_state === "pending" && (
                  <button
                    className="primary-action"
                    onClick={() =>
                      void command(`escalations/${task.id}/actions`, {
                        action: "claim",
                        correlation_id: `crm-${crypto.randomUUID()}`,
                      })
                    }
                  >
                    Tomar caso para mí
                  </button>
                )}
                {task.lifecycle_state === "assigned" &&
                  task.owner_id === access?.id && (
                    <button
                      className="primary-action"
                      onClick={() =>
                        void command(`escalations/${task.id}/actions`, {
                          action: "claim",
                          correlation_id: `crm-${crypto.randomUUID()}`,
                        })
                      }
                    >
                      Iniciar revisión
                    </button>
                  )}
                {task.lifecycle_state === "assigned" &&
                  task.owner_id !== access?.id && (
                    <p className="state-confirmation">
                      {ownerName(task.owner_id)} tiene este caso asignado.
                    </p>
                  )}
                {task.lifecycle_state === "in_review" &&
                  (task.owner_id === access?.id ||
                    access?.role === "supervisor") && (
                    <form
                      className="resolution-form"
                      action={(form) =>
                        void command(`escalations/${task.id}/actions`, {
                          action: "resolve",
                          resolution_action: String(
                            form.get("resolution_action"),
                          ),
                          reason: String(form.get("reason")),
                          correlation_id: `crm-${crypto.randomUUID()}`,
                        })
                      }
                    >
                      <h4>Resolver caso</h4>
                      <label>
                        Resultado
                        <select
                          name="resolution_action"
                          defaultValue="request_information"
                        >
                          <option value="request_information">
                            Solicitar información
                          </option>
                          <option value="create_draft">
                            Preparar borrador
                          </option>
                          <option value="transfer_eligibility">
                            Revisar elegibilidad
                          </option>
                          <option value="link_reconciliation">
                            Vincular conciliación
                          </option>
                        </select>
                      </label>
                      <label>
                        Nota de resolución
                        <input
                          name="reason"
                          required
                          minLength={3}
                          maxLength={300}
                        />
                      </label>
                      <button className="primary-action" type="submit">
                        Confirmar resolución
                      </button>
                    </form>
                  )}
                {task.lifecycle_state === "resolved" ||
                task.lifecycle_state === "closed_with_reason" ? (
                  <p className="state-confirmation">
                    Este caso ya fue resuelto. Su evidencia permanece en el
                    historial.
                  </p>
                ) : access?.role === "supervisor" ? (
                  <details className="supervisor-actions">
                    <summary>Acciones de supervisión</summary>
                    <label>
                      Asignar a
                      <select
                        value={assignmentSelection[task.id] ?? ""}
                        onChange={(event) =>
                          setAssignmentSelection((current) => ({
                            ...current,
                            [task.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Seleccionar responsable</option>
                        {team.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.display_name} · {member.role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="primary-action"
                      disabled={!assignmentSelection[task.id]}
                      onClick={async () => {
                        const applied = await command(
                          `escalations/${task.id}/actions`,
                          {
                            action: "assign",
                            owner_id: assignmentSelection[task.id],
                            correlation_id: `crm-${crypto.randomUUID()}`,
                          },
                        );
                        if (applied)
                          setAssignmentSelection((current) => ({
                            ...current,
                            [task.id]: "",
                          }));
                      }}
                    >
                      Confirmar asignación
                    </button>
                    {retrySection("team")}
                    {loadingSection("team")}
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        void command(`escalations/${task.id}/actions`, {
                          action: "close",
                          reason: "Cierre supervisado",
                          correlation_id: `crm-${crypto.randomUUID()}`,
                        })
                      }
                    >
                      Cerrar con motivo
                    </button>
                  </details>
                ) : null}
              </article>
            ))}
            {visibleEscalations.length > visibleEscalationCount && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setVisibleEscalationCount((count) => count + 8)}
              >
                Mostrar 8 escalaciones más ·{" "}
                {visibleEscalations.length - visibleEscalationCount} pendientes
              </button>
            )}
            {retrySection("escalations")}
            {loadingSection("escalations")}
            {sectionsLoaded.escalations &&
              !sectionErrors.escalations &&
              visibleEscalations.length === 0 && (
                <p>No hay escalaciones en esta cola.</p>
              )}

            <h2 id="recovery">Recuperación de toda la operación</h2>
            {recovery.map((item) => (
              <article key={item.id} className="evidence-card">
                <strong>{reasonLabel(item.reason_code)}</strong>
                {caseLink(item.business_id, item.crm_lead_id)}
                <p>{item.details}</p>
              </article>
            ))}
            {retrySection("recovery")}
            {loadingSection("recovery")}
            {sectionsLoaded.recovery &&
              !sectionErrors.recovery &&
              recovery.length === 0 && <p>No hay casos por recuperar.</p>}

            <h2 id="followups">
              Borradores de seguimiento de toda la operación
            </h2>
            {followupDrafts.map((draft) => (
              <article key={draft.id} className="evidence-card">
                {caseLink(draft.business_id, draft.crm_lead_id)}
                <label>
                  Borrador editable
                  <textarea
                    value={draft.content}
                    readOnly={draft.status !== "pending_review"}
                    onChange={(event) =>
                      setFollowupDrafts((current) =>
                        current.map((item) =>
                          item.id === draft.id
                            ? { ...item, content: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <strong>{statusLabel(draft.status)}</strong>
                {draft.status === "pending_review" && (
                  <button
                    onClick={() =>
                      void command(`follow-up-drafts/${draft.id}/approve`, {
                        content: draft.content,
                        reason: "Aprobación del operador",
                        correlation_id: `crm-${crypto.randomUUID()}`,
                      })
                    }
                  >
                    Aprobar borrador
                  </button>
                )}
              </article>
            ))}
            {retrySection("follow-up-drafts")}
            {loadingSection("follow-up-drafts")}
            {sectionsLoaded["follow-up-drafts"] &&
              !sectionErrors["follow-up-drafts"] &&
              followupDrafts.length === 0 && (
                <p>No hay borradores de seguimiento.</p>
              )}

            <h2 id="partner-deliveries">
              Entregas al socio de toda la operación
            </h2>
            <p>
              {pendingDeliveryCount} entrega
              {pendingDeliveryCount === 1 ? "" : "s"} pendiente
              {pendingDeliveryCount === 1 ? "" : "s"} o programada
              {pendingDeliveryCount === 1 ? "" : "s"}. Primero aprueba una
              transferencia desde su caso CRM; después prueba aquí el resultado
              del simulador.
            </p>
            <p>
              <Link href="/operations/crm">
                Abrir casos CRM para aprobar una transferencia
              </Link>
            </p>
            <label>
              Modo del simulador
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value)}
              >
                <option value="success">Éxito</option>
                <option value="retryable_failure">Fallo reintentable</option>
                <option value="permanent_failure">Fallo permanente</option>
              </select>
            </label>
            <p className="selection-hint">
              {mode === "success"
                ? "Éxito: el socio simulado acepta la entrega."
                : mode === "retryable_failure"
                  ? "Fallo reintentable: la entrega quedará programada para otro intento."
                  : "Fallo permanente: la entrega requerirá recuperación manual."}
            </p>
            <button
              disabled={
                busyPath !== null ||
                !sectionsLoaded.deliveries ||
                pendingDeliveryCount === 0
              }
              onClick={() => void command("deliveries/process", { mode })}
            >
              {busyPath === "deliveries/process"
                ? "Procesando entregas…"
                : "Procesar entregas pendientes"}
            </button>
            {deliveryFeedback && (
              <p className="inline-message" role="status" aria-live="polite">
                {deliveryFeedback}
              </p>
            )}
            {deliveries.map((delivery) => (
              <article key={delivery.id} className="evidence-card">
                <strong>{statusLabel(delivery.status)}</strong>
                {caseLink(delivery.business_id, delivery.crm_lead_id)}
                <p>
                  Intentos: {delivery.attempt_count} ·{" "}
                  {delivery.last_error_category ?? "sin error"}
                </p>
                {delivery.status === "dead_letter" && (
                  <button
                    onClick={() =>
                      void command(`deliveries/${delivery.id}/replay`, {
                        reason: "Reintento manual después de revisar el fallo",
                        correlation_id: `crm-${crypto.randomUUID()}`,
                      })
                    }
                  >
                    Reintentar manualmente
                  </button>
                )}
              </article>
            ))}
            {retrySection("deliveries")}
            {loadingSection("deliveries")}
            {sectionsLoaded.deliveries &&
              !sectionErrors.deliveries &&
              deliveries.length === 0 && <p>No hay entregas al socio.</p>}
            <h3>Historial de intentos</h3>
            {attempts.map((attempt) => (
              <article key={attempt.id} className="evidence-card">
                <strong>{statusLabel(attempt.outcome)}</strong>
                {caseLink(attempt.business_id, attempt.crm_lead_id)}
                <p>
                  {attempt.error_category ?? "sin error"} ·{" "}
                  {new Date(attempt.completed_at).toLocaleString()}
                </p>
              </article>
            ))}
            {retrySection("delivery-attempts")}
            {loadingSection("delivery-attempts")}
            {sectionsLoaded["delivery-attempts"] &&
              !sectionErrors["delivery-attempts"] &&
              attempts.length === 0 && <p>No hay intentos registrados.</p>}
          </section>
        )}
      </div>
    </div>
  );
}
