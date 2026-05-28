import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import ytdl from '@distube/ytdl-core';
import play from 'play-dl';

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

// Fetch active instances dynamically from kavin's uptime list
async function getDynamicPipedInstances(): Promise<string[]> {
  try {
    const res = await fetch('https://piped-instances.kavin.rocks', {
      signal: AbortSignal.timeout(2000),
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

// Helper to fetch with a timeout signal
async function fetchWithTimeout(url: string, timeoutMs: number, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
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

// Last resort backup extraction utilities
const execFileAsync = promisify(execFile);

const getYtDlpAudioUrl = async (videoId: string) => {
  const binary = existsSync('./yt-dlp_linux') ? './yt-dlp_linux' : 'yt-dlp';
  const { stdout } = await execFileAsync(binary, [
    `https://www.youtube.com/watch?v=${videoId}`,
    '-f',
    'bestaudio[ext=m4a]/bestaudio',
    '--no-playlist',
    '--skip-download',
    '--print',
    'url',
    '--quiet',
  ], { timeout: 10000 });

  return stdout.trim().split('\n').find(Boolean) || '';
};

async function getPlayDlAudioUrl(videoId: string): Promise<string> {
  const info = await play.video_info(`https://www.youtube.com/watch?v=${videoId}`);
  const format = info.format.find((f: any) => f.mimeType?.includes('audio/mp4')) || info.format[0];
  if (!format || !format.url) throw new Error('No format found');
  return format.url;
}

export async function GET(request: Request, context: RouteContext) {
  const { videoId } = await context.params;

  if (!ytdl.validateID(videoId)) {
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
        const response = await fetchWithTimeout(streamInfoUrl, 2500); // 2.5s timeout per instance
        
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

  // Phase 2: Backup Local Extraction
  console.log('[youtube-stream] All Piped instances failed. Falling back to local extraction.');
  
  try {
    let fallbackUrl = '';
    
    try {
      fallbackUrl = await getPlayDlAudioUrl(videoId);
    } catch {
      try {
        const info = await ytdl.getInfo(videoId);
        const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
        fallbackUrl = format?.url || '';
      } catch {
        try {
          fallbackUrl = await getYtDlpAudioUrl(videoId);
        } catch {
          fallbackUrl = '';
        }
      }
    }

    if (fallbackUrl) {
      console.log('[youtube-stream] Resolved backup stream from local extraction');
      return NextResponse.redirect(fallbackUrl, {
        status: 307,
        headers: {
          'Cache-Control': 'public, max-age=1800',
        },
      });
    }
  } catch (err) {
    console.error('[youtube-stream] Backup extraction failed', err);
  }

  return NextResponse.json({ error: 'Unable to resolve YouTube stream' }, { status: 502 });
}

