import { NextRequest, NextResponse } from 'next/server';

let cachedInstances: string[] = [];
let lastFetchTime = 0;

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
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second health probe timeout

    try {
      // Probing robots.txt to verify instance server is alive and responding quickly
      // without triggering server-side YouTube IP blocks or proxy rate limits
      const res = await fetch(`${instance}/robots.txt`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok || res.status === 200) {
        return instance;
      }
      throw new Error(`Instance health check returned status: ${res.status}`);
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  try {
    // Promise.any returns the first successfully resolved promise
    return await Promise.any(candidates.map(checkInstance));
  } catch (err) {
    console.warn('All parallel Invidious instance probes failed, using fallback.');
    // Pick a working fallback candidate we tested successfully
    const backups = ['https://invidious.nerdvpn.de', 'https://yewtu.be', 'https://inv.vern.cc', 'https://invidious.no-logs.com'];
    return backups[Math.floor(Math.random() * backups.length)];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }

  try {
    const instance = await findFastestInstance(id);
    
    // Redirect the browser to the Invidious instance's proxy stream endpoint.
    // Setting `local=true` forces Invidious to proxy the googlevideo stream through its own IP,
    // which matches the IP used to resolve the URL, resolving the 403 Forbidden IP mismatch lock.
    // We request `itag=140` which is universal AAC/m4a audio (highly compatible with iOS, Android, and web).
    const streamUrl = `${instance}/latest_version?id=${id}&itag=140&local=true`;

    return NextResponse.redirect(streamUrl, {
      status: 307,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      }
    });
  } catch (error: any) {
    console.error('Failed to resolve streaming URL for video:', id, error);
    return NextResponse.json({ error: 'Failed to stream audio' }, { status: 500 });
  }
}
