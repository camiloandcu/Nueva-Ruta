export type MessageEvidence = {
  crm_lead_id: string;
  draft_kind: "intake" | "follow_up";
  draft_id: string;
  content: string;
  approved_at: string;
  delivery_event_id: string | null;
  delivered_at: string | null;
};

type Props = {
  commercialStage: string;
  optedOut: boolean | null;
  evidence: MessageEvidence[];
  loading: boolean;
  recordDelivery: (
    kind: MessageEvidence["draft_kind"],
    draftId: string,
  ) => void;
};

export function CrmMessageEvidence({
  commercialStage,
  optedOut,
  evidence,
  loading,
  recordDelivery,
}: Props) {
  const eligible = [
    "prequalified",
    "contact_attempted",
    "info_sent",
    "callback_scheduled",
    "transferred",
  ].includes(commercialStage);

  return (
    <section
      className="crm-message-evidence"
      aria-label="Mensajes aprobados del caso"
    >
      <h3>Mensajes aprobados de este caso</h3>
      {loading && <p>Cargando evidencia…</p>}
      {!loading && evidence.length === 0 && (
        <p>Aún no hay mensajes aprobados para este caso.</p>
      )}
      {evidence.map((item) => (
        <article key={item.draft_id} className="evidence-card">
          <strong>
            {item.draft_kind === "intake"
              ? "Borrador de entrada"
              : "Seguimiento CRM"}
          </strong>
          <p>{item.content}</p>
          <small>
            Aprobado: {new Date(item.approved_at).toLocaleString("es-CO")}
          </small>
          <p>
            {item.delivered_at
              ? `Entrega simulada registrada: ${new Date(item.delivered_at).toLocaleString("es-CO")}`
              : "Aprobado, sin entrega registrada"}
          </p>
          {!item.delivery_event_id && (
            <button
              type="button"
              disabled={Boolean(optedOut) || !eligible}
              onClick={() => recordDelivery(item.draft_kind, item.draft_id)}
            >
              Registrar entrega simulada
            </button>
          )}
        </article>
      ))}
      {["new", "under_review"].includes(commercialStage) &&
        evidence.length > 0 && (
          <p>Califica el caso para habilitar el registro de entrega.</p>
        )}
    </section>
  );
}
