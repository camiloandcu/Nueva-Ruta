import { expect, test } from "@playwright/test";

const email = process.env.DEMO_OPERATOR_EMAIL;
const password = process.env.DEMO_OPERATOR_PASSWORD;

test("approved intake draft appears in CRM and delivery evidence advances only its case", async ({
  page,
}) => {
  if (!email || !password)
    throw new Error("Demo operator credentials are required");
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(
    page.getByRole("button", { name: "Cerrar sesión" }),
  ).toBeVisible();

  await page.goto("/operations/review");
  await page.getByRole("button", { name: "Ingresar mensaje" }).click();
  await expect(
    page.getByText("Entrada registrada y clasificada"),
  ).toBeVisible();
  const label = await page.locator(".case-identity strong").innerText();
  await page.getByRole("button", { name: "Aprobar sin entregar" }).click();
  await expect(page.getByText("Borrador aprobado y auditado")).toBeVisible();
  await page.getByRole("link", { name: "Continuar este caso en CRM" }).click();
  await expect(page).toHaveURL(/\/operations\/crm\?lead=[0-9a-f-]{36}$/);
  const leadId = new URL(page.url()).searchParams.get("lead");
  expect(leadId).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByText(label, { exact: true })).toBeVisible();

  const evidence = page.getByRole("region", {
    name: "Mensajes aprobados del caso",
  });
  await expect(evidence.getByText("Borrador de entrada")).toBeVisible();
  await expect(
    evidence.getByText("Aprobado, sin entrega registrada"),
  ).toBeVisible();
  await expect(
    evidence.getByRole("button", { name: "Registrar entrega simulada" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Marcar como pre-calificado" })
    .click();
  await expect(
    evidence.getByRole("button", { name: "Registrar entrega simulada" }),
  ).toBeEnabled();

  await page.getByLabel("Disposición").selectOption("Info Sent");
  await page
    .getByLabel("Motivo")
    .fill("El mensaje fue enviado en el simulador");
  await page.getByRole("button", { name: "Registrar disposición" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Registra una entrega simulada",
  );
  await expect(
    page.locator(".crm-workspace .evidence-card").first(),
  ).toContainText("prequalified");

  await evidence
    .getByRole("button", { name: "Registrar entrega simulada" })
    .click();
  await expect(
    evidence.getByText(/Entrega simulada registrada:/),
  ).toBeVisible();
  await expect(page.getByLabel("Entrega simulada del caso")).not.toHaveValue(
    "",
  );
  await expect(page.getByLabel("Motivo")).toHaveValue(
    "El mensaje fue enviado en el simulador",
  );

  const ownEvidenceResponse = await page.request.get(
    `/api/operations/crm/leads/${leadId}/message-evidence`,
  );
  expect(ownEvidenceResponse.ok()).toBeTruthy();
  const ownEvidence = (await ownEvidenceResponse.json()) as {
    draft_id: string;
    delivery_event_id: string;
  }[];
  expect(ownEvidence).toHaveLength(1);
  expect(ownEvidence[0].delivery_event_id).toBeTruthy();

  const leadsResponse = await page.request.get("/api/operations/crm/leads");
  const leads = (await leadsResponse.json()) as { id: string }[];
  const otherLead = leads.find((lead) => lead.id !== leadId);
  expect(otherLead).toBeTruthy();
  const otherEvidenceResponse = await page.request.get(
    `/api/operations/crm/leads/${otherLead?.id}/message-evidence`,
  );
  expect(otherEvidenceResponse.ok()).toBeTruthy();
  const otherEvidence = (await otherEvidenceResponse.json()) as {
    draft_id: string;
  }[];
  expect(
    otherEvidence.some((item) => item.draft_id === ownEvidence[0].draft_id),
  ).toBeFalsy();

  await page.getByRole("button", { name: "Registrar disposición" }).click();
  await expect(page.getByRole("status")).toContainText("info_sent");
  await expect(page.locator(".audit-event small").first()).toContainText(
    "Entrega simulada registrada",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/influgain-message-delivery-mobile.png",
    fullPage: true,
  });
});
