import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  try {
    const clientId = 'LBCcHmGLoGQPrGcgIoH0X7TGE8G0yA9T';
    const finalUrl = url + (url.includes('?') ? '&' : '?') + 'client_id=' + clientId;
    
    const res = await fetch(finalUrl);
    const data = await res.json();
    
    if (data.url) {
      return NextResponse.redirect(data.url, 302);
    }
    return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
