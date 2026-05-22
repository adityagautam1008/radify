import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

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



async function searchInvidious(query: string): Promise<any[]> {
  const instances = await getInvidiousInstances();
  const shuffled = [...instances].sort(() => Math.random() - 0.5);
  const maxAttempts = Math.min(shuffled.length, 3);

  for (let i = 0; i < maxAttempts; i++) {
    const instance = shuffled[i];
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
            streamUrl: `/api/play-yt?id=${video.videoId}&title=${encodeURIComponent(video.title)}&artist=${encodeURIComponent(video.author || 'Unknown Artist')}`,
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
          streamUrl: `/api/play-yt?id=${video.id}&title=${encodeURIComponent(video.title || 'Unknown')}&artist=${encodeURIComponent(video.channel || video.uploader || 'Unknown Artist')}`,
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
        streamUrl: `/api/play-yt?id=${video.videoId}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`,
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
let scClientIdCache: string | null = null;
let scClientIdTime = 0;

async function getSoundCloudClientId() {
  if (scClientIdCache && Date.now() - scClientIdTime < 3600000) return scClientIdCache;
  try {
    const htmlRes = await fetch('https://soundcloud.com', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await htmlRes.text();
    const scriptUrls = Array.from(html.matchAll(/<script crossorigin src="([^"]+)"><\/script>/g)).map(m => m[1]);
    for (const url of scriptUrls.slice(-3)) {
      const jsRes = await fetch(url);
      const js = await jsRes.text();
      const match = js.match(/client_id:"([^"]+)"/);
      if (match) {
        scClientIdCache = match[1];
        scClientIdTime = Date.now();
        return match[1];
      }
    }
  } catch (e) {
    console.error('SC Client ID fetch failed', e);
  }
  return 'LBCcHmGLoGQPrGcgIoH0X7TGE8G0yA9T'; // Hardcoded fallback just in case
}

async function searchSoundCloud(query: string) {
  try {
    const clientId = await getSoundCloudClientId();
    const res = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=8`);
    const data = await res.json();
    return (data.collection || []).filter((t: any) => t.media?.transcodings?.length > 0).map((track: any) => {
      const trans = track.media.transcodings.find((t: any) => t.format.protocol === 'progressive') || track.media.transcodings[0];
      return {
        id: `sc-${track.id}`,
        title: track.title,
        artist: track.user?.username || 'Unknown',
        album: 'SoundCloud',
        image: track.artwork_url ? track.artwork_url.replace('large', 't500x500') : '',
        duration: Math.floor(track.duration / 1000),
        streamUrl: `/api/play-sc?url=${encodeURIComponent(trans.url)}`,
        engine: 'soundcloud'
      };
    });
  } catch (e) {
    console.error('SoundCloud search failed:', e);
    return [];
  }
}

async function searchSpotify(query: string) {
  try {
    const tokenRes = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const tokenData = await tokenRes.json();
    const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=12`, {
      headers: { 'Authorization': `Bearer ${tokenData.accessToken}` }
    });
    const data = await res.json();
    return (data.tracks?.items || []).map((track: any) => ({
      id: `spotify-${track.id}`,
      title: track.name,
      artist: track.artists.map((a: any) => a.name).join(', '),
      album: track.album.name,
      image: track.album.images[0]?.url || '',
      duration: Math.floor(track.duration_ms / 1000),
      searchQuery: `${track.name} ${track.artists[0]?.name}`,
      engine: 'spotify'
    }));
  } catch (e) {
    console.error('Spotify search failed:', e);
    return [];
  }
}

async function searchAudiomack(query: string) {
  try {
    // Audiomack public API search endpoint
    const res = await fetch(`https://audiomack.com/api/music/search?q=${encodeURIComponent(query)}&limit=8`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((track: any) => ({
      id: `audiomack-${track.id}`,
      title: track.title,
      artist: track.artist,
      album: 'Audiomack',
      image: track.image || '',
      duration: 0,
      searchQuery: `${track.title} ${track.artist}`,
      engine: 'audiomack'
    }));
  } catch (e) {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const id = searchParams.get('id');

  try {
    if (id) {
      const { fetchSaavnSongDetails } = await import('@/lib/saavn');
      const song = await fetchSaavnSongDetails(id);
      if (song) return NextResponse.json({ song });
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    if (!query) {
      return NextResponse.json({ error: 'Query or id parameter is required' }, { status: 400 });
    }

    const [saavnSongs, spotifySongs, scSongs, audiomackSongs] = await Promise.all([
      fetchSaavnSongsWithFallback(query, 12),
      searchSpotify(query),
      searchSoundCloud(query),
      searchAudiomack(query)
    ]);

    // Format them correctly so AudioPlayer knows which engine is which
    const formattedSpotify = spotifySongs.map((s: any) => ({ ...s, streamUrl: `/api/play-spotify?q=${encodeURIComponent(s.searchQuery)}` }));
    const formattedAudiomack = audiomackSongs.map((s: any) => ({ ...s, streamUrl: `/api/play-spotify?q=${encodeURIComponent(s.searchQuery)}` }));

    const songs = [...saavnSongs, ...formattedSpotify, ...scSongs, ...formattedAudiomack];

    return NextResponse.json({ songs });
  } catch (error: any) {
    console.error('Error fetching/merging songs:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
