import { NextRequest, NextResponse } from 'next/server';
import { fetchSaavnSongsWithFallback } from '@/lib/saavn';

export const dynamic = 'force-dynamic';

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

  // Large pool of highly stable and popular public Invidious instances
  const fallbacks = [
    'https://yewtu.be',
    'https://invidious.nerdvpn.de',
    'https://inv.vern.cc',
    'https://invidious.no-logs.com',
    'https://iv.melmac.space',
    'https://inv.nadeko.net',
    'https://invidious.f5.si',
    'https://yt.chocolatemoo53.com',
    'https://inv.thepixora.com',
    'https://vid.puffyan.us',
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
        // Merge fetched active instances with our trusted fallback list, ensuring uniqueness
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

// Probes candidate instances in parallel and returns the fastest responding one
async function findFastestInstance(videoId: string): Promise<string> {
  const instances = await getInvidiousInstances();
  const shuffled = [...instances].sort(() => Math.random() - 0.5);
  const candidates = shuffled.slice(0, 10); // Probe the top 10 candidates concurrently

  const checkInstance = async (instance: string): Promise<string> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5 second streaming HEAD probe timeout

    try {
      // Probing actual stream redirect URL to verify it resolves without 403 / 502 / 503 errors.
      // We use HEAD method to only fetch headers and verify the stream is playable/accessible.
      const res = await fetch(`${instance}/latest_version?id=${videoId}&itag=140&local=true`, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'manual' // We only want to see if the instance successfully returns a 200, 206, 302, 307 status
      });
      clearTimeout(timeoutId);
      if (res.status === 200 || res.status === 206 || res.status === 302 || res.status === 307) {
        return instance;
      }
      throw new Error(`Instance streaming probe failed with status: ${res.status}`);
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  try {
    // Promise.any returns the first successfully resolved promise
    return await Promise.any(candidates.map(checkInstance));
  } catch (err) {
    console.warn('All parallel Invidious streaming HEAD probes failed, using fallback.');
    // Pick a working fallback candidate we tested successfully
    const backups = ['https://invidious.nerdvpn.de', 'https://yewtu.be', 'https://inv.vern.cc', 'https://invidious.no-logs.com'];
    return backups[Math.floor(Math.random() * backups.length)];
  }
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

  // Response helper to cleanly serve redirects or direct JSON payloads
  const sendResponse = (streamUrl: string) => {
    if (json) {
      return NextResponse.json({ streamUrl }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        }
      });
    }
    return NextResponse.redirect(streamUrl, {
      status: 307,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      }
    });
  };

  // 1. Check simple in-memory cache first to keep range/seeking pings consistent
  if (!nocache && resolvedCache.has(id)) {
    const cached = resolvedCache.get(id)!;
    console.log(`[play-yt] Serving cached stream URL for video ${id}`);
    return sendResponse(cached.url);
  }

  // 2. Try Invidious streaming resolution
  try {
    const instance = await findFastestInstance(id);
    const streamUrl = `${instance}/latest_version?id=${id}&itag=140&local=true`;

    resolvedCache.set(id, { url: streamUrl, timestamp: Date.now() });
    return sendResponse(streamUrl);
  } catch (error: any) {
    console.warn(`Invidious streaming resolution failed for video ${id}, attempting JioSaavn fallback...`, error);

    // 3. Fallback to JioSaavn stream if title/artist are available
    if (title) {
      try {
        const query = artist ? `${title} ${artist}` : title;
        console.log(`[play-yt] Searching JioSaavn fallback for "${query}"`);
        const fallbackSongs = await fetchSaavnSongsWithFallback(query, 3);
        
        if (fallbackSongs && fallbackSongs.length > 0) {
          const fallbackSong = fallbackSongs[0];
          const streamUrl = fallbackSong.streamUrl_high || fallbackSong.streamUrl || fallbackSong.streamUrl_med || fallbackSong.streamUrl_low;
          
          if (streamUrl) {
            console.log(`[play-yt] JioSaavn fallback SUCCESS for "${query}". Streaming URL: ${streamUrl}`);
            resolvedCache.set(id, { url: streamUrl, timestamp: Date.now() });
            return sendResponse(streamUrl);
          }
        }
      } catch (saavnErr) {
        console.error('[play-yt] JioSaavn fallback search failed:', saavnErr);
      }
    }

    // 4. Absolute Last Resort: Redirect to a random Invidious candidate directly
    try {
      const instances = await getInvidiousInstances();
      const randomInstance = instances[Math.floor(Math.random() * instances.length)];
      const streamUrl = `${randomInstance}/latest_version?id=${id}&itag=140&local=true`;
      console.warn(`[play-yt] Fallback to random instance direct redirect: ${streamUrl}`);
      
      resolvedCache.set(id, { url: streamUrl, timestamp: Date.now() });
      return sendResponse(streamUrl);
    } catch (finalErr) {
      console.error('All streaming resolution failovers failed:', finalErr);
      return NextResponse.json({ error: 'Failed to stream audio' }, { status: 500 });
    }
  }
}
