import { NextResponse } from 'next/server';
import { searchAllProviders } from '@/lib/musicProviders';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query')?.trim();

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  const result = await searchAllProviders(query);
  return NextResponse.json(result);
}
