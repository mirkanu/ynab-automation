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
  // Step 4 captures the LLM provider choice plus both API keys. The user picks
  // one provider in the wizard UI and fills in the matching key; the unused
  // provider's key is still saved (as empty) so the Settings API keeps the row
  // shape consistent. deriveWizardStep requires all three to be non-empty for
  // step 4 to count as done — the user must fill the matching key to advance.
  { step: 4, key: ['LLM_PROVIDER', 'ANTHROPIC_API_KEY', 'MINIMAX_API_KEY'], label: 'LLM Provider' },
  { step: 5, key: 'RESEND_API_KEY',                         label: 'Resend API Key' },
  { step: 6, key: 'INBOUND_EMAIL',                          label: 'Inbound Email Address' },
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
