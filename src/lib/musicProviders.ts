import { Song } from '@/store/playerStore';

type SaavnImage = {
  quality?: string;
  url?: string;
};

type SaavnDownload = {
  quality?: string;
  url?: string;
};

type SaavnSong = {
  id: string;
  name?: string;
  title?: string;
  year?: string;
  duration?: string | number;
  url?: string;
  album?: {
    name?: string;
  } | string;
  artists?: {
    primary?: Array<{ name?: string }>;
    all?: Array<{ name?: string }>;
  };
  primaryArtists?: Array<{ name?: string }> | string;
  image?: SaavnImage[] | string;
  downloadUrl?: SaavnDownload[];
};

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: {
      high?: { url?: string };
      medium?: { url?: string };
    };
  };
};

type YouTubeVideoItem = {
  id?: string;
  contentDetails?: {
    duration?: string;
  };
};

export const fallbackSongs: Song[] = [
  {
    id: 'fallback-diljit',
    title: 'Lover',
    artist: 'Diljit Dosanjh',
    album: 'MoonChild Era',
    year: '2021',
    duration: 190,
    image: 'https://i.ytimg.com/vi/0go2nfVXFgA/hqdefault.jpg',
    source: 'youtube',
    streamUrl: '/api/youtube/stream/0go2nfVXFgA',
    embedUrl: 'https://www.youtube.com/embed/0go2nfVXFgA',
    externalUrl: 'https://www.youtube.com/watch?v=0go2nfVXFgA',
  },
  {
    id: 'fallback-apdhillon',
    title: 'Excuses',
    artist: 'AP Dhillon, Gurinder Gill, Intense',
    album: 'Excuses',
    year: '2020',
    duration: 176,
    image: 'https://i.ytimg.com/vi/vX2cDW8LUWk/hqdefault.jpg',
    source: 'youtube',
    streamUrl: '/api/youtube/stream/vX2cDW8LUWk',
    embedUrl: 'https://www.youtube.com/embed/vX2cDW8LUWk',
    externalUrl: 'https://www.youtube.com/watch?v=vX2cDW8LUWk',
  },
  {
    id: 'fallback-arijit',
    title: 'Kesariya',
    artist: 'Pritam, Arijit Singh',
    album: 'Brahmastra',
    year: '2022',
    duration: 268,
    image: 'https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg',
    source: 'youtube',
    streamUrl: '/api/youtube/stream/BddP6PYo2gs',
    embedUrl: 'https://www.youtube.com/embed/BddP6PYo2gs',
    externalUrl: 'https://www.youtube.com/watch?v=BddP6PYo2gs',
  },
];

const cleanText = (value = '') => (
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
);

const parseYouTubeDuration = (value = '') => {
  const match = value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const [, days = '0', hours = '0', minutes = '0', seconds = '0'] = match;
  return (
    Number.parseInt(days, 10) * 86400 +
    Number.parseInt(hours, 10) * 3600 +
    Number.parseInt(minutes, 10) * 60 +
    Number.parseInt(seconds, 10)
  );
};

const imageUrl = (image?: SaavnSong['image']) => {
  if (typeof image === 'string') {
    return image.replace('150x150', '500x500').replace('50x50', '500x500');
  }
  if (!Array.isArray(image)) return '';
  return image.find((item) => item.quality === '500x500')?.url || image.at(-1)?.url || '';
};

const streamUrl = (downloads?: SaavnDownload[]) => {
  if (!Array.isArray(downloads)) return '';
  return (
    downloads.find((item) => item.quality === '320kbps')?.url ||
    downloads.find((item) => item.quality === '160kbps')?.url ||
    downloads.find((item) => item.quality === '96kbps')?.url ||
    downloads.at(-1)?.url ||
    ''
  );
};

const artistName = (song: SaavnSong) => {
  if (Array.isArray(song.artists?.primary) && song.artists.primary.length) {
    return song.artists.primary.map((artist) => artist.name).filter(Boolean).join(', ');
  }
  if (Array.isArray(song.artists?.all) && song.artists.all.length) {
    return song.artists.all.map((artist) => artist.name).filter(Boolean).join(', ');
  }
  if (Array.isArray(song.primaryArtists)) {
    return song.primaryArtists.map((artist) => artist.name).filter(Boolean).join(', ');
  }
  if (typeof song.primaryArtists === 'string') return song.primaryArtists;
  return 'Unknown Artist';
};

