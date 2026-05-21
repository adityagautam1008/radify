import { NextResponse } from 'next/server';
import { fetchSaavnPlaylist, mapJioSaavnSong } from '@/lib/saavn';

const PLAYLIST_MAP: Record<string, string> = {
  hindi: '1134543272',
  punjabi: '1134543511',
  haryanvi: '1134770917',
  english: '1134543781',
  telugu: '1134771217',
  tamil: '1134771092',
  bhojpuri: '1134544498',
  kannada: '1134771146',
  malayalam: '1134771261',
  marathi: '1134771046'
};

interface CacheEntry {
  songs: any[];
  timestamp: number;
}

// Global server-side in-memory cache
const featuredCache: Record<string, CacheEntry> = {};
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const langsParam = searchParams.get('langs');
  
  // Default to hindi, punjabi, haryanvi if not specified.
  // Allow custom languages to be requested (do not filter out using PLAYLIST_MAP)
  const requestedLangs = langsParam
    ? langsParam.split(',').map((l) => l.trim().toLowerCase()).filter(Boolean)
    : ['hindi', 'punjabi', 'haryanvi'];

  if (requestedLangs.length === 0) {
    return NextResponse.json({ error: 'No valid languages requested' }, { status: 400 });
  }

  const now = Date.now();
  const responseData: Record<string, any[]> = {};

  try {
    // Resolve all requested languages in parallel
    await Promise.all(
      requestedLangs.map(async (lang) => {
        const cached = featuredCache[lang];
        if (cached && now - cached.timestamp < CACHE_DURATION) {
          responseData[lang] = cached.songs;
          return;
        }

        const playlistId = PLAYLIST_MAP[lang];
        let songs: any[] = [];

        if (playlistId) {
          // Fetch from official superhits playlist
          songs = await fetchSaavnPlaylist(playlistId);
        } else {
          // Dynamic query search for custom regional or global languages!
          try {
            // Search for "[language] hits" or "[language] songs"
            const query = `${lang} hits`;
            const searchResponse = await fetch(
              `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(
                query
              )}&_format=json&_marker=0&ctx=web6dot0&n=20`
            );
            if (searchResponse.ok) {
              const data = await searchResponse.json();
              if (data.results && Array.isArray(data.results)) {
                songs = data.results.map((song: any) => mapJioSaavnSong(song));
              }
            }
          } catch (searchErr) {
            console.error(`Dynamic search failed for custom language "${lang}":`, searchErr);
          }
        }
        
        // Limit to 20 songs per chart to keep payloads lightweight and speedy
        const slicedSongs = songs.slice(0, 20);
        
        featuredCache[lang] = {
          songs: slicedSongs,
          timestamp: now,
        };
        responseData[lang] = slicedSongs;
      })
    );

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Featured dynamic API failed:', error);
    
    // Return whatever cached data we have for safety
    const fallbackData: Record<string, any[]> = {};
    for (const lang of requestedLangs) {
      if (featuredCache[lang]) {
        fallbackData[lang] = featuredCache[lang].songs;
      }
    }

    if (Object.keys(fallbackData).length > 0) {
      return NextResponse.json(fallbackData);
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

