"use client";

import { useState, type FormEvent } from "react";

export type ExtractedFields = {
  approximate_debt: number | null;
  debt_type: "credit_card" | "medical" | "personal_loan" | null;
  state: string | null;
  preferred_language: "es" | "en" | null;
  preferred_contact_time: string | null;
  wants_counselor: boolean | null;
};

const debtLabels: Record<NonNullable<ExtractedFields["debt_type"]>, string> = {
  credit_card: "Tarjetas de crédito",
  medical: "Deuda médica",
  personal_loan: "Préstamo personal",
};

export default function ExtractedFieldsEditor({
  leadId,
  fields: savedFields,
  source,
  correctedAt,
  onSaved,
}: {
  leadId: string;
  fields: ExtractedFields | null;
  source: "deterministic" | "ai_assisted" | null;
  correctedAt: string | null;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState<ExtractedFields | null>(savedFields);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (!savedFields || !fields) return null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fields || !savedFields || busy) return;
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch(
        `/api/operations/crm/leads/${leadId}/extracted-fields`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expected_fields: savedFields,
            fields,
            reason: reason.trim(),
            correlation_id: `crm-fields-${crypto.randomUUID()}`,
          }),
        },
      );
      if (!response.ok) {
        setFeedback(
          response.status === 409
            ? "Los datos cambiaron mientras los editabas. Recarga el caso y vuelve a revisar."
            : "No se guardó la corrección. Revisa los campos e inténtalo de nuevo.",
        );
        return;
      }
      setEditing(false);
      setReason("");
      setFeedback(
        "Corrección guardada en el caso y en el historial de auditoría.",
      );
      onSaved();
    } catch {
      setFeedback("No se pudo conectar para guardar la corrección.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="extracted-summary crm-extraction"
      aria-label="Datos del mensaje"
    >
      <div className="section-heading">
        <h3>Datos del mensaje</h3>
        <span className="badge">
          {source === "ai_assisted" ? "IA + reglas" : "Reglas de extracción"}
          {correctedAt ? " · corregido" : ""}
        </span>
      </div>
      <p>
        Estos datos orientan la revisión y pueden corregirse. Una corrección no
        cambia la decisión ni la etapa comercial.
      </p>
      {!editing ? (
        <>
          <dl className="evidence-grid">
            <div>
              <dt>Monto mencionado</dt>
              <dd>
                {savedFields.approximate_debt == null
                  ? "No detectado"
                  : `Aprox. ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(savedFields.approximate_debt)}`}
              </dd>
            </div>
            <div>
              <dt>Tipo de deuda</dt>
              <dd>
                {savedFields.debt_type
                  ? debtLabels[savedFields.debt_type]
                  : "No detectado"}
              </dd>
            </div>
            <div>
              <dt>Estado mencionado</dt>
              <dd>{savedFields.state ?? "No detectado"}</dd>
            </div>
            <div>
              <dt>Idioma</dt>
              <dd>
                {savedFields.preferred_language === "es"
                  ? "Español"
                  : savedFields.preferred_language === "en"
                    ? "Inglés"
                    : "No detectado"}
              </dd>
            </div>
            <div>
              <dt>Pidió consejero</dt>
              <dd>
                {savedFields.wants_counselor == null
                  ? "No detectado"
                  : savedFields.wants_counselor
                    ? "Sí"
                    : "No"}
              </dd>
            </div>
            <div>
              <dt>Horario preferido</dt>
              <dd>{savedFields.preferred_contact_time || "No detectado"}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => {
              setFields(savedFields);
              setEditing(true);
            }}
          >
            Corregir datos detectados
          </button>
        </>
      ) : (
        <form onSubmit={(event) => void save(event)}>
          <div className="extraction-form-grid">
            <label>
              Monto aproximado en USD
              <input
                type="number"
                min="0"
                max="1000000"
                step="1"
                value={fields.approximate_debt ?? ""}
                onChange={(event) =>
                  setFields({
                    ...fields,
                    approximate_debt: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </label>
            <label>
              Tipo de deuda
              <select
                value={fields.debt_type ?? ""}
                onChange={(event) =>
                  setFields({
                    ...fields,
                    debt_type: (event.target.value ||
                      null) as ExtractedFields["debt_type"],
                  })
                }
              >
                <option value="">No detectado</option>
                {Object.entries(debtLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Estado (código de dos letras)
              <input
                maxLength={2}
                pattern="[A-Za-z]{2}"
                value={fields.state ?? ""}
                onChange={(event) =>
                  setFields({
                    ...fields,
                    state: event.target.value.toUpperCase() || null,
                  })
                }
              />
            </label>
            <label>
              Idioma
              <select
                value={fields.preferred_language ?? ""}
                onChange={(event) =>
                  setFields({
                    ...fields,
                    preferred_language: (event.target.value ||
                      null) as ExtractedFields["preferred_language"],
                  })
                }
              >
                <option value="">No detectado</option>
                <option value="es">Español</option>
                <option value="en">Inglés</option>
              </select>
            </label>
            <label>
              Pidió consejero
              <select
                value={
                  fields.wants_counselor == null
                    ? ""
                    : String(fields.wants_counselor)
                }
                onChange={(event) =>
                  setFields({
                    ...fields,
                    wants_counselor:
                      event.target.value === ""
                        ? null
                        : event.target.value === "true",
                  })
                }
              >
                <option value="">No detectado</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </label>
            <label>
              Horario preferido
              <input
                maxLength={80}
                value={fields.preferred_contact_time ?? ""}
                onChange={(event) =>
                  setFields({
                    ...fields,
                    preferred_contact_time: event.target.value || null,
                  })
                }
              />
            </label>
          </div>
          <label>
            Motivo de la corrección
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={3}
              maxLength={300}
              required
            />
          </label>
          <div className="extraction-actions">
            <button type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar corrección"}
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={() => {
                setFields(savedFields);
                setEditing(false);
                setReason("");
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {feedback && (
        <p role="status" aria-live="polite">
          {feedback}
        </p>
      )}
    </section>
  );
}