const mapSaavnSong = (song: SaavnSong): Song => ({
  id: `saavn-${song.id}`,
  title: cleanText(song.name || song.title || 'Unknown Song'),
  artist: cleanText(artistName(song)),
  album: cleanText(typeof song.album === 'string' ? song.album : song.album?.name || 'JioSaavn'),
  year: song.year || '',
  duration: typeof song.duration === 'string' ? Number.parseInt(song.duration, 10) || 0 : song.duration || 0,
  image: imageUrl(song.image),
  source: 'saavn',
  streamUrl: streamUrl(song.downloadUrl),
  externalUrl: song.url,
});

export async function searchSaavn(query: string, limit = 12): Promise<Song[]> {
  const hosts = [
    'https://saavn.sumit.co',
    'https://jiosaavn-api-beta.vercel.app',
  ];

  for (const host of hosts) {
    try {
      const response = await fetch(
        `${host}/api/search/songs?${new URLSearchParams({ query, limit: String(limit) })}`,
        { next: { revalidate: 300 } }
      );
      if (!response.ok) continue;

      const payload = await response.json();
      const results = payload.data?.results || payload.data || payload.results;
      if (Array.isArray(results) && results.length) {
        return results.map(mapSaavnSong).filter((song) => song.streamUrl);
      }
    } catch (error) {
      console.warn(`Saavn provider failed for ${host}`, error);
    }
  }

  return [];
}

export async function searchYouTubeMusic(query: string, limit = 8): Promise<Song[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${new URLSearchParams({
      key: apiKey,
      part: 'snippet',
      q: `${query} official audio`,
      type: 'video',
      maxResults: String(limit),
      videoEmbeddable: 'true',
      safeSearch: 'none',
    })}`,
    { next: { revalidate: 300 } }
  );

  if (!response.ok) return [];
  const data = await response.json();
  const videoIds = ((data.items || []) as YouTubeSearchItem[])
    .map((item) => item.id?.videoId)
    .filter(Boolean) as string[];
  const durations = new Map<string, number>();

  if (videoIds.length) {
    const detailsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({
        key: apiKey,
        part: 'contentDetails',
        id: videoIds.join(','),
      })}`,
      { next: { revalidate: 300 } }
    );

    if (detailsResponse.ok) {
      const detailsData = await detailsResponse.json();
      ((detailsData.items || []) as YouTubeVideoItem[]).forEach((item) => {
        if (!item.id) return;
        durations.set(item.id, parseYouTubeDuration(item.contentDetails?.duration));
      });
    }
  }

  return ((data.items || []) as YouTubeSearchItem[]).flatMap((item): Song[] => {
    const videoId = item.id?.videoId;
    if (!videoId) return [];
    return [{
      id: `youtube-${videoId}`,
      title: cleanText(item.snippet?.title || 'Untitled video'),
      artist: item.snippet?.channelTitle || 'YouTube Music',
      album: 'Official YouTube Upload',
      year: item.snippet?.publishedAt?.slice(0, 4) || '',
      duration: durations.get(videoId) || 0,
      image: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || '',
      source: 'youtube',
      streamUrl: `/api/youtube/stream/${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    }];
  });
}

export function getFallbackSongs(query = '') {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return fallbackSongs;
  const filtered = fallbackSongs.filter((song) => (
    `${song.title} ${song.artist} ${song.album}`.toLowerCase().includes(normalized)
  ));
  return filtered.length ? filtered : fallbackSongs;
}

const uniqueSongs = (songs: Song[]) => {
  const seen = new Set<string>();
  return songs.filter((song) => {
    const key = song.externalUrl || song.streamUrl || song.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export async function searchAllProviders(query: string): Promise<{ songs: Song[]; providers: string[] }> {
  const [youtubeResults, saavn] = await Promise.all([
    searchYouTubeMusic(query, 8).catch(() => []),
    searchSaavn(query, 18).catch(() => []),
  ]);
  const youtube = youtubeResults.length ? youtubeResults : getFallbackSongs(query);
  const songs = uniqueSongs([...youtube, ...saavn]);
  const providers = [
    youtubeResults.length ? 'YouTube official videos' : 'YouTube recommendations',
    saavn.length ? 'Saavn audio streaming' : null,
    songs.length ? null : 'Fallback catalog',
  ].filter(Boolean) as string[];

  return {
    songs: songs.length ? songs : getFallbackSongs(query),
    providers,
  };
}

export async function getFeaturedSongs() {
  const [youtubeResults, saavn] = await Promise.all([
    searchYouTubeMusic('trending hindi songs', 8).catch(() => []),
    searchSaavn('trending hindi songs', 10).catch(() => []),
  ]);
  const youtube = youtubeResults.length ? youtubeResults : getFallbackSongs();
  const featured = uniqueSongs([...youtube, ...saavn]);
  return featured.length ? featured : getFallbackSongs();
}
