import { NextResponse } from 'next/server'

// Phase 22 will implement the PAT-based YNAB integration.
// This stub prevents build errors from the removed YNAB OAuth code.
export async function POST() {
  return NextResponse.json({ error: 'Not implemented — Phase 22 pending' }, { status: 501 })
}
