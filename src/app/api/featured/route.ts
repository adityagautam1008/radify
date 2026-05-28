import { NextResponse } from 'next/server';
import { getFeaturedSongs } from '@/lib/musicProviders';

export const dynamic = 'force-dynamic';

export async function GET() {
  const songs = await getFeaturedSongs();
  return NextResponse.json({
    songs,
    providers: ['YouTube recommendations', 'Saavn audio'],
  });
}
