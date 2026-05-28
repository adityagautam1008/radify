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
  ], { timeout: 15000 });

  return stdout.trim().split('\n').find(Boolean) || '';
};

const infoCache = new Map<string, { url: string, timestamp: number }>();

async function getPlayDlAudioUrl(videoId: string): Promise<string> {
  const cached = infoCache.get(videoId);
  if (cached && Date.now() - cached.timestamp < 1000 * 60 * 60) {
    return cached.url;
  }
  
  const info = await play.video_info(`https://www.youtube.com/watch?v=${videoId}`);
  const format = info.format.find((f: any) => f.mimeType?.includes('audio/mp4')) || info.format[0];
  if (!format || !format.url) throw new Error('No format found');
  
  infoCache.set(videoId, { url: format.url, timestamp: Date.now() });
  return format.url;
}

export async function GET(request: Request, context: RouteContext) {
  const { videoId } = await context.params;

  if (!ytdl.validateID(videoId)) {
    return NextResponse.json({ error: 'Invalid YouTube video id' }, { status: 400 });
  }

  const rangeHeader = request.headers.get('range');

  try {
    let streamUrl = '';

    // Attempt 1: play-dl (most robust against IP blocks)
    try {
      streamUrl = await withTimeout(getPlayDlAudioUrl(videoId), 8000);
    } catch {
      // Attempt 2: ytdl-core
      try {
        const info = await ytdl.getInfo(videoId);
        const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
        streamUrl = format?.url || '';
      } catch {
        // Attempt 3: yt-dlp binary
        try {
          streamUrl = await withTimeout(getYtDlpAudioUrl(videoId), 15000);
        } catch {
          streamUrl = '';
        }
      }
    }

    if (!streamUrl) {
      return NextResponse.json({ error: 'No audio stream available' }, { status: 404 });
    }

    const fetchHeaders = new Headers();
    if (rangeHeader) {
      fetchHeaders.set('Range', rangeHeader);
    }
    fetchHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

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
