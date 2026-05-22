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

async function getPipedStream(id: string): Promise<string | null> {
  const instances = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.lunar.icu',
    'https://pipedapi.smnz.de',
    'https://piped-api.garudalinux.org',
    'https://api.piped.projectsegfaut.im'
  ];

  for (const instance of instances) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${instance}/streams/${id}`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.audioStreams && data.audioStreams.length > 0) {
          // Prefer m4a/mp4 for broader browser support (iOS safari etc)
          const bestStream = data.audioStreams.find((s: any) => s.mimeType?.includes('mp4')) || data.audioStreams[0];
          if (bestStream && bestStream.url) {
            console.log(`[play-yt] Piped API resolved stream on: ${instance}`);
            return bestStream.url;
          }
        }
      }
    } catch (e) {
      // Ignored, try next instance
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const nocache = searchParams.get('nocache') === 'true';
  const json = searchParams.get('json') === 'true';

  if (!id) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
  };

  // 1. Cached direct URL
  if (!nocache && resolvedCache.has(id)) {
    const cachedUrl = resolvedCache.get(id)!.url;
    if (json) return NextResponse.json({ streamUrl: cachedUrl }, { headers: corsHeaders });
    return NextResponse.redirect(cachedUrl, 302);
  }

  // 2. Try Piped API (Fastest and most reliable for direct URLs)
  const pipedUrl = await getPipedStream(id);
  if (pipedUrl) {
    resolvedCache.set(id, { url: pipedUrl, timestamp: Date.now() });
    if (json) return NextResponse.json({ streamUrl: pipedUrl }, { headers: corsHeaders });
    return NextResponse.redirect(pipedUrl, 302);
  }

  // 3. Try yt-dlp binary (if available locally)
  const ytdlpUrl = await getAudioUrl(id);
  if (ytdlpUrl) {
    resolvedCache.set(id, { url: ytdlpUrl, timestamp: Date.now() });
    if (json) return NextResponse.json({ streamUrl: ytdlpUrl }, { headers: corsHeaders });
    return NextResponse.redirect(ytdlpUrl, 302);
  }

  // 4. Try Invidious /latest_version direct redirect
  const instances = await getInvidiousInstances();
  if (instances.length > 0) {
    const invUrl = `${instances[0]}/latest_version?id=${id}&itag=140&local=true`;
    if (json) return NextResponse.json({ streamUrl: invUrl }, { headers: corsHeaders });
    return NextResponse.redirect(invUrl, 302);
  }

  // If all fails, return an error (DO NOT fallback to Saavn randomly, as it causes "wrong song" bugs)
  console.error(`[play-yt] All streaming paths failed for video ${id}`);
  return NextResponse.json(
    { error: 'All streaming resolution paths failed. Please try a different track.' },
    { status: 502, headers: corsHeaders }
  );
}
