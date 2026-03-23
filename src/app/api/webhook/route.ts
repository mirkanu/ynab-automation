import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

export async function POST(req: NextRequest) {
  // TODO Phase 2: validate Postmark webhook payload
  // TODO Phase 2: check for duplicate messageId in DB
  // TODO Phase 2: extract original sender from forwarded headers
  // TODO Phase 2: ignore non-Amazon emails
  return NextResponse.json({ received: true }, { status: 200 });
}
