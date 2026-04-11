import { getSetting } from '@/lib/settings'

interface WizardStep {
  step: number
  key: string | string[]
  label: string
}

/**
 * Describes each step of the first-install wizard and which Setting key(s)
 * must be non-empty for that step to be considered complete.
 */
export const WIZARD_STEPS: WizardStep[] = [
  { step: 1, key: 'ADMIN_PASSWORD',                         label: 'Admin Password' },
  { step: 2, key: 'YNAB_ACCESS_TOKEN',                      label: 'YNAB Personal Access Token' },
  { step: 3, key: ['YNAB_BUDGET_ID', 'YNAB_ACCOUNT_ID'],   label: 'YNAB Budget & Account' },
  { step: 4, key: 'ANTHROPIC_API_KEY',                      label: 'Anthropic Claude API Key' },
  { step: 5, key: 'RESEND_API_KEY',                         label: 'Resend API Key' },
  { step: 6, key: 'PIPEDREAM_WEBHOOK_URL',                  label: 'Pipedream Webhook URL' },
]

/**
 * Derive which wizard step the user should resume at by reading the Setting table.
 *
 * - Returns 1–6 for the first step whose key(s) are not yet set.
 * - Returns 7 if all 6 steps are complete (wizard is done).
 *
 * This function is read-only — it never writes WIZARD_COMPLETE.
 */
export async function deriveWizardStep(): Promise<number> {
  for (const stepDef of WIZARD_STEPS) {
    if (Array.isArray(stepDef.key)) {
      // All keys in the array must be non-empty for this step to be done
      const values = await Promise.all(stepDef.key.map((k) => getSetting(k)))
      const allSet = values.every((v) => v && v.trim() !== '')
      if (!allSet) return stepDef.step
    } else {
      const value = await getSetting(stepDef.key)
      if (!value || value.trim() === '') return stepDef.step
    }
  }

  // All 6 steps have their keys populated
  return 7
}
