"use client";

import { useCallback, useEffect, useState } from "react";

type Lead = {
  id: string;
  business_id: string;
  commercial_stage: string;
  fictional_phone: string | null;
  opted_out: boolean | null;
  redacted_body: string | null;
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
};
type TeamMember = { id: string; display_name: string; role: string };
type Delivery = {
  id: string;
  status: string;
  attempt_count: number;
  last_error_category: string | null;
};
type Attempt = {
  id: number;
  outbox_event_id: string;
  outcome: string;
  error_category: string | null;
  completed_at: string;
};
type Recovery = {
  id: string;
  reason_code: string;
  details: string;
  created_at: string;
};
type FollowupDraft = {
  id: string;
  crm_lead_id: string;
  content: string;
  status: string;
  content_checksum: string;
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

export default function CrmOperations() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [recovery, setRecovery] = useState<Recovery[]>([]);
  const [followupDrafts, setFollowupDrafts] = useState<FollowupDraft[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [dispositions, setDispositions] = useState<DispositionEvent[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("success");
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    const endpoints = [
      "leads",
      "escalations",
      "deliveries",
      "recovery",
      "delivery-attempts",
      "follow-up-drafts",
      "team",
      "dispositions",
    ];
    const responses = await Promise.all(
      endpoints.map((path) =>
        fetch(`/api/operations/crm/${path}`, { cache: "no-store" }),
      ),
    );
    if (responses[0].ok) {
      const loaded = (await responses[0].json()) as Lead[];
      setLeads(loaded);
      setSelectedLeadId(
        (current) =>
          current ||
          loaded.find((lead) => lead.business_id === "LEAD-017")?.id ||
          loaded[0]?.id ||
          "",
      );
    }
    if (responses[1].ok) setEscalations(await responses[1].json());
    if (responses[2].ok) setDeliveries(await responses[2].json());
    if (responses[3].ok) setRecovery(await responses[3].json());
    if (responses[4].ok) setAttempts(await responses[4].json());
    if (responses[5].ok) setFollowupDrafts(await responses[5].json());
    if (responses[6].ok) setTeam(await responses[6].json());
    if (responses[7].ok) setDispositions(await responses[7].json());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, refreshKey]);

  const filteredLeads = leads.filter(
    (lead) => !stageFilter || lead.commercial_stage === stageFilter,
  );
  const selectedLead = leads.find((lead) => lead.id === selectedLeadId);
  const selectedHistory = dispositions.filter(
    (event) => event.crm_lead_id === selectedLeadId,
  );

  async function command(path: string, body: unknown, method = "POST") {
    const response = await fetch(`/api/operations/crm/${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    setMessage(
      response.ok
        ? result.lifecycle_state
          ? `Estado de la escalación actualizado: ${result.lifecycle_state}.`
          : result.prior_stage && result.commercial_stage
            ? "Disposición registrada: " +
              result.prior_stage +
              " → " +
              result.commercial_stage
            : "Acción registrada. La evidencia se actualizó."
        : "No se aplicó: " +
            (typeof result.detail === "string"
              ? result.detail
              : "revisa el estado y los datos requeridos."),
    );
    if (response.ok) setRefreshKey((value) => value + 1);
  }

  async function submitDisposition(form: FormData, lead: Lead) {
    const disposition = String(form.get("disposition"));
    if (disposition === "Call Back" && !String(form.get("callback_at"))) {
      setMessage("Selecciona una fecha futura para la devolución de llamada.");
      return;
    }
    const body: Record<string, unknown> = {
      disposition,
      idempotency_key: crypto.randomUUID(),
      reason: String(form.get("reason")),
      correlation_id: `crm-${crypto.randomUUID()}`,
      external_action_reference:
        String(form.get("external_action_reference") || "") || null,
      explicit_opt_out:
        disposition === "No le interesa" &&
        Boolean(form.get("explicit_opt_out")),
    };
    if (form.get("crm_follow_up_draft_id"))
      body.crm_follow_up_draft_id = String(form.get("crm_follow_up_draft_id"));
    if (disposition === "Call Back") {
      body.callback_at = new Date(
        String(form.get("callback_at")),
      ).toISOString();
      body.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    await command(`leads/${lead.id}/dispositions`, body);
  }

  return (
    <div className="workspace-stack">
      <section className="panel crm-selector">
        <div className="section-heading">
          <div>
            <span className="section-kicker">01 · Elegir caso</span>
            <h2>Operación comercial</h2>
          </div>
          <span className="count-pill">{leads.length} leads</span>
        </div>
        <p>
          Selecciona un lead para ver su etapa, registrar una disposición y
          revisar la evidencia posterior.
        </p>
        <div className="filter-row">
          <label>
            Etapa
            <select
              value={stageFilter}
              onChange={(event) => {
                const stage = event.target.value;
                setStageFilter(stage);
                const first = leads.find(
                  (lead) => !stage || lead.commercial_stage === stage,
                );
                if (first) setSelectedLeadId(first.id);
              }}
            >
              <option value="">Todas</option>
              {[...new Set(leads.map((lead) => lead.commercial_stage))].map(
                (stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            Lead
            <select
              value={selectedLeadId}
              onChange={(event) => setSelectedLeadId(event.target.value)}
            >
              {filteredLeads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.business_id} · {lead.commercial_stage}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="inline-message" role="status" aria-live="polite">
          {message}
        </p>
      </section>
      <div className="operation-grid crm-workspace">
        <section className="panel">
          <span className="section-kicker">02 · Disposición</span>
          <h2>Lead seleccionado</h2>
          {selectedLead &&
            [selectedLead].map((lead) => (
              <article key={lead.id} className="evidence-card">
                <strong>{lead.business_id}</strong>
                <span className="badge">{lead.commercial_stage}</span>
                {lead.redacted_body && <p>{lead.redacted_body}</p>}
                <p>Teléfono: {lead.fictional_phone ?? "No disponible"}</p>
                {lead.opted_out && (
                  <p>Contacto revocado · transferencia bloqueada</p>
                )}
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
                <form action={(form) => void submitDisposition(form, lead)}>
                  <label>
                    Disposición
                    <select name="disposition" defaultValue="No Answer">
                      {dispositionOptions.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Motivo
                    <input name="reason" required maxLength={300} />
                  </label>
                  <label>
                    Referencia de acción externa (para “Info Sent”)
                    <input name="external_action_reference" maxLength={200} />
                  </label>
                  <label>
                    Borrador aprobado (opcional)
                    <select name="crm_follow_up_draft_id" defaultValue="">
                      <option value="">Sin borrador vinculado</option>
                      {followupDrafts
                        .filter(
                          (draft) =>
                            draft.crm_lead_id === lead.id &&
                            draft.status === "approved",
                        )
                        .map((draft) => (
                          <option key={draft.id} value={draft.id}>
                            {draft.content.slice(0, 80)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Fecha y hora de devolución de llamada
                    <input name="callback_at" type="datetime-local" />
                  </label>
                  <label>
                    <input name="explicit_opt_out" type="checkbox" /> La persona
                    pidió explícitamente no recibir más contacto
                  </label>
                  <button type="submit">Registrar disposición</button>
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
          {!selectedLead && <p>Selecciona un lead para continuar.</p>}
          <div className="audit-section" id="audit">
            <h3>Historial de disposiciones</h3>
            {selectedHistory.length === 0 && (
              <p>Aún no hay disposiciones registradas para este lead.</p>
            )}
            {selectedHistory.map((event) => (
              <article key={event.id} className="audit-event">
                <strong>{event.disposition}</strong>
                <span>
                  {event.prior_stage} → {event.resulting_stage}
                </span>
                <small>
                  {new Date(event.occurred_at).toLocaleString("es-US")} ·{" "}
                  {event.side_effect_status}
                </small>
                <p>{event.reason}</p>
                <code>{event.correlation_id}</code>
              </article>
            ))}
          </div>
        </section>

        <section className="panel crm-operations-panel" id="escalations">
          <span className="section-kicker">03 · Resolver y recuperar</span>
          <h2>Escalaciones activas</h2>
          <p>
            Cada caso muestra su estado actual y una única acción principal. Las
            acciones de supervisión están separadas al final de la tarjeta.
          </p>
          {escalations.map((task) => (
            <article key={task.id} className="escalation-card">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">{task.priority}</span>
                  <h3>{task.reason_code}</h3>
                </div>
                <span className="badge">{task.lifecycle_state}</span>
              </div>
              <p>{task.redacted_summary}</p>
              <dl className="escalation-meta">
                <div>
                  <dt>Vence</dt>
                  <dd>{new Date(task.due_at).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Asignación</dt>
                  <dd>{task.owner_id ? "Caso asignado" : "Sin asignar"}</dd>
                </div>
              </dl>
              {task.sla_breached && (
                <span className="badge badge-escalate_human">SLA vencido</span>
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
                  Tomar caso
                </button>
              )}
              {task.lifecycle_state === "assigned" && (
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
              {task.lifecycle_state === "in_review" && (
                <form
                  className="resolution-form"
                  action={(form) =>
                    void command(`escalations/${task.id}/actions`, {
                      action: "resolve",
                      resolution_action: String(form.get("resolution_action")),
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
                      <option value="create_draft">Preparar borrador</option>
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
              ) : (
                <details className="supervisor-actions">
                  <summary>Acciones de supervisión</summary>
                  <label>
                    Asignar responsable
                    <select
                      defaultValue=""
                      onChange={(event) => {
                        if (event.target.value)
                          void command(`escalations/${task.id}/actions`, {
                            action: "assign",
                            owner_id: event.target.value,
                            correlation_id: `crm-${crypto.randomUUID()}`,
                          });
                      }}
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
              )}
            </article>
          ))}

          <h2>Recuperación y entregas</h2>
          {recovery.map((item) => (
            <article key={item.id} className="evidence-card">
              <strong>{item.reason_code}</strong>
              <p>{item.details}</p>
            </article>
          ))}

          <h2>Borradores de seguimiento</h2>
          {followupDrafts.map((draft) => (
            <article key={draft.id} className="evidence-card">
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
              <strong>{draft.status}</strong>
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

          <h2>Entregas del partner</h2>
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
          <button onClick={() => void command("deliveries/process", { mode })}>
            Procesar entregas pendientes
          </button>
          {deliveries.map((delivery) => (
            <article key={delivery.id} className="evidence-card">
              <strong>{delivery.status}</strong>
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
          <h3>Historial de intentos</h3>
          {attempts.map((attempt) => (
            <article key={attempt.id} className="evidence-card">
              <strong>{attempt.outcome}</strong>
              <p>
                {attempt.error_category ?? "sin error"} ·{" "}
                {new Date(attempt.completed_at).toLocaleString()}
              </p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
