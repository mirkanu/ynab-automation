import { NextRequest, NextResponse } from 'next/server'
import { saveSettings } from '@/lib/settings'
import { deriveWizardStep } from '@/lib/wizard'

/**
 * POST /api/setup/step
 *
 * Public endpoint (no auth guard) — the wizard runs before any admin password
 * exists, so this must be reachable unauthenticated.
 *
 * Request body: { step: number, settings: Record<string, string> }
 * Response:     { success: true, nextStep: number }
 *            or { error: string } with status 400 or 500
 */
export async function POST(req: NextRequest) {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).step !== 'number' ||
    typeof (body as Record<string, unknown>).settings !== 'object' ||
    (body as Record<string, unknown>).settings === null
  ) {
    return NextResponse.json(
      { error: 'Request body must include `step` (1–6) and `settings` (non-empty object).' },
      { status: 400 }
    )
  }

  const { step, settings } = body as { step: number; settings: Record<string, string> }

  if (step < 1 || step > 6 || !Number.isInteger(step)) {
    return NextResponse.json({ error: '`step` must be an integer between 1 and 6.' }, { status: 400 })
  }

  if (Object.keys(settings).length === 0) {
    return NextResponse.json({ error: '`settings` must be a non-empty object.' }, { status: 400 })
  }

  try {
    // Persist the step's values to the Setting table
    await saveSettings(settings)

    // Final step — mark the wizard as complete
    if (step === 6) {
      await saveSettings({ WIZARD_COMPLETE: 'true' })
    }

    // Derive the next resume point
    const nextStep = await deriveWizardStep()

    return NextResponse.json({ success: true, nextStep })
  } catch (e) {
    console.error('[/api/setup/step] DB error:', e)
    return NextResponse.json(
      { error: 'Failed to save settings. Please try again.' },
      { status: 500 }
    )
  }
}
