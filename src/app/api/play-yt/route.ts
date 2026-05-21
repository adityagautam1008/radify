import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Cache resolved stream URLs — yt-dlp URLs typically expire in ~6 hours
const streamCache = new Map<string, { url: string; ts: number }>();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

async function resolveStreamUrl(videoId: string): Promise<string | null> {
  // Check cache
  const cached = streamCache.get(videoId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.url;
  }

  try {
    // Use yt-dlp to extract the direct audio stream URL (m4a AAC, best quality)
    // The android player client is faster and avoids some anti-bot challenges
    const { stdout, stderr } = await execAsync(
      `yt-dlp -f 140/bestaudio --get-url --no-warnings --no-check-certificates --extractor-args "youtube:player_client=android_vr" "https://www.youtube.com/watch?v=${videoId}"`,
      { timeout: 50000 }
    );

    const url = stdout.trim();
    if (url && url.startsWith('http')) {
      streamCache.set(videoId, { url, ts: Date.now() });
      return url;
    }

    console.error('yt-dlp returned unexpected output:', stderr || url);
    return null;
  } catch (error: any) {
    console.error('yt-dlp extraction failed:', error.message);
    return null;
  }
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
