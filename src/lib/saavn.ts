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
    streamUrl_96 = decryptedUrl.replace('_96.mp4', '_96.mp4');
    streamUrl_160 = decryptedUrl.replace('_96.mp4', '_160.mp4');
    streamUrl_320 = decryptedUrl.replace('_96.mp4', '_320.mp4');
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

export async function fetchSaavnPlaylist(listId: string) {
  try {
    const response = await fetch(
      `https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=${listId}&_format=json&_marker=0&ctx=web6dot0`
    );

    if (!response.ok) {
      throw new Error(`JioSaavn API playlist fetch failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!data.songs || !Array.isArray(data.songs)) {
      return [];
    }

    return data.songs.map((song: JioSaavnSong) => mapJioSaavnSong(song));
  } catch (error) {
    console.error(`Error fetching playlist ${listId}:`, error);
    return [];
  }
}
