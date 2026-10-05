import { expect, test } from "@playwright/test";

const email = process.env.DEMO_OPERATOR_EMAIL;
const password = process.env.DEMO_OPERATOR_PASSWORD;

test.beforeEach(async ({ page }) => {
  if (!email || !password)
    throw new Error("Local demo operator credentials are required");
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(
    page.getByRole("button", { name: "Cerrar sesión" }),
  ).toBeVisible();
});

test("task navigation opens a case and global queues show their own case context", async ({
  page,
}) => {
  await page.goto("/");
  const areas = page.getByRole("navigation", { name: "Áreas de trabajo" });
  await expect(
    page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Operación" }),
  ).toBeVisible();
  for (const name of [
    "Bandeja",
    "Casos",
    "Operación",
    "Resultados",
    "Administración",
  ]) {
    await expect(areas.getByRole("heading", { name })).toBeVisible();
  }
  await areas.getByRole("link", { name: "Abrir casos CRM" }).click();
  await expect(page.getByText("Siguiente paso:")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Escalaciones de toda la operación" }),
  ).toBeVisible();
  const queueLinks = page.locator(
    ".crm-operations-panel a[href^='/operations/crm?lead=']",
  );
  if (await queueLinks.count()) {
    const startingCase = await page
      .getByRole("combobox", { name: "Caso" })
      .inputValue();
    const href = await queueLinks.first().getAttribute("href");
    await queueLinks.first().click();
    await expect(page).toHaveURL(new RegExp(`${href?.replace("?", "\\?")}$`));
    const caseId = new URL(page.url()).searchParams.get("lead");
    await expect(page.getByRole("combobox", { name: "Caso" })).toHaveValue(
      caseId ?? "",
    );
    await page.goBack();
    await expect(page).toHaveURL(/\/operations\/crm$/);
    await expect(page.getByRole("combobox", { name: "Caso" })).toHaveValue(
      startingCase,
    );
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "/tmp/influgain-workspace-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("Siguiente paso:")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "/tmp/influgain-workspace-mobile.png",
    fullPage: true,
  });
});

test("one failed queue retries without hiding the selected case", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/operations/crm/recovery", async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({ status: 503, body: "unavailable" });
      return;
    }
    await route.continue();
  });
  await page.goto("/operations/crm");
  await expect(page.getByText("Siguiente paso:")).toBeVisible();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "No se pudo cargar esta sección" }),
  ).toBeVisible();
  await page
    .getByRole("alert")
    .filter({ hasText: "No se pudo cargar esta sección" })
    .getByRole("button", { name: "Reintentar" })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "No se pudo cargar esta sección" }),
  ).toHaveCount(0);
});

test("report filter choices come from the authenticated API", async ({
  page,
}) => {
  await page.goto("/operations/reports");
  const response = await page.request.get(
    "/api/operations/reports/filter-options",
  );
  expect(response.ok()).toBeTruthy();
  const options = (await response.json()) as {
    creators: string[];
    channels: string[];
    states: string[];
    can_open_crm: boolean;
  };
  expect(options.can_open_crm).toBeTruthy();
  await expect(page.getByLabel("Creador").locator("option")).toHaveCount(
    options.creators.length + 1,
  );
  await expect(page.getByLabel("Canal").locator("option")).toHaveCount(
    options.channels.length + 1,
  );
  await expect(page.getByLabel("Estado").locator("option")).toHaveCount(
    options.states.length + 1,
  );
  if (options.creators.length) {
    await page.getByLabel("Creador").selectOption(options.creators[0]);
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page.getByLabel("Creador")).toHaveValue(options.creators[0]);
  }
  const firstEnrollment = page.locator(".enrollment-trace-item").first();
  await expect(firstEnrollment.getByText("Origen importado")).toBeVisible();
  await expect(firstEnrollment.getByText("Calidad de origen")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver origen" })).toHaveCount(0);
  if (
    await page
      .getByRole("button", { name: /Mostrar 8 inscripciones más/ })
      .isVisible()
  ) {
    await expect(page.locator(".enrollment-trace-item")).toHaveCount(8);
    await page
      .getByRole("button", { name: /Mostrar 8 inscripciones más/ })
      .click();
    expect(
      await page.locator(".enrollment-trace-item").count(),
    ).toBeGreaterThan(8);
  }
  await firstEnrollment.getByText("Checksums de las filas de origen").click();
  await expect(firstEnrollment.locator("details")).toContainText(
    /Fila|Sin checksums disponibles/,
  );
  await page.screenshot({
    path: "/tmp/influgain-reports-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "/tmp/influgain-reports-mobile.png",
    fullPage: true,
  });
});

test("analyst sees reporting destinations without CRM commands", async ({
  browser,
}) => {
  const analystEmail = process.env.DEMO_ANALYST_EMAIL;
  const analystPassword = process.env.DEMO_ANALYST_PASSWORD;
  if (!analystEmail || !analystPassword)
    throw new Error("Local analyst credentials are required");
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "Correo electrónico" })
    .fill(analystEmail);
  await page.getByLabel("Contraseña").fill(analystPassword);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(
    page.getByRole("button", { name: "Cerrar sesión" }),
  ).toBeVisible();
  await page.goto("/");
  const areas = page.getByRole("navigation", { name: "Áreas de trabajo" });
  await expect(areas.getByRole("link", { name: "Ver informes" })).toBeVisible();
  await expect(
    areas.getByRole("link", { name: "Abrir casos CRM" }),
  ).toHaveCount(0);
  await expect(
    areas.getByRole("link", { name: "Abrir colas globales" }),
  ).toHaveCount(0);
  await page.goto("/operations/reports");
  await expect(
    page.locator(".stalled-table a[href^='/operations/crm?lead=']"),
  ).toHaveCount(0);
  await context.close();
});
