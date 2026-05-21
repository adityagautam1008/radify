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

// Probes candidate instances in parallel using lightweight GET + Range probes
async function findFastestInstance(videoId: string): Promise<string> {
  const instances = await getInvidiousInstances();
  
  // Prioritize verified working instances that proxy streams
  const preferred = [
    'https://inv.thepixora.com',
    'https://inv.vern.cc',
    'https://invidious.no-logs.com'
  ];
  
  const remaining = instances.filter(inst => !preferred.includes(inst));
  const shuffledRemaining = [...remaining].sort(() => Math.random() - 0.5);
  
  // Create final list starting with preferred instances
  const candidates = Array.from(new Set([...preferred, ...shuffledRemaining])).slice(0, 10);
  console.log(`[play-yt] Probing top candidates:`, candidates);

  const checkInstance = async (instance: string): Promise<string> => {
    let currentUrl = `${instance}/latest_version?id=${videoId}&itag=140&local=true`;
    
    // Manually follow redirects up to 5 levels to resolve the final direct media streaming URL
    for (let i = 0; i < 5; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout per step

      try {
        const res = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'Range': 'bytes=0-10', // Lightweight 11-byte probe
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        clearTimeout(timeoutId);

        if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
          const location = res.headers.get('location');
          if (location) {
            currentUrl = new URL(location, currentUrl).toString();
            continue;
          }
        }

        // Final URL reached. Verify it is a valid audio stream and not an HTML/JSON page
        const contentType = res.headers.get('content-type') || '';
        const status = res.status;
        
        if (status === 200 || status === 206) {
          if (contentType.includes('text/html') || contentType.includes('application/json')) {
            throw new Error('Instance returned HTML/JSON instead of audio data');
          }
          if (currentUrl.includes('googlevideo.com')) {
            throw new Error('Instance redirected to googlevideo.com directly (unsupported for proxying on cloud IPs)');
          }
          console.log(`[play-yt] Successfully verified candidate ${instance} -> Resolved final URL: ${currentUrl}`);
          return currentUrl; // Success! Return the fully resolved direct streaming companion URL
        }
        
        throw new Error(`Instance returned invalid status: ${status}`);
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    }
    throw new Error('Too many redirects');
  };

  try {
    // Promise.any returns the first successfully resolved promise
    return await Promise.any(candidates.map(checkInstance));
  } catch (err) {
    console.warn('All parallel Invidious streaming resolution probes failed, using direct manual fallback.');
    
    // Pick the most trusted instances one-by-one with a larger timeout and no racing
    const fallbacks = [
      'https://inv.thepixora.com',
      'https://inv.vern.cc'
    ];
    
    for (const fallbackInstance of fallbacks) {
      try {
        console.log(`[play-yt] Attempting direct manual fallback resolution for: ${fallbackInstance}`);
        const resolvedUrl = await checkInstance(fallbackInstance);
        return resolvedUrl;
      } catch (fallbackErr) {
        console.warn(`[play-yt] Direct manual fallback failed for ${fallbackInstance}:`, fallbackErr);
      }
    }
    
    throw new Error('All parallel probes and manual fallbacks failed to resolve a working stream.');
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

  // Same-origin high-performance reverse stream proxy
  const sendResponse = async (streamUrl: string) => {
    if (json) {
      return NextResponse.json({ streamUrl }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        }
      });
    }

    try {
      const rangeHeader = request.headers.get('range');
      const headersToSend = new Headers();
      if (rangeHeader) {
        headersToSend.set('range', rangeHeader);
      }
      // Mimic browser user-agent to bypass basic rate-limiting
      headersToSend.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      let currentStreamUrl = streamUrl;
      let streamRes: Response | null = null;
      
      // Manually follow redirects in the proxy stream to prevent Range header stripping
      for (let redirectCount = 0; redirectCount < 5; redirectCount++) {
        streamRes = await fetch(currentStreamUrl, {
          headers: headersToSend,
          method: 'GET',
          redirect: 'manual'
        });
        
        if (streamRes.status === 301 || streamRes.status === 302 || streamRes.status === 307 || streamRes.status === 308) {
          const location = streamRes.headers.get('location');
          if (location) {
            currentStreamUrl = new URL(location, currentStreamUrl).toString();
            console.log(`[play-yt] Proxy fetch followed redirect to: ${currentStreamUrl}`);
            continue;
          }
        }
        break;
      }

      if (!streamRes) {
        throw new Error('Failed to fetch stream data');
      }

      // Forward correct headers back to the browser
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
    } catch (proxyErr) {
      console.error('[play-yt] Stream proxying failed, falling back to 307 redirect:', proxyErr);
      return NextResponse.redirect(streamUrl, {
        status: 307,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        }
      });
    }
  };

  // 1. Check simple in-memory cache first to keep range/seeking pings consistent
  if (!nocache && resolvedCache.has(id)) {
    const cached = resolvedCache.get(id)!;
    console.log(`[play-yt] Serving cached stream URL for video ${id}`);
    return await sendResponse(cached.url);
  }

  // 2. Try Invidious streaming resolution
  try {
    const streamUrl = await findFastestInstance(id);
    console.log(`[play-yt] Successfully resolved direct stream URL: ${streamUrl}`);
    resolvedCache.set(id, { url: streamUrl, timestamp: Date.now() });
    return await sendResponse(streamUrl);
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
            return await sendResponse(streamUrl);
          }
        }
      } catch (saavnErr) {
        console.error('[play-yt] JioSaavn fallback search failed:', saavnErr);
      }
    }

    // 4. Absolute Last Resort: Fallback to a trusted working instance directly (inv.thepixora.com)
    const fallbackInstanceUrl = `https://inv.thepixora.com/latest_version?id=${id}&itag=140&local=true`;
    console.warn(`[play-yt] Fallback to trusted inv.thepixora.com instance: ${fallbackInstanceUrl}`);
    resolvedCache.set(id, { url: fallbackInstanceUrl, timestamp: Date.now() });
    return await sendResponse(fallbackInstanceUrl);
  }
}

