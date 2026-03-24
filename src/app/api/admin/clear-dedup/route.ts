import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST() {
  const result = await prisma.processedEmail.deleteMany({});
  return NextResponse.json({ deleted: result.count });
}
