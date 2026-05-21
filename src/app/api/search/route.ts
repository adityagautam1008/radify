import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mapJioSaavnSong } from '@/lib/saavn';

const execAsync = promisify(exec);

// Invidious instances cache
let cachedInstances: string[] = [];
let lastFetchTime = 0;

export async function getInvidiousInstances(): Promise<string[]> {
  const now = Date.now();
  if (cachedInstances.length > 0 && now - lastFetchTime < 3600 * 1000) {
    return cachedInstances;
  }

  try {
    const res = await fetch('https://api.invidious.io/instances.json?sort_by=api,type');
    if (res.ok) {
      const data = await res.json();
      const active: string[] = [];
      for (const item of data) {
        const hostname = item[0];
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

  // Stable fallbacks
  return [
    'https://inv.thepixora.com',
    'https://yewtu.be',
    'https://vid.puffyan.us',
  ];
}

async function fetchSaavnSongs(query: string): Promise<any[]> {
  try {
    const response = await fetch(
      `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(
        query
      )}&_format=json&_marker=0&ctx=web6dot0&n=12`
    );

    if (!response.ok) {
      throw new Error('JioSaavn API responded with an error');
    }

    const data = await response.json();
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    return data.results.map((song: any) => mapJioSaavnSong(song));
  } catch (error) {
    console.error('Saavn fetch failed:', error);
    return [];
  }
}

async function searchInvidious(query: string): Promise<any[]> {
  const instances = await getInvidiousInstances();
  const maxAttempts = Math.min(instances.length, 3);

  for (let i = 0; i < maxAttempts; i++) {
    const instance = instances[i];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.slice(0, 12).map((video: any) => ({
            id: `youtube-${video.videoId}`,
            title: video.title,
            album: 'Global Stream',
            year: video.publishedText || '',
            duration: video.lengthSeconds || 0,
            artist: video.author || 'Unknown Artist',
            image: `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`,
            streamUrl: `/api/play-yt?id=${video.videoId}`,
            source: 'youtube'
          }));
        }
      }
    } catch (err) {
      console.warn(`Invidious search failed on instance ${instance}, trying next...`);
    }
  }
  return [];
}

async function searchYtDlp(query: string): Promise<any[]> {
  try {
    const { stdout } = await execAsync(
      `yt-dlp --no-warnings --flat-playlist --dump-json "ytsearch12:${query}" 2>/dev/null`,
      { timeout: 15000, maxBuffer: 5 * 1024 * 1024 }
    );

    const results: any[] = [];
    for (const line of stdout.trim().split('\n')) {
      if (!line.trim()) continue;
      try {
        const video = JSON.parse(line);
        results.push({
          id: `youtube-${video.id}`,
          title: video.title || 'Unknown',
          album: 'Global Stream',
          year: video.upload_date || '',
          duration: video.duration || 0,
          artist: video.channel || video.uploader || 'Unknown Artist',
          image: `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`,
          streamUrl: `/api/play-yt?id=${video.id}`,
          source: 'youtube'
        });
      } catch { }
    }
    return results;
  } catch (err) {
    console.error('yt-dlp search failed:', err);
    return [];
  }
}

async function searchYouTube(query: string): Promise<any[]> {
  const invResults = await searchInvidious(query);
  if (invResults.length > 0) return invResults;

  console.log('Invidious search returned no results, falling back to yt-dlp...');
  return searchYtDlp(query);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    const [saavnSongs, ytSongs] = await Promise.all([
      fetchSaavnSongs(query),
      searchYouTube(query)
    ]);

    const songs = [...ytSongs, ...saavnSongs];

    return NextResponse.json({ songs });
  } catch (error: any) {
    console.error('Error fetching/merging songs:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
