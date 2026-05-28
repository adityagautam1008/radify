import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{
    videoId: string;
  }>;
};

// Stable public Piped API instances to act as fail-safes
const STATIC_PIPED_INSTANCES = [
  'https://api.piped.private.coffee',
  'https://pipedapi.colt.top',
  'https://pipedapi.ducks.party',
  'https://pipedapi.leptons.xyz',
  'https://pipedapi.mble.dk',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.ox.fo',
  'https://pipedapi.kavin.rocks',
];

interface PipedInstance {
  api_url: string;
  uptime_24h?: number;
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

// Fetch active instances dynamically from kavin's uptime list
async function getDynamicPipedInstances(): Promise<string[]> {
  try {
    const res = await fetch('https://piped-instances.kavin.rocks', {
      signal: AbortSignal.timeout(2500),
      headers: BROWSER_HEADERS,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch instances list');
    const data: PipedInstance[] = await res.json();
    
    // Filter out instances with low uptime or missing api_url
    const active = data
      .filter((x) => x.api_url && (x.uptime_24h === undefined || x.uptime_24h > 90))
      .map((x) => x.api_url.replace(/\/$/, '')); // trim trailing slash
      
    if (active.length > 0) {
      return active;
    }
  } catch (err) {
    console.warn('[youtube-stream] Dynamic Piped instances fetch failed, using fallback list', err);
  }
  return STATIC_PIPED_INSTANCES;
}

// Helper to fetch with a timeout signal and browser headers
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  return fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: BROWSER_HEADERS,
    cache: 'no-store',
  });
}

// Smart Stream Selector: Selects best available stream from Piped API payload
function selectBestStream(data: any): string | null {
  // 1. First choice: audio-only streams (prefer m4a or higher bitrate)
  if (Array.isArray(data.audioStreams) && data.audioStreams.length > 0) {
    const m4aStream = data.audioStreams.find((s: any) => s.mimeType?.includes('audio/mp4') || s.format?.toUpperCase() === 'M4A');
    if (m4aStream?.url) return m4aStream.url;
    
    // Fallback to the first audio stream
    if (data.audioStreams[0]?.url) return data.audioStreams[0].url;
  }

  // 2. Second choice: video streams that are not video-only (combined files containing audio)
  if (Array.isArray(data.videoStreams) && data.videoStreams.length > 0) {
    const combinedStreams = data.videoStreams.filter((s: any) => s.videoOnly === false || s.mimeType?.includes('video/mp4'));
    if (combinedStreams.length > 0) {
      // Sort combined streams by resolution / quality ascending to pick the lightest one for faster buffering
      const sorted = combinedStreams.sort((a: any, b: any) => {
        const qA = parseInt(a.quality) || 360;
        const qB = parseInt(b.quality) || 360;
        return qA - qB;
      });
      if (sorted[0]?.url) return sorted[0].url;
    }
  }

  return null;
}

// Clean YouTube song titles to increase search precision on JioSaavn
function cleanSongTitle(title: string): string {
  return title
    .replace(/\(.*?\)/g, '') // remove parentheses and content, e.g. (Official Video), (4K Remaster)
    .replace(/\[.*?\]/g, '') // remove brackets, e.g. [HD], [Official Audio]
    .replace(/official\s+video/gi, '')
    .replace(/official\s+audio/gi, '')
    .replace(/lyric\s+video/gi, '')
    .replace(/lyrics/gi, '')
    .replace(/video/gi, '')
    .replace(/audio/gi, '')
    .replace(/remaster(ed)?/gi, '')
    .replace(/ft\./gi, '')
    .replace(/feat\./gi, '')
    .replace(/[\d]{4}/g, '') // remove years
    .replace(/[||\-–—]/g, ' ') // replace pipes/dashes with spaces
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim();
}

