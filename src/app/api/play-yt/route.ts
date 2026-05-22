import { NextRequest, NextResponse } from 'next/server';
import { getAudioUrl } from '@/utils/ytDlp';
import { fetchSaavnSongsWithFallback } from '@/lib/saavn';

export const dynamic = 'force-dynamic';
// NOTE: This route proxies long-running audio streams.
// It requires a persistent server (Railway, Render, Fly.io) — NOT Vercel serverless.
// Vercel free tier 10s timeout and pro 60s timeout will both fail for full songs.
export const maxDuration = 300; // 5 minutes — respected by Vercel Pro & compatible hosts

let cachedInstances: string[] = [];
let lastFetchTime = 0;

// Simple in-memory cache for resolved stream URLs to ensure range/seeking requests reuse the same source
const resolvedCache = new Map<string, { url: string; timestamp: number }>();

// Cleanup cache periodically to avoid memory leak
if (typeof global !== 'undefined') {
  if (!(global as any).__resolvedCacheCleanupInterval) {
    (global as any).__resolvedCacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, val] of resolvedCache.entries()) {
        if (now - val.timestamp > 1800 * 1000) { // 30 minutes TTL
          resolvedCache.delete(key);
        }
      }
    }, 300 * 1000).unref?.();
  }
}

// Dynamic list of active public Invidious instances
async function getInvidiousInstances(): Promise<string[]> {
  const now = Date.now();
  // Cache the instance list for 1 hour to reduce API hits
  if (cachedInstances.length > 0 && now - lastFetchTime < 3600 * 1000) {
    return cachedInstances;
  }

  // Large pool of highly stable public Invidious instances
  const fallbacks = [
    'https://inv.thepixora.com',
    'https://inv.vern.cc',
    'https://invidious.no-logs.com',
    'https://yewtu.be',
    'https://iv.melmac.space',
    'https://inv.nadeko.net',
    'https://invidious.f5.si',
    'https://yt.chocolatemoo53.com',
    'https://invidious.asir.dev',
    'https://invidious.projectsegfaut.im'
  ];

  try {
    const res = await fetch('https://api.invidious.io/instances.json?sort_by=api,type');
    if (res.ok) {
      const data = await res.json();
      const active: string[] = [];
      for (const item of data) {
        const info = item[1];
        if (
          info.type === 'https' &&
          info.uri &&
          !info.uri.includes('.onion') &&
          !info.uri.includes('.i2p')
        ) {
          active.push(info.uri);
        }
      }
      if (active.length > 0) {
        const merged = Array.from(new Set([...active, ...fallbacks]));
        cachedInstances = merged;
        lastFetchTime = now;
        return merged;
      }
    }
  } catch (err) {
    console.error('Error fetching invidious instances:', err);
  }

  const shuffledFallbacks = [...fallbacks].sort(() => Math.random() - 0.5);
  cachedInstances = shuffledFallbacks;
  lastFetchTime = now;
  return shuffledFallbacks;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const title = searchParams.get('title');
  const artist = searchParams.get('artist');
  const nocache = searchParams.get('nocache') === 'true';
  const json = searchParams.get('json') === 'true';

  if (!id) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }

  const rangeHeader = request.headers.get('range');
  const headersToSend = new Headers();
  if (rangeHeader) {
    headersToSend.set('range', rangeHeader);
  }
  headersToSend.set(
    'User-Agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // Build the pool of target URLs to attempt proxying from
  const urlsToTry: string[] = [];

  // 1. Attempt direct YouTube audio URL via yt-dlp (fastest path, prepend to front)
  if (!nocache) {
    const ytdlpUrl = await getAudioUrl(id);
    if (ytdlpUrl) {
      urlsToTry.push(ytdlpUrl);
    }
  }

  // 2. If we have a cached stream URL, prioritize attempting to seek/load from it
  if (!nocache && resolvedCache.has(id)) {
    urlsToTry.push(resolvedCache.get(id)!.url);
  }

  // 3. Add candidates (/latest_version URLs) from active Invidious instances
  const instances = await getInvidiousInstances();
  const preferred = [
    'https://inv.thepixora.com',
    'https://inv.vern.cc',
    'https://invidious.no-logs.com',
    'https://invidious.f5.si'
  ];
  const remaining = instances.filter((inst) => !preferred.includes(inst));
  const shuffledRemaining = [...remaining].sort(() => Math.random() - 0.5);
  const candidates = Array.from(new Set([...preferred, ...shuffledRemaining])).slice(0, 8);

  for (const inst of candidates) {
    urlsToTry.push(`${inst}/latest_version?id=${id}&itag=140&local=true`);
  }

  let streamRes: Response | null = null;
  let finalStreamUrl = '';

  // Self-healing proxy loop
  for (const targetUrl of urlsToTry) {
    try {
      console.log(`[play-yt] Attempting proxy stream from: ${targetUrl}`);
      let currentUrl = targetUrl;
      let res: Response | null = null;
      let redirectedToGooglevideo = false;

      // Follow redirects manually up to 5 levels to prevent browser cross-origin Range stripping
      for (let redirectCount = 0; redirectCount < 5; redirectCount++) {
        if (currentUrl.includes('googlevideo.com')) {
          console.warn(`[play-yt] Redirect led directly to googlevideo.com. Rejecting this stream instance.`);
          redirectedToGooglevideo = true;
          break;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout per redirect hop

        res = await fetch(currentUrl, {
          headers: headersToSend,
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
          const location = res.headers.get('location');
          if (location) {
            currentUrl = new URL(location, currentUrl).toString();
            console.log(`[play-yt] Proxy followed redirect to: ${currentUrl}`);
            continue;
          }
        }
        break;
      }

      if (redirectedToGooglevideo || !res) {
        continue;
      }

      const contentType = res.headers.get('content-type') || '';
      const status = res.status;

      // We only accept valid 200/206 audio stream payloads. HTML/JSON implies a block or landing page.
      if (status === 200 || status === 206) {
        if (contentType.includes('text/html') || contentType.includes('application/json')) {
          console.warn(`[play-yt] Instance returned HTML/JSON instead of audio: ${contentType}`);
          continue;
        }

        streamRes = res;
        finalStreamUrl = currentUrl;
        console.log(`[play-yt] SUCCESS! Proxy stream established from ${currentUrl} (Status: ${status})`);
        break;
      } else {
        console.warn(`[play-yt] Instance returned invalid status code: ${status}`);
      }
    } catch (err: any) {
      console.warn(`[play-yt] Failed fetching stream from ${targetUrl}:`, err.message || err);
    }
  }

  // If a working Invidious stream was established, pipe it back to the client
  if (streamRes && finalStreamUrl) {
    resolvedCache.set(id, { url: finalStreamUrl, timestamp: Date.now() });

    if (json) {
      return NextResponse.json({ streamUrl: finalStreamUrl }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
        }
      });
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', streamRes.headers.get('content-type') || 'audio/mpeg');

    if (streamRes.headers.has('content-range')) {
      responseHeaders.set('Content-Range', streamRes.headers.get('content-range')!);
    }
    if (streamRes.headers.has('accept-ranges')) {
      responseHeaders.set('Accept-Ranges', streamRes.headers.get('accept-ranges')!);
    }
    if (streamRes.headers.has('content-length')) {
      responseHeaders.set('Content-Length', streamRes.headers.get('content-length')!);
    }

    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');

    const status = streamRes.status === 206 ? 206 : 200;

    return new NextResponse(streamRes.body, {
      status,
      headers: responseHeaders
    });
  }

  // 3. Fallback to JioSaavn stream if title is available
  if (title) {
    try {
      const query = artist ? `${title} ${artist}` : title;
      console.log(`[play-yt] Invidious proxy failed. Trying JioSaavn fallback for: "${query}"`);
      const fallbackSongs = await fetchSaavnSongsWithFallback(query, 3);

      if (fallbackSongs && fallbackSongs.length > 0) {
        const fallbackSong = fallbackSongs[0];
        const saavnStreamUrl =
          fallbackSong.streamUrl_high ||
          fallbackSong.streamUrl ||
          fallbackSong.streamUrl_med ||
          fallbackSong.streamUrl_low;

        if (saavnStreamUrl) {
          console.log(`[play-yt] JioSaavn fallback SUCCESS. Proxying JioSaavn CDN URL: ${saavnStreamUrl}`);

          const saavnRes = await fetch(saavnStreamUrl, {
            headers: headersToSend
          });

          if (saavnRes.ok || saavnRes.status === 206) {
            resolvedCache.set(id, { url: saavnStreamUrl, timestamp: Date.now() });

            if (json) {
              return NextResponse.json({ streamUrl: saavnStreamUrl }, {
                headers: {
                  'Access-Control-Allow-Origin': '*',
                  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
                }
              });
            }

            const responseHeaders = new Headers();
            responseHeaders.set('Content-Type', saavnRes.headers.get('content-type') || 'audio/mpeg');
            if (saavnRes.headers.has('content-range')) {
              responseHeaders.set('Content-Range', saavnRes.headers.get('content-range')!);
            }
            if (saavnRes.headers.has('accept-ranges')) {
              responseHeaders.set('Accept-Ranges', saavnRes.headers.get('accept-ranges')!);
            }
            if (saavnRes.headers.has('content-length')) {
              responseHeaders.set('Content-Length', saavnRes.headers.get('content-length')!);
            }
            responseHeaders.set('Access-Control-Allow-Origin', '*');
            responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');

            return new NextResponse(saavnRes.body, {
              status: saavnRes.status === 206 ? 206 : 200,
              headers: responseHeaders
            });
          }
        }
      }
    } catch (saavnErr) {
      console.error('[play-yt] JioSaavn fallback search failed:', saavnErr);
    }
  }

  // 4. Fallback failing response to prevent cross-origin stripping redirects
  console.error(`[play-yt] All streaming paths failed for video ${id}`);
  return NextResponse.json(
    { error: 'All streaming resolution paths failed. Please try a different track.' },
    {
      status: 502,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
      }
    }
  );
}
