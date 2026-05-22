import CryptoJS from 'crypto-js';

const DECRYPT_KEY = '38346591';

export function decryptMediaUrl(encryptedUrl: string): string {
  try {
    const key = CryptoJS.enc.Utf8.parse(DECRYPT_KEY);
    const decrypted = CryptoJS.DES.decrypt(
      { ciphertext: CryptoJS.enc.Base64.parse(encryptedUrl) } as any,
      key,
      {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
      }
    );
    return decrypted.toString(CryptoJS.enc.Utf8).trim();
  } catch (error) {
    console.error('Failed to decrypt URL:', error);
    return '';
  }
}

export interface JioSaavnSong {
  id: string;
  song?: string;
  title?: string;
  album?: string;
  year?: string;
  duration: string | number;
  primary_artists?: string;
  singers?: string;
  image?: string;
  encrypted_media_url?: string;
}

export function mapJioSaavnSong(song: JioSaavnSong) {
  let decryptedUrl = '';
  if (song.encrypted_media_url) {
    decryptedUrl = decryptMediaUrl(song.encrypted_media_url);
  }

  let streamUrl_96 = decryptedUrl;
  let streamUrl_160 = decryptedUrl;
  let streamUrl_320 = decryptedUrl;

  if (decryptedUrl) {
    // The decrypted URL contains a quality suffix like _96.mp4 or _128.mp4.
    // Build all quality variants by replacing whatever quality is present.
    const qualityPattern = /_(96|128|160|320)\.mp4/;
    streamUrl_96 = decryptedUrl.replace(qualityPattern, '_96.mp4');
    streamUrl_160 = decryptedUrl.replace(qualityPattern, '_160.mp4');
    streamUrl_320 = decryptedUrl.replace(qualityPattern, '_320.mp4');
  }

  const highResImage = song.image
    ? song.image.replace('150x150', '500x500').replace('50x50', '500x500')
    : '';

  return {
    id: song.id,
    title: song.song || song.title || 'Unknown Song',
    album: song.album || 'Saavn Track',
    year: song.year || '',
    duration: typeof song.duration === 'string' ? parseInt(song.duration, 10) || 0 : song.duration || 0,
    artist: song.primary_artists || song.singers || 'Unknown Artist',
    image: highResImage || song.image || '',
    streamUrl: streamUrl_320 || streamUrl_160 || streamUrl_96,
    streamUrl_low: streamUrl_96,
    streamUrl_med: streamUrl_160,
    streamUrl_high: streamUrl_320,
    source: 'saavn' as const
  };
}

export function mapProxySaavnSong(song: any) {
  // Extract artist name
  let artistName = 'Unknown Artist';
  if (song.artists) {
    if (Array.isArray(song.artists.primary) && song.artists.primary.length > 0) {
      artistName = song.artists.primary.map((a: any) => a.name).join(', ');
    } else if (song.artists.all && song.artists.all.length > 0) {
      artistName = song.artists.all.map((a: any) => a.name).join(', ');
    }
  } else if (song.primaryArtists) {
    artistName = Array.isArray(song.primaryArtists) 
      ? song.primaryArtists.map((a: any) => a.name).join(', ') 
      : String(song.primaryArtists);
  }

  // Extract images
  let image500 = '';
  if (Array.isArray(song.image)) {
    const highQuality = song.image.find((img: any) => img.quality === '500x500' || img.quality === '500');
    if (highQuality) {
      image500 = highQuality.url;
    } else if (song.image.length > 0) {
      image500 = song.image[song.image.length - 1].url;
    }
  } else if (typeof song.image === 'string') {
    image500 = song.image.replace('150x150', '500x500').replace('50x50', '500x500');
  }

  // Extract download stream URLs
  let stream_96 = '';
  let stream_160 = '';
  let stream_320 = '';

  if (Array.isArray(song.downloadUrl) && song.downloadUrl.length > 0) {
    const url_96 = song.downloadUrl.find((d: any) => d.quality === '96kbps' || d.quality === '96');
    const url_160 = song.downloadUrl.find((d: any) => d.quality === '160kbps' || d.quality === '160');
    const url_320 = song.downloadUrl.find((d: any) => d.quality === '320kbps' || d.quality === '320');

    stream_96 = url_96?.url || song.downloadUrl[0]?.url || '';
    stream_160 = url_160?.url || song.downloadUrl[Math.min(1, song.downloadUrl.length - 1)]?.url || '';
    stream_320 = url_320?.url || song.downloadUrl[song.downloadUrl.length - 1]?.url || '';
  }

  return {
    id: song.id,
    title: song.name || song.title || 'Unknown Song',
    album: typeof song.album === 'object' ? song.album.name : song.album || 'Saavn Track',
    year: song.year || '',
    duration: typeof song.duration === 'string' ? parseInt(song.duration, 10) || 0 : song.duration || 0,
    artist: artistName,
    image: image500 || '',
    streamUrl: stream_320 || stream_160 || stream_96,
    streamUrl_low: stream_96,
    streamUrl_med: stream_160,
    streamUrl_high: stream_320,
    source: 'saavn' as const
  };
}

