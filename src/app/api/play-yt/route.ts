import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Cache resolved stream URLs — yt-dlp URLs typically expire in ~6 hours
const streamCache = new Map<string, { url: string; ts: number }>();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

let cachedInstances: string[] = [];
let lastFetchTime = 0;

async function getInvidiousInstances(): Promise<string[]> {
  const now = Date.now();
  if (cachedInstances.length > 0 && now - lastFetchTime < 3600 * 1000) {
    return cachedInstances;
  }

  try {
    const res = await fetch('https://api.invidious.io/instances.json?sort_by=api,type');
    if (res.ok) {
      const data = await res.json();
      const active: string[] = [];
      for (const item of data) {
        const hostname = item[0];
        const info = item[1];
        if (
          info.api === true &&
          info.type === 'https' &&
          info.uri &&
          !info.uri.includes('.onion') &&
          !info.uri.includes('.i2p')
        ) {
          active.push(info.uri);
        }
      }
      if (active.length > 0) {
        cachedInstances = active;
        lastFetchTime = now;
        return active;
      }
    }
  } catch (err) {
    console.error('Error fetching invidious instances:', err);
  }

  return [
    'https://inv.thepixora.com',
    'https://yewtu.be',
    'https://vid.puffyan.us',
  ];
}

async function resolveStreamUrlInvidious(videoId: string): Promise<string | null> {
  const instances = await getInvidiousInstances();
  const maxAttempts = Math.min(instances.length, 4);

  for (let i = 0; i < maxAttempts; i++) {
    const instance = instances[i];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.adaptiveFormats)) {
          const formats = data.adaptiveFormats;
          const bestAudio = 
            formats.find((f: any) => String(f.itag) === '140') ||
            formats.find((f: any) => String(f.itag) === '251') ||
            formats.find((f: any) => f.container === 'm4a') ||
            formats.find((f: any) => f.type && f.type.startsWith('audio/'));

          if (bestAudio && bestAudio.url) {
            return bestAudio.url;
          }
        }
      }
    } catch (err) {
      console.warn(`Invidious audio resolution failed on instance ${instance}:`, err);
    }
  }

  // Fallback to latest_version redirect endpoint
  if (instances.length > 0) {
    return `${instances[0]}/latest_version?id=${videoId}&itag=140`;
  }

  return null;
}

async function resolveStreamUrl(videoId: string): Promise<string | null> {
  // Check cache
  const cached = streamCache.get(videoId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.url;
  }

  // 1. Try yt-dlp first (ideal for local development)
  try {
    const { stdout, stderr } = await execAsync(
      `yt-dlp -f 140/bestaudio --get-url --no-warnings --no-check-certificates --extractor-args "youtube:player_client=android_vr" "https://www.youtube.com/watch?v=${videoId}"`,
      { timeout: 15000 }
    );

    const url = stdout.trim();
    if (url && url.startsWith('http')) {
      streamCache.set(videoId, { url, ts: Date.now() });
      return url;
    }

    console.error('yt-dlp returned unexpected output:', stderr || url);
  } catch (error: any) {
    console.warn('yt-dlp extraction failed, falling back to Invidious:', error.message);
  }

  // 2. Fallback to Invidious
  const invidiousUrl = await resolveStreamUrlInvidious(videoId);
  if (invidiousUrl) {
    streamCache.set(videoId, { url: invidiousUrl, ts: Date.now() });
    return invidiousUrl;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }

  try {
    const streamUrl = await resolveStreamUrl(id);
    if (!streamUrl) {
      return NextResponse.json(
        { error: 'Could not extract audio stream. The video may be unavailable.' },
        { status: 502 }
      );
    }

    // Proxy the audio stream through our server (the direct URL is IP-locked)
    const proxyHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.0.0 Mobile Safari/537.36',
    };

    // Forward range header for seeking support
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      proxyHeaders['Range'] = rangeHeader;
    }

    const audioRes = await fetch(streamUrl, {
      headers: proxyHeaders,
      redirect: 'follow',
    });

    if (!audioRes.ok && audioRes.status !== 206) {
      // URL might have expired — clear cache and retry once
      streamCache.delete(id);
      const freshUrl = await resolveStreamUrl(id);
      if (!freshUrl) {
        return NextResponse.json({ error: 'Stream expired and could not be renewed' }, { status: 502 });
      }
      
      const retryRes = await fetch(freshUrl, {
        headers: proxyHeaders,
        redirect: 'follow',
      });

      if (!retryRes.ok && retryRes.status !== 206) {
        return NextResponse.json({ error: 'Stream failed' }, { status: 502 });
      }

      return buildStreamResponse(retryRes);
    }

    return buildStreamResponse(audioRes);
  } catch (error: any) {
    console.error('Failed to stream YouTube video:', error);
    return NextResponse.json({ error: 'Failed to stream audio' }, { status: 500 });
  }
}

function buildStreamResponse(audioRes: Response): NextResponse {
  const responseHeaders = new Headers();
  responseHeaders.set('Content-Type', audioRes.headers.get('content-type') || 'audio/mp4');
  responseHeaders.set('Accept-Ranges', 'bytes');
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Cache-Control', 'public, max-age=3600');

  // Forward range-related headers for seeking
  const contentRange = audioRes.headers.get('content-range');
  if (contentRange) responseHeaders.set('Content-Range', contentRange);

  const contentLength = audioRes.headers.get('content-length');
  if (contentLength) responseHeaders.set('Content-Length', contentLength);

  return new NextResponse(audioRes.body as any, {
    status: audioRes.status, // 200 or 206
    headers: responseHeaders,
  });
}
