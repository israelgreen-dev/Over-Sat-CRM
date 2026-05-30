// crm-flow.spec.ts — End-to-end tests for the three main CRM user flows.
//
// Auth strategy
// The app guards every view behind Supabase auth. Rather than real credentials:
//   1. Override localStorage.getItem via page.addInitScript so the Supabase JS
//      client finds a fake-but-structurally-valid session on boot.
//   2. Intercept all Supabase /auth/v1/ network requests so the client never
//      discovers the token is fake when it validates or refreshes it.
//
// Data strategy
// The Next.js server component (app/page.tsx) fetches opportunities server-side
// using real credentials from .env.local — page.route() cannot intercept those
// Node.js-side fetches. Tests therefore work with whatever the real DB returns
// (zero or more rows). For Test 3, which requires a controllable row to edit,
// we drive the "+ New Opportunity" UI flow and intercept the browser-side
// Supabase INSERT with a deterministic stub response.

import { test, expect, type Page } from '@playwright/test'

// ── Fake auth fixtures ────────────────────────────────────────────────────────
// Computed once at module load; expires_at is 2 h in the future so the client
// never attempts a token refresh during the test run.
const FAKE_USER = {
  id: 'e2e-user-id',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'e2e@oversat.test',
  email_confirmed_at: '2024-01-01T00:00:00.000Z',
  user_metadata: { name: 'Head Of Sales', role: 'head_of_sales' },
  app_metadata: { provider: 'email', providers: ['email'] },
  created_at: '2024-01-01T00:00:00.000Z',
}

const FAKE_SESSION = JSON.stringify({
  access_token: 'e2e-access-token',
  token_type: 'bearer',
  expires_in: 7200,
  expires_at: Math.floor(Date.now() / 1000) + 7200,
  refresh_token: 'e2e-refresh-token',
  user: FAKE_USER,
})

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Inject a fake Supabase session and intercept auth API calls.
 * Must be called before page.goto() so the initScript fires first.
 */
async function setupAuthMocks(page: Page): Promise<void> {
  // The Supabase JS client stores the session under a key that includes the
  // project ref (e.g. "sb-abcxyz-auth-token"). We don't know the ref at test
  // time, so we override getItem to return our session for ANY key that matches
  // the sb-*-auth-token pattern.
  await page.addInitScript((session: string) => {
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = function (key: string) {
      if (/^sb-.+-auth-token$/.test(key)) return session
      return orig.call(this, key)
    }
  }, FAKE_SESSION)

  // Intercept Supabase auth API calls so the client never rejects our token.
  await page.route('**/auth/v1/**', async (route, request) => {
    const url = request.url()
    if (url.includes('/token')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: FAKE_SESSION,
      })
    } else if (url.includes('/user')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_USER),
      })
    } else {
      await route.continue()
    }
  })
}

/**
 * Wait until the CRM shell (sticky header) is rendered.
 * This is a reliable signal that auth passed and the Dashboard component mounted.
 */
async function waitForDashboard(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { name: 'Over-Sat CRM' }),
  ).toBeVisible({ timeout: 20_000 })
}

/**
 * Navigate to the Pipeline tab and wait for the search bar to confirm render.
 */
