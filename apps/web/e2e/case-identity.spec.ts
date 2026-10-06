import { expect, test } from "@playwright/test";

const email = process.env.DEMO_OPERATOR_EMAIL;
const password = process.env.DEMO_OPERATOR_PASSWORD;

test.beforeEach(async ({ page }) => {
  if (!email || !password)
    throw new Error(
      "Set DEMO_OPERATOR_EMAIL and DEMO_OPERATOR_PASSWORD in local .env",
    );
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible(
    { timeout: 15_000 },
  );
});

test("a reviewed intake event opens its exact CRM case and survives refresh", async ({
  page,
}) => {
  await page.goto("/operations/review");
  const responseBefore = await page.request.get(
    "/api/operations/operational/redacted-leads",
  );
  expect(responseBefore.ok()).toBeTruthy();
  const events = (await responseBefore.json()) as {
    external_event_id: string;
    business_id: string;
  }[];
  const fixtureLabel = events.find(
    (event) => event.external_event_id === "example-consulta-completa",
  )?.business_id;
  expect(fixtureLabel).toMatch(/^LEAD-\d{3,}$/);
  const fixture = page.getByRole("button", {
    name: new RegExp(`^${fixtureLabel}\\b`),
  });
  await expect(fixture).toBeVisible();
  await fixture.click();
  const label = await page.locator(".case-identity strong").innerText();
  expect(label).toMatch(/^LEAD-\d{3,}$/);
  await page.screenshot({
    path: "/tmp/influgain-intake-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Abrir este caso en CRM" }).click();
  await expect(page).toHaveURL(/\/operations\/crm\?lead=[0-9a-f-]{36}$/);
  await expect(
    page.locator(".crm-workspace .evidence-card").first(),
  ).toContainText(label);
  const linkedCase = new URL(page.url()).searchParams.get("lead");
  const response = await page.request.get("/api/operations/crm/leads");
  expect(response.ok()).toBeTruthy();
  const leads = (await response.json()) as {
    id: string;
    business_id: string;
  }[];
  expect(leads.find((lead) => lead.id === linkedCase)?.business_id).toBe(label);
  await page.reload();
  await expect(
    page.locator(".crm-workspace .evidence-card").first(),
  ).toContainText(label);
  await page
    .getByRole("group", { name: "Etapas comerciales" })
    .getByRole("button", { name: /Nuevo/ })
    .click();
  await expect(
    page.locator(".crm-workspace .evidence-card").first(),
  ).toContainText(label);
  await page.getByRole("link", { name: "Ver entrada de este caso" }).click();
  await expect(page.locator(".case-identity strong")).toHaveText(label);
  await page.screenshot({
    path: "/tmp/influgain-case-desktop.png",
    fullPage: true,
  });
});

test("newly ingested cases receive a label and invalid deep links never select another lead", async ({
  page,
}) => {
  await page.goto("/operations/review");
  await page.getByRole("button", { name: "Ingresar mensaje" }).click();
  await expect(page.getByText("Entrada registrada y clasificada")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator(".case-identity strong")).toHaveText(
    /^LEAD-\d{3,}$/,
  );
  const extracted = page.getByRole("region", {
    name: "Datos detectados del mensaje",
  });
  await expect(extracted).toContainText("Aprox. $12,000");
  await expect(extracted).toContainText("Tarjetas de crédito");
  await expect(extracted).toContainText("TX");
  await expect(extracted).toContainText("Una persona debe confirmarlos");
  await page.screenshot({
    path: "/tmp/influgain-extraction.png",
    fullPage: true,
  });
  const label = await page.locator(".case-identity strong").innerText();
  await page.getByRole("button", { name: "Aprobar sin entregar" }).click();
  await expect(page.getByText("Borrador aprobado y auditado")).toBeVisible();
  await page.getByRole("link", { name: "Continuar este caso en CRM" }).click();
  await expect(
    page.locator(".crm-workspace .evidence-card").first(),
  ).toContainText(label);
  await page.goto("/operations/crm?lead=00000000-0000-0000-0000-000000000000");
  await expect(page.locator(".crm-workspace p[role='alert']")).toContainText(
    "El caso solicitado no está disponible",
  );
  await expect(
    page.locator(".crm-workspace > .panel").first().locator(".evidence-card"),
  ).toHaveCount(0);
});

test("a human handoff retains AI extraction and accepts an audited CRM correction", async ({
  page,
}) => {
  await page.goto("/operations/review");
  await page
    .getByLabel("Mensaje entrante")
    .fill(
      "Tengo deudas de 5 mil dolares en prestamos y vivo en California. ¿Puedo hablar con alguien?",
    );
  await page.getByRole("button", { name: "Ingresar mensaje" }).click();
  await expect(page.getByText("Entrada registrada y clasificada")).toBeVisible({
    timeout: 30_000,
  });
  const intake = page.getByRole("region", {
    name: "Datos detectados del mensaje",
  });
  await expect(intake).toContainText("Aprox. $5,000");
  await expect(intake).toContainText("Préstamo personal");
  await expect(intake).toContainText("CA");
  await expect(intake).toContainText("Pidió consejero");
  await expect(page.getByText("Escalar a una persona").first()).toBeVisible();
  const label = await page.locator(".case-identity strong").innerText();
  await page.getByRole("link", { name: "Abrir este caso en CRM" }).click();
  await expect(
    page.locator(".crm-workspace .evidence-card").first(),
  ).toContainText(label);
  const details = page.getByRole("region", { name: "Datos del mensaje" });
  await expect(details).toContainText("Aprox. $5,000");
  await details
    .getByRole("button", { name: "Corregir datos detectados" })
    .click();
  await details.getByLabel("Monto aproximado en USD").fill("6000");
  await details
    .getByLabel("Motivo de la corrección")
    .fill("Confirmado por el operador en la demo");
  await details.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(details).toContainText("Aprox. $6,000");
  await expect(details).toContainText("corregido");
  await page.screenshot({
    path: "/tmp/influgain-correction.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Ver entrada de este caso" }).click();
  await expect(intake).toContainText("Aprox. $6,000");
  await expect(intake).toContainText("corregido");
});

test("case navigation stays usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/operations/review");
  await expect(page.locator(".inbox-item").first()).toBeVisible();
  await page.locator(".inbox-item").first().click();
  await page.getByRole("link", { name: "Abrir este caso en CRM" }).click();
  await expect(
    page.locator(".crm-workspace .evidence-card").first(),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/influgain-case-mobile.png",
    fullPage: true,
  });
});
