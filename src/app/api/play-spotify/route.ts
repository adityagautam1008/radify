import { NextResponse } from 'next/server';
import { fetchSaavnSongsWithFallback } from '@/lib/saavn';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  
  if (!q) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  try {
    const songs = await fetchSaavnSongsWithFallback(q, 1);
    if (songs.length > 0 && songs[0].streamUrl) {
      return NextResponse.redirect(songs[0].streamUrl, 302);
    }
    return NextResponse.json({ error: 'Stream not found on Saavn engine' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
