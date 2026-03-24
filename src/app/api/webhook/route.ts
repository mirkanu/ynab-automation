import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

export async function POST(_req: NextRequest) {
  // TODO Phase 2: implement email ingestion
  return NextResponse.json({ received: true }, { status: 200 });
}
