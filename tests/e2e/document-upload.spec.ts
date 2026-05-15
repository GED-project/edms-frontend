import { expect, test, type Page } from '@playwright/test';

const tenantUser = {
  id: 'user-1',
  email: 'admin@acme.localhost',
  fullName: 'Admin Acme',
  role: 'admin',
  permissions: [],
  tenantId: 'tenant-1',
  tenantCode: 'acme',
  isHost: false,
};

const metadataDefinitions = {
  items: [
    {
      id: 'meta-department',
      name: 'department',
      displayName: 'Department',
      fieldType: 0,
      isRequired: true,
      creationTime: new Date().toISOString(),
    },
  ],
  totalCount: 1,
};

const shareableUsers = [
  {
    id: 'validator-1',
    userName: 'approver.one',
    name: 'Approver',
    surname: 'One',
    email: 'approver.one@example.com',
  },
];

async function mockUploadBootstrap(page: Page) {
  await page.addInitScript(({ user }) => {
    localStorage.setItem('edms_user', JSON.stringify(user));
    sessionStorage.setItem('edms_refresh_token', 'refresh-token');
  }, { user: tenantUser });

  await page.route('**/connect/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'access-token',
        refresh_token: 'refresh-token-2',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });
  });

  await page.route('**/api/app/metadata-definition**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(metadataDefinitions),
    });
  });

  await page.route('**/api/app/user-custom/shareable-users', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(shareableUsers),
    });
  });
}

async function gotoUpload(page: Page, query = '?lib=lib-1') {
  await mockUploadBootstrap(page);
  await page.goto(`/documents/upload${query}`);
  await expect(page.getByRole('heading', { name: /Nouvel import de document/i })).toBeVisible();
}

function createPdfBuffer(label: string) {
  return Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n% ${label}`);
}

test('rejects an oversized file before upload', async ({ page }) => {
  await gotoUpload(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: 'oversized.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(11 * 1024 * 1024, 1),
  });

  await page.getByRole('button', { name: /^Suivant$/ }).click();
  await page.getByRole('button', { name: /^Suivant$/ }).click();
  await page.getByRole('button', { name: /Terminer/i }).click();

  await expect(page.getByText(/Veuillez sélectionner au moins un fichier/i)).toBeVisible();
});

test('requires metadata before final submission', async ({ page }) => {
  let createCalls = 0;
  await mockUploadBootstrap(page);
  await page.route('**/api/app/document/create', async (route) => {
    createCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'doc-1', title: 'doc' }),
    });
  });

  await page.goto('/documents/upload?lib=lib-1');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'contract.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfBuffer('contract'),
  });

  await page.getByRole('button', { name: /^Suivant$/ }).click();
  await page.getByRole('button', { name: /^Suivant$/ }).click();

  await page.getByRole('button', { name: /Terminer/i }).click();

  await expect(page.getByText(/Champs obligatoires manquants/i)).toBeVisible();
  expect(createCalls).toBe(0);
});

test('enables validator selection when approval is requested', async ({ page }) => {
  await mockUploadBootstrap(page);

  await page.goto('/documents/upload?lib=lib-1');

  await page.locator('input[type="file"]').setInputFiles({
    name: 'approval.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfBuffer('approval'),
  });

  await expect(page.getByText(/Fichiers prêts/i)).toBeVisible();

  await page.getByRole('button', { name: /^Suivant$/ }).click();
  await expect(page.locator('input[aria-label="Nom du document"]')).toBeVisible();

  await page.getByRole('button', { name: /^Suivant$/ }).click();
  const validatorSelect = page.locator('select[aria-label="Valideur"]');

  await expect(validatorSelect).toBeDisabled();
  await page.getByLabel('Demander approbation').check();
  await expect(validatorSelect).toBeEnabled();

  await validatorSelect.selectOption('validator-1');
  await expect(validatorSelect).toHaveValue('validator-1');
});