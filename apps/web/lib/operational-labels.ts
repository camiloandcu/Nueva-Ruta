const stages: Record<string, string> = {
  new: "Nuevo",
  under_review: "En revisión",
  prequalified: "Precalificado",
  contact_attempted: "Contacto intentado",
  info_sent: "Información enviada",
  callback_scheduled: "Devolver llamada",
  transferred: "Transferido",
  enrolled: "Inscrito",
  closed_not_interested: "Cerrado: sin interés",
};

const statuses: Record<string, string> = {
  pending: "Pendiente",
  pending_review: "Pendiente de revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
  assigned: "Asignado",
  in_review: "En revisión",
  resolved: "Resuelto",
  closed_with_reason: "Cerrado con motivo",
  open: "Abierto",
  delivered: "Entregado",
  retry_scheduled: "Reintento programado",
  dead_letter: "Requiere recuperación",
  processing: "En proceso",
  accepted: "Aceptado",
  breached: "Vencido",
  approaching: "Próximo a vencer",
  within: "Dentro del plazo",
  missing_evidence: "Falta evidencia",
  unknown: "Sin dato",
  withdrawn: "Revocado",
  granted: "Otorgado",
  valid: "Vigente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  normal: "Normal",
  urgent: "Urgente",
  success: "Correcto",
  retryable_failure: "Fallo reintentable",
  permanent_failure: "Fallo permanente",
};

const reasons: Record<string, string> = {
  safe_inquiry: "Consulta apta",
  legal_or_risk: "Consulta legal o de riesgo",
  missing_phone: "Falta teléfono",
  invalid_disposition: "Disposición inválida",
  partner_delivery: "Entrega al socio",
  synthetic_sla_fixture: "Revisión de plazo",
};

const dispositions: Record<string, string> = {
  "No Answer": "No respondió",
  "Info Sent": "Información enviada",
  Transferido: "Transferido",
  "Call Back": "Devolver llamada",
  "No le interesa": "No le interesa",
};

export function stageLabel(value: string) {
  return stages[value] ?? value.replaceAll("_", " ");
}

export function statusLabel(value: string) {
  return statuses[value] ?? value.replaceAll("_", " ");
}

export function reasonLabel(value: string) {
  return (
    reasons[value] ??
    stages[value] ??
    statuses[value] ??
    value.replaceAll("_", " ")
  );
}

export function dispositionLabel(value: string) {
  return dispositions[value] ?? value;
}

export function channelLabel(value: string | null) {
  if (value === "ctwa") return "Anuncio a WhatsApp";
  if (value === "organic") return "Orgánico";
  return "Sin canal registrado";
}

export function nextCaseAction(
  stage: string,
  optedOut: boolean,
  hasUndeliveredDraft: boolean,
) {
  if (optedOut) return "Contacto revocado: revisar el historial del caso.";
  if (stage === "new" || stage === "under_review")
    return "Revisar elegibilidad y calificar el caso.";
  if (stage === "closed_not_interested" || stage === "enrolled")
    return "Consultar el historial del caso.";
  if (hasUndeliveredDraft)
    return "Revisar el borrador y registrar la entrega si corresponde.";
  if (stage === "transferred")
    return "Consultar la entrega al socio y su resultado.";
  return "Registrar la siguiente acción comercial o programar seguimiento.";
}