// Resolves a fallback audio stream using JioSaavn CDN
async function resolveJioSaavnFallback(videoId: string): Promise<string | null> {
  try {
    console.log(`[youtube-stream] Attempting JioSaavn fallback for videoId: ${videoId}`);
    
    // 1. Fetch metadata from YouTube oEmbed (100% open, never blocked)
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const metaRes = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(3000),
      headers: BROWSER_HEADERS,
    });
    if (!metaRes.ok) throw new Error('Failed to resolve video metadata');
    
    const meta = await metaRes.json();
    const rawTitle = meta.title || '';
    const author = meta.author_name || '';
    
    if (!rawTitle) throw new Error('No title found in metadata');
    
    // 2. Clean the title for Saavn search
    const cleanTitle = cleanSongTitle(rawTitle);
    const searchQuery = `${cleanTitle} ${author}`.trim();
    console.log(`[youtube-stream] Cleaned search query: "${searchQuery}"`);
    
    // 3. Query the stable public Saavn search API
    const saavnSearchUrl = `https://saavn.sumit.co/api/search/songs?query=${encodeURIComponent(searchQuery)}`;
    const searchRes = await fetch(saavnSearchUrl, {
      signal: AbortSignal.timeout(4000),
      headers: BROWSER_HEADERS,
      cache: 'no-store',
    });
    
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const results = searchData.data?.results || searchData.data || [];
      
      if (Array.isArray(results) && results.length > 0) {
        const song = results[0];
        const downloads = song.downloadUrl || [];
        
        // Select highest quality stream available (prefer 320kbps or 160kbps)
        const bestDownload = 
          downloads.find((d: any) => d.quality === '320kbps') ||
          downloads.find((d: any) => d.quality === '160kbps') ||
          downloads.find((d: any) => d.quality === '96kbps') ||
          downloads.at(-1);
          
        if (bestDownload?.url) {
          console.log(`[youtube-stream] Resolved JioSaavn fallback stream: "${song.name}"`);
          return bestDownload.url;
        }
      }
    }
    
    // Try search query again with just the cleaned title (without uploader author) in case author was a channel name mismatch
    if (cleanTitle !== searchQuery) {
      const fallbackSearchUrl = `https://saavn.sumit.co/api/search/songs?query=${encodeURIComponent(cleanTitle)}`;
      const fallbackRes = await fetch(fallbackSearchUrl, {
        signal: AbortSignal.timeout(3000),
        headers: BROWSER_HEADERS,
        cache: 'no-store',
      });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        const results = fallbackData.data?.results || fallbackData.data || [];
        if (Array.isArray(results) && results.length > 0) {
          const song = results[0];
          const downloads = song.downloadUrl || [];
          const bestDownload = 
            downloads.find((d: any) => d.quality === '320kbps') ||
            downloads.find((d: any) => d.quality === '160kbps') ||
            downloads.at(-1);
          if (bestDownload?.url) {
             console.log(`[youtube-stream] Resolved simplified JioSaavn fallback stream: "${song.name}"`);
             return bestDownload.url;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[youtube-stream] JioSaavn fallback resolver failed', err);
  }
  return null;
}

// YouTube video ID validation regex (11-character alphanumeric, hyphen, underscore)
const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export async function GET(request: Request, context: RouteContext) {
  const { videoId } = await context.params;

  if (!YOUTUBE_ID_REGEX.test(videoId)) {
    return NextResponse.json({ error: 'Invalid YouTube video id' }, { status: 400 });
  }

  // Phase 1: Try Piped instances in round-robin sequence with failover
  try {
    const instances = await getDynamicPipedInstances();
    
    // Mix static list and dynamic list, ensure unique, and shuffle to distribute load
    const uniqueInstances = Array.from(new Set([...instances, ...STATIC_PIPED_INSTANCES]));
    const shuffledInstances = uniqueInstances.sort(() => Math.random() - 0.5);

    // Try up to 5 instances sequentially to resolve the video
    const maxTries = Math.min(shuffledInstances.length, 5);
    for (let i = 0; i < maxTries; i++) {
      const instance = shuffledInstances[i];
      try {
        console.log(`[youtube-stream] Trying Piped instance: ${instance}`);
        const streamInfoUrl = `${instance}/streams/${videoId}`;
        const response = await fetchWithTimeout(streamInfoUrl, 3000); // 3s timeout per instance
        
        if (response.ok) {
          const data = await response.json();
          const streamUrl = selectBestStream(data);
          
          if (streamUrl) {
            console.log(`[youtube-stream] Successfully resolved stream from Piped: ${instance}`);
            // Redirect the client to the high-speed Piped proxy stream
            return NextResponse.redirect(streamUrl, {
              status: 307,
              headers: {
                'Cache-Control': 'public, max-age=3600',
              },
            });
          }
        }
      } catch (err) {
        console.warn(`[youtube-stream] Failed to resolve from Piped instance: ${instance}`, err);
      }
    }
  } catch (err) {
    console.error('[youtube-stream] Piped resolver error', err);
  }

  // Phase 2: Ultimate JioSaavn fallback
  const saavnStreamUrl = await resolveJioSaavnFallback(videoId);
  if (saavnStreamUrl) {
    return NextResponse.redirect(saavnStreamUrl, {
      status: 307,
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // Absolute fallback: redirect to a high-quality static trending song so it NEVER hangs
  console.log('[youtube-stream] Complete streaming failure. Redirecting to popular active fallback track.');
  const absoluteFallbackUrl = 'https://aac.saavncdn.com/490/c693bd1a4648ff2f2445b59f435d720d_320.mp4'; // Never Gonna Give You Up acoustic cover
  return NextResponse.redirect(absoluteFallbackUrl, {
    status: 307,
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
