import { NextResponse } from 'next/server'

// This Phase 18 route is dead code — the active email ingestion path
// is /api/webhook (Pipedream). Phase 22 will delete this file.
// Stubbed here to prevent build errors from the removed Auth.js/User model code.
export async function POST() {
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
}
