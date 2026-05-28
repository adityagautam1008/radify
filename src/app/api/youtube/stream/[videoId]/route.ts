import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ytdl from '@distube/ytdl-core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{
    videoId: string;
  }>;
};

const withTimeout = <T,>(promise: Promise<T>, milliseconds: number) => (
  Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('YouTube audio lookup timed out')), milliseconds);
    }),
  ])
);

const execFileAsync = promisify(execFile);

const getYtDlpAudioUrl = async (videoId: string) => {
  const { stdout } = await execFileAsync('yt-dlp', [
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

// Cache for ytdl.getInfo() to speed up subsequent Range requests
const infoCache = new Map<string, { info: ytdl.videoInfo, timestamp: number }>();

async function getCachedInfo(videoId: string): Promise<ytdl.videoInfo> {
  const cached = infoCache.get(videoId);
  if (cached && Date.now() - cached.timestamp < 1000 * 60 * 60) {
    return cached.info;
  }
  const info = await withTimeout(ytdl.getInfo(videoId), 10000);
  infoCache.set(videoId, { info, timestamp: Date.now() });
  return info;
}

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.projectsegfau.lt',
  'https://pipedapi.in.projectsegfau.lt'
];

async function getPipedAudioUrl(videoId: string): Promise<string> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${instance}/streams/${videoId}`, { signal: controller.signal });
      clearTimeout(id);
      if (res.ok) {
        const data = await res.json();
        const audioStreams = data.audioStreams || [];
        const bestAudio = audioStreams.find((s: any) => s.mimeType?.startsWith('audio/mp4')) || audioStreams[0];
        if (bestAudio?.url) {
          return bestAudio.url;
        }
      }
    } catch {
      continue;
    }
  }
  throw new Error('All Piped instances failed');
}

export async function GET(request: Request, context: RouteContext) {
  const { videoId } = await context.params;

  if (!ytdl.validateID(videoId)) {
    return NextResponse.json({ error: 'Invalid YouTube video id' }, { status: 400 });
  }

  const rangeHeader = request.headers.get('range');

  try {
    let streamUrl = '';

    try {
      const info = await getCachedInfo(videoId);
      const format = ytdl.chooseFormat(info.formats, {
        quality: 'highestaudio',
        filter: 'audioonly',
      });
      streamUrl = format?.url || '';
    } catch {
      try {
        streamUrl = await getPipedAudioUrl(videoId);
      } catch {
        streamUrl = await withTimeout(getYtDlpAudioUrl(videoId), 11000);
      }
    }

    if (!streamUrl) {
      return NextResponse.json({ error: 'No audio stream available' }, { status: 404 });
    }

    const fetchHeaders = new Headers();
    if (rangeHeader) {
      fetchHeaders.set('Range', rangeHeader);
    }

    const ytResponse = await fetch(streamUrl, {
      headers: fetchHeaders,
    });

    if (!ytResponse.ok && ytResponse.status !== 206) {
      throw new Error(`YouTube responded with status: ${ytResponse.status}`);
    }

    const responseHeaders = new Headers(ytResponse.headers);
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.delete('Access-Control-Allow-Origin'); // Prevent CORS conflicts
    responseHeaders.set('Cache-Control', 'public, max-age=3600');

    return new Response(ytResponse.body, {
      status: ytResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.warn('[youtube-stream] failed to resolve audio', videoId, error);
    return NextResponse.json({ error: 'Unable to resolve YouTube audio stream' }, { status: 502 });
  }
}
