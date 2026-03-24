import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  console.log('PIPEDREAM_PAYLOAD:', JSON.stringify(body, null, 2));
  return NextResponse.json({ received: true }, { status: 200 });
}
