import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mapJioSaavnSong, fetchSaavnSongsWithFallback } from '@/lib/saavn';

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

function parseYoutubeDuration(durationStr: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parts[0] || 0;
}

function extractVideosFromJson(jsonData: any): any[] {
  try {
    const sectionList = jsonData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
    if (!Array.isArray(sectionList)) return [];

    let videoItems: any[] = [];
    for (const section of sectionList) {
      const itemSection = section?.itemSectionRenderer?.contents;
      if (Array.isArray(itemSection)) {
        videoItems = itemSection;
        break;
      }
    }

    if (videoItems.length === 0) return [];

    const results: any[] = [];
    for (const item of videoItems) {
      const video = item?.videoRenderer;
      if (!video || !video.videoId) continue;

      const title = video.title?.runs?.[0]?.text || video.title?.accessibility?.accessibilityData?.label || 'Unknown';
      const artist = video.ownerText?.runs?.[0]?.text || video.shortBylineText?.runs?.[0]?.text || 'Unknown Artist';
      const published = video.publishedTimeText?.simpleText || '';
      const durationStr = video.lengthText?.simpleText || '';
      const duration = parseYoutubeDuration(durationStr);

      results.push({
        id: `youtube-${video.videoId}`,
        title,
        album: 'Global Stream',
        year: published,
        duration,
        artist,
        image: `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`,
        streamUrl: `/api/play-yt?id=${video.videoId}`,
        source: 'youtube'
      });
    }

    return results;
  } catch (e) {
    console.error('Error parsing YouTube JSON:', e);
    return [];
  }
}

async function scrapeYoutubeSearch(query: string): Promise<any[]> {
  try {
    // sp=EgIQAQ%253D%253D filters for videos only to exclude channels/playlists
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      throw new Error(`YouTube HTML request failed with status ${response.status}`);
    }

    const html = await response.text();
    
    // Look for var ytInitialData = {...};
    const match = html.match(/var ytInitialData\s*=\s*({.*?});/);
    if (match && match[1]) {
      return extractVideosFromJson(JSON.parse(match[1]));
    }

    // Alternative match on window.ytInitialData
    const altMatch = html.match(/ytInitialData\s*=\s*({.*?});/);
    if (altMatch && altMatch[1]) {
      return extractVideosFromJson(JSON.parse(altMatch[1]));
    }

    throw new Error('ytInitialData JSON payload not found in YouTube page source');
  } catch (error) {
    console.error('YouTube direct scraping failed:', error);
    return [];
  }
}

async function searchYouTube(query: string): Promise<any[]> {
  // 1. Try direct high-speed HTML scraping first (extremely robust, avoids rate limits & external API dependencies)
  console.log(`Starting direct YouTube HTML search for "${query}"...`);
  const scrapeResults = await scrapeYoutubeSearch(query);
  if (scrapeResults.length > 0) {
    console.log(`YouTube scraper successfully fetched ${scrapeResults.length} videos!`);
    return scrapeResults;
  }

  // 2. Fallback: Try Invidious public instances search
  console.log('YouTube scraper returned no results, falling back to Invidious instances...');
  const invResults = await searchInvidious(query);
  if (invResults.length > 0) return invResults;

  // 3. Fallback: Try yt-dlp locally (great for offline localhost development)
  console.log('Invidious search returned no results, falling back to local yt-dlp...');
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
      fetchSaavnSongsWithFallback(query, 12),
      searchYouTube(query)
    ]);

    const songs = [...ytSongs, ...saavnSongs];

    return NextResponse.json({ songs });
  } catch (error: any) {
    console.error('Error fetching/merging songs:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
