import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get('url');

  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing audio URL' }, { status: 400 });
  }

  try {
    const targetUrl = rawUrl.startsWith('/api/')
      ? new URL(rawUrl, request.url)
      : new URL(rawUrl);

    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      return NextResponse.json({ error: 'Invalid audio URL' }, { status: 400 });
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 ADIFY',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Unable to download audio' }, { status: response.status });
    }

    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('content-type') || 'audio/mpeg');
    headers.set('Cache-Control', 'no-store');

    return new NextResponse(response.body, { headers });
  } catch (error) {
    console.warn('[download] failed', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 502 });
  }
}
