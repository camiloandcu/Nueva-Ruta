import { expect, test } from "@playwright/test";

test("partner import exposes the original to normalized comparison and real CRM choices", async ({
  page,
}) => {
  const email = process.env.DEMO_ANALYST_EMAIL;
  const password = process.env.DEMO_ANALYST_PASSWORD;
  if (!email || !password)
    throw new Error("Local analyst credentials are required");

  await page.goto("/login");
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(
    page.getByRole("button", { name: "Cerrar sesión" }),
  ).toBeVisible();
  await page.goto("/operations/partners");

  await expect(
    page.getByText("La importación corresponde al operador o supervisor.", {
      exact: false,
    }),
  ).toBeVisible();
  const compare = page
    .getByRole("button", { name: "Comparar filas originales y normalizadas" })
    .first();
  await expect(compare).toBeVisible();
  await compare.click();
  await expect(
    page.getByRole("heading", { name: "Qué cambió al limpiar el archivo" }),
  ).toBeVisible();
  await expect(page.locator("#import-quality tbody tr").first()).toContainText(
    "→",
  );
  await expect(page.locator("#import-quality tbody tr").first()).toContainText(
    "+1",
  );

  const review = page.locator(".reconciliation-card").first();
  await expect(
    review.getByRole("heading", { name: "Valores conservados del archivo" }),
  ).toBeVisible();
  await expect(
    review.getByLabel("Vincular con otro caso CRM").locator("option"),
  ).not.toHaveCount(1);
  await expect(
    review.getByLabel("Vincular con otro caso CRM").locator("option").nth(1),
  ).toContainText("LEAD-");
  const manualLeadId = await review
    .getByLabel("Vincular con otro caso CRM")
    .locator("option")
    .nth(1)
    .getAttribute("value");
  let submitted: { action?: string; lead_id?: string } = {};
  await page.route(
    "**/api/operations/partner-imports/reconciliation/*/review",
    async (route) => {
      submitted = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "matched" }),
      });
    },
  );
  await review
    .getByLabel("Vincular con otro caso CRM")
    .selectOption(manualLeadId ?? "");
  await review
    .getByLabel("Motivo de decisión")
    .fill("Coincidencia comprobada con el caso CRM");
  await review.getByRole("button", { name: "Vincular otro caso" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Revisión registrada" }),
  ).toBeVisible();
  expect(submitted.action).toBe("link");
  expect(submitted.lead_id).toBe(manualLeadId);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page
      .locator(
        "#import-quality td[data-label='Teléfono recibido → normalizado']",
      )
      .first(),
  ).toBeVisible();
  const phoneCell = await page
    .locator("#import-quality td[data-label='Teléfono recibido → normalizado']")
    .first()
    .boundingBox();
  expect(phoneCell && phoneCell.x + phoneCell.width <= 390).toBeTruthy();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "/tmp/influgain-partner-reconciliation-mobile.png",
    fullPage: true,
  });
});
