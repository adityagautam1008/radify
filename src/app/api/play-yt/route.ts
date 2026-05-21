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

  try {
    const res = await fetch('https://api.invidious.io/instances.json?sort_by=api,type');
    if (res.ok) {
      const data = await res.json();
      const active: string[] = [];
      for (const item of data) {
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

  // Fallback instances in case the api.invidious.io registry is down
  return [
    'https://inv.thepixora.com',
    'https://yewtu.be',
    'https://vid.puffyan.us',
    'https://invidious.asir.dev',
    'https://invidious.projectsegfaut.im',
    'https://inv.vern.cc'
  ];
}

// Probes candidate instances in parallel and returns the fastest responding one
async function findFastestInstance(videoId: string): Promise<string> {
  const instances = await getInvidiousInstances();
  const candidates = instances.slice(0, 12); // Probe the top 12 candidates concurrently

  const checkInstance = async (instance: string): Promise<string> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5 second probe timeout

    try {
      // Probing the actual stream URL with a Range request to verify it's not rate-limited or blocked (403 Forbidden) by YouTube
      const res = await fetch(`${instance}/latest_version?id=${videoId}&itag=140&local=true`, {
        signal: controller.signal,
        headers: {
          'Range': 'bytes=0-0'
        }
      });
      clearTimeout(timeoutId);
      if (res.ok || res.status === 206) {
        return instance;
      }
      throw new Error(`Instance stream probe returned status: ${res.status}`);
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
    return candidates[0] || 'https://inv.thepixora.com';
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