export async function fetchSaavnPlaylist(listId: string) {
  // First, try the direct endpoint (ideal for localhost/local development in India)
  try {
    const response = await fetch(
      `https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=${listId}&_format=json&_marker=0&ctx=web6dot0`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.songs && Array.isArray(data.songs) && data.songs.length > 0) {
        return data.songs.map((song: JioSaavnSong) => mapJioSaavnSong(song));
      }
    }
  } catch (error) {
    console.warn(`Direct fetch for playlist ${listId} failed. Trying fallback proxies...`, error);
  }

  // Fallback to unofficial API proxies (crucial for Vercel US hosting nodes)
  const fallbackHosts = [
    'https://saavn.dev',
    'https://saavn.sumit.co',
    'https://jiosaavn-api-beta.vercel.app'
  ];

  for (const host of fallbackHosts) {
    try {
      const response = await fetch(`${host}/api/playlists?id=${listId}`);
      if (response.ok) {
        const payload = await response.json();
        const songsList = payload.data?.songs || payload.data || payload.songs;
        if (Array.isArray(songsList) && songsList.length > 0) {
          return songsList.map((song: any) => mapProxySaavnSong(song));
        }
      }
    } catch (err) {
      console.warn(`Fallback proxy ${host} failed for playlist ${listId}:`, err);
    }
  }

  return [];
}

export async function fetchSaavnSongsWithFallback(query: string, limit = 12): Promise<any[]> {
  // 1. Try direct fetch
  try {
    const response = await fetch(
      `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(
        query
      )}&_format=json&_marker=0&ctx=web6dot0&n=${limit}`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.results && Array.isArray(data.results) && data.results.length > 0) {
        return data.results.map((song: any) => mapJioSaavnSong(song));
      }
    }
  } catch (error) {
    console.warn(`Direct search for "${query}" failed. Trying fallback proxies...`, error);
  }

  // 2. Try proxy fallbacks
  const fallbackHosts = [
    'https://saavn.dev',
    'https://saavn.sumit.co',
    'https://jiosaavn-api-beta.vercel.app'
  ];

  for (const host of fallbackHosts) {
    try {
      const response = await fetch(`${host}/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`);
      if (response.ok) {
        const payload = await response.json();
        const results = payload.data?.results || payload.data || payload.results;
        if (Array.isArray(results) && results.length > 0) {
          return results.map((song: any) => mapProxySaavnSong(song));
        }
      }
    } catch (err) {
      console.warn(`Fallback proxy ${host} search failed for "${query}":`, err);
    }
  }

  return [];
}

export async function fetchSaavnSongDetails(id: string): Promise<any | null> {
  // 1. Try direct fetch
  try {
    const response = await fetch(
      `https://www.jiosaavn.com/api.php?__call=song.getDetails&pids=${id}&_format=json&_marker=0&ctx=web6dot0`
    );

    if (response.ok) {
      const data = await response.json();
      if (data && data[id]) {
        return mapJioSaavnSong(data[id]);
      }
    }
  } catch (error) {
    console.warn(`Direct fetch for song "${id}" failed. Trying fallback proxies...`, error);
  }

  // 2. Try proxy fallbacks
  const fallbackHosts = [
    'https://saavn.dev',
    'https://saavn.sumit.co',
    'https://jiosaavn-api-beta.vercel.app'
  ];

  for (const host of fallbackHosts) {
    try {
      const response = await fetch(`${host}/api/songs?ids=${id}`);
      if (response.ok) {
        const payload = await response.json();
        const results = payload.data?.songs || payload.data || payload.results;
        if (Array.isArray(results) && results.length > 0) {
          return mapProxySaavnSong(results[0]);
        } else if (results && !Array.isArray(results) && results.id) {
           return mapProxySaavnSong(results);
        }
      }
    } catch (err) {
      console.warn(`Fallback proxy ${host} song fetch failed for "${id}":`, err);
    }
  }

  return null;
}
