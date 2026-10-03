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
    ];
    const responses = await Promise.all(
      endpoints.map((path) =>
        fetch(`/api/operations/crm/${path}`, { cache: "no-store" }),
      ),
    );
    if (responses[0].ok) setLeads(await responses[0].json());
    if (responses[1].ok) setEscalations(await responses[1].json());
    if (responses[2].ok) setDeliveries(await responses[2].json());
    if (responses[3].ok) setRecovery(await responses[3].json());
    if (responses[4].ok) setAttempts(await responses[4].json());
    if (responses[5].ok) setFollowupDrafts(await responses[5].json());
    if (responses[6].ok) setTeam(await responses[6].json());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, refreshKey]);

  async function command(path: string, body: unknown, method = "POST") {
    const response = await fetch(`/api/operations/crm/${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    setMessage(
      response.ok
        ? `Listo: ${JSON.stringify(result)}`
        : `No se aplicó: ${result.detail ?? "error de operación"}`,
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
    <div className="operation-grid">
      <section className="panel">
        <h2>Leads</h2>
        {leads.map((lead) => (
          <article key={lead.id} className="evidence-card">
            <strong>{lead.business_id}</strong>
            <span className="badge">{lead.commercial_stage}</span>
            {lead.redacted_body && <p>{lead.redacted_body}</p>}
            <p>Teléfono ficticio: {lead.fictional_phone ?? "No disponible"}</p>
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
      </section>

      <section className="panel">
        <h2>Escalaciones</h2>
        {escalations.map((task) => (
          <article key={task.id} className="evidence-card">
            <strong>
              {task.reason_code} · {task.priority}
            </strong>
            <p>{task.redacted_summary}</p>
            <p>
              Estado: {task.lifecycle_state} · vence{" "}
              {new Date(task.due_at).toLocaleString()}
            </p>
            {task.sla_breached && (
              <span className="badge badge-escalate_human">SLA vencido</span>
            )}
            <button
              onClick={() =>
                void command(`escalations/${task.id}/actions`, {
                  action: "claim",
                  correlation_id: `crm-${crypto.randomUUID()}`,
                })
              }
            >
              Tomar caso
            </button>
            <label>
              Asignar a
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
                <option value="">Seleccionar operador (supervisor)</option>
                {team.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.display_name} · {member.role}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() =>
                void command(`escalations/${task.id}/actions`, {
                  action: "resolve",
                  reason: "Revisión completada por el operador",
                  resolution_action: "request_information",
                  correlation_id: `crm-${crypto.randomUUID()}`,
                })
              }
            >
              Resolver
            </button>
            <button
              onClick={() =>
                void command(`escalations/${task.id}/actions`, {
                  action: "close",
                  reason: "Cierre por supervisor",
                  correlation_id: `crm-${crypto.randomUUID()}`,
                })
              }
            >
              Cerrar con motivo (supervisor)
            </button>
          </article>
        ))}

        <h2>Recuperación</h2>
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
        <p aria-live="polite">{message}</p>
      </section>
    </div>
  );
}