async function goToPipeline(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Pipeline' }).first().click()
  await expect(
    page.getByPlaceholder(/search by opportunity, account/i),
  ).toBeVisible()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('CRM main flows', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page)
  })

  // ─── 1. Dashboard loads without hydration errors ───────────────────────────
  test('dashboard page loads without React hydration errors', async ({ page }) => {
    const hydrationErrors: string[] = []

    // Collect any hydration-related console errors before navigation.
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (
        text.includes('Hydration') ||
        text.includes('hydration') ||
        text.includes('did not match')
      ) {
        hydrationErrors.push(text)
      }
    })

    // Also catch uncaught page errors that mention hydration.
    page.on('pageerror', (err) => {
      if (
        err.message.includes('Hydration') ||
        err.message.includes('hydration')
      ) {
        hydrationErrors.push(err.message)
      }
    })

    await page.goto('/')
    await waitForDashboard(page)

    // Wait for all deferred network activity to settle; this gives React time
    // to finish its client-side hydration pass before we read the error list.
    await page.waitForLoadState('networkidle')

    expect(
      hydrationErrors,
      `Unexpected hydration errors found:\n${hydrationErrors.join('\n')}`,
    ).toHaveLength(0)
  })

  // ─── 2. Tab navigation works ──────────────────────────────────────────────
  test('switching between Dashboard and Pipeline tabs works', async ({ page }) => {
    await page.goto('/')
    await waitForDashboard(page)

    // ── Dashboard → Pipeline ──────────────────────────────────────────────
    await goToPipeline(page)

    // The search bar is exclusive to the Pipeline view — its visibility
    // confirms the correct tab rendered.
    await expect(
      page.getByPlaceholder(/search by opportunity, account/i),
    ).toBeVisible()

    // ── Pipeline → Dashboard ──────────────────────────────────────────────
    await page.getByRole('button', { name: 'Dashboard' }).first().click()

    // The KPI summary cards are exclusive to the Dashboard analytics view.
    // "Overall Target" or "My Target" appears as a card label.
    await expect(
      page.getByText(/Overall Target|My Target/i).first(),
    ).toBeVisible()
  })

  // ─── 3. Loss stage reveals required validation fields ──────────────────────
  test('editing an opportunity and selecting Loss stage reveals Loss Reason and Loss Description inputs', async ({ page }) => {
    // The stub opportunity that our mock Supabase INSERT will return.
    // Using a distinctive name so the assertion never matches an unrelated row.
    const STUB_OPP_NAME = 'E2E Loss-Stage Test Deal'
    const stubbedOpp = {
      id: 'e2e-stub-opp-1',
      name: STUB_OPP_NAME,
      customer_name: 'E2E Corp',
      stage: 'Discovery',
      product: null,
      owner: 'Head Of Sales',
      value: 25_000,
      status: null,
      country: null,
      close_date: null,
      loss_reason: null,
      loss_description: null,
      final_win_value: null,
      created_at: new Date().toISOString(),
    }

    // Intercept browser-side Supabase REST calls for opportunities.
    // POST  → INSERT (adding the new opp)
    // PATCH → UPDATE (save inside the edit modal — must not 500 or the UI breaks)
    await page.route('**/rest/v1/opportunities**', async (route, request) => {
      const method = request.method()
      if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([stubbedOpp]),
        })
      } else if (method === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([stubbedOpp]),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/')
    await waitForDashboard(page)

    // ── Step 1: Navigate to Pipeline and open the Add Opportunity modal ────
    await goToPipeline(page)
    await page.getByRole('button', { name: /new opportunity/i }).click()

    // ── Step 2: Fill in the two required fields (Name + Account) and save ──
    await page.locator('input[placeholder="Opportunity name…"]').fill(STUB_OPP_NAME)
    await page.locator('input[placeholder="Company or account"]').fill('E2E Corp')

    // The Save button is enabled once both required fields are non-empty.
    await page.getByRole('button', { name: /^save$/i }).click()

    // Wait for the success state: "Saved" badge appears and the tabs unlock.
    // This confirms the mocked INSERT responded and the component handled it.
    await expect(
      page.locator('text=Saved'),
    ).toBeVisible({ timeout: 8_000 })

    // ── Step 3: Close the Add Opportunity modal ────────────────────────────
    // Clicking the backdrop (at the viewport corner, well outside the centred
    // modal card) triggers the backdrop's onClick={onClose} handler.
    await page.mouse.click(10, 10)

    // ── Step 4: Click on the newly added row to open the view / edit modal ─
    // PipelineTab prepends new rows so our stub is always first; filtering by
    // text ensures we never accidentally click a pre-existing row.
    const newRow = page
      .getByRole('row')
      .filter({ hasText: STUB_OPP_NAME })
      .first()
    await expect(newRow).toBeVisible({ timeout: 5_000 })
    await newRow.click()

    // ── Step 5: Enter edit mode ───────────────────────────────────────────
    await page.getByRole('button', { name: 'Edit' }).click()

    // Confirm edit mode: Save & Close button is now visible.
    const saveAndClose = page.getByRole('button', { name: /save & close/i })
    await expect(saveAndClose).toBeVisible()

    // ── Step 6: Select the Loss stage pill ───────────────────────────────
    // In edit mode the Details tab body renders five stage pill buttons
    // (Discovery, Proposal, Negotiation, Win, Loss).  There are no other
    // buttons labelled "Loss" on the page at this point.
    await page.getByRole('button', { name: 'Loss' }).click()

    // ── Step 7: Assert the Loss validation section appeared ───────────────
    // Both field labels must be visible — they are rendered only when
    // isEditing && draft.stage === 'Loss'.
    await expect(page.getByText('Loss Reason')).toBeVisible()
    await expect(page.getByText('Loss Description')).toBeVisible()

    // The Loss Reason select must have its placeholder option visible,
    // confirming the <select> rendered (not just the label).
    await expect(
      page.locator('select').filter({ hasText: /Select a reason/i }),
    ).toBeVisible()

    // The Loss Description textarea must be rendered and accept input.
    const lossDescTextarea = page.locator('textarea[placeholder="Required"]')
    await expect(lossDescTextarea).toBeVisible()
    await expect(lossDescTextarea).toBeEditable()

    // ── Step 8: Validate the save-guard ──────────────────────────────────
    // canSave is false when isLost && (loss_reason | loss_description) is empty.
    // The button must be disabled until both fields are filled in.
    await expect(saveAndClose).toBeDisabled()
  })
})
