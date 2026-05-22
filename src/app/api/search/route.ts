import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { exec } from 'child_process';
import { promisify } from 'util';
import { mapJioSaavnSong, fetchSaavnSongsWithFallback } from '@/lib/saavn';

const execAsync = promisify(exec);

// Removed legacy YouTube code.
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
