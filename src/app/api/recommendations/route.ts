import { NextResponse } from 'next/server';
import { mapJioSaavnSong, fetchSaavnSongsWithFallback } from '@/lib/saavn';

async function fetchSongsByArtist(artist: string): Promise<any[]> {
  return fetchSaavnSongsWithFallback(artist, 8);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const artistsQuery = searchParams.get('artists');

  try {
    if (!artistsQuery) {
      // COLD START FALLBACK: Fetch some popular tracks across different languages
      const defaultSearches = ['Arijit Singh', 'Karan Aujla', 'Diljit Dosanjh', 'Amit Saini Rohtakiya'];
      const randomSearch = defaultSearches[Math.floor(Math.random() * defaultSearches.length)];
      const songs = await fetchSongsByArtist(randomSearch);
      return NextResponse.json({ songs: songs.slice(0, 15) });
    }

    const artists = artistsQuery
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean)
      .slice(0, 3); // Max 3 artists to query in parallel to keep it highly responsive

    if (artists.length === 0) {
      return NextResponse.json({ songs: [] });
    }

    // Fetch songs for each artist in parallel
    const songLists = await Promise.all(artists.map((artist) => fetchSongsByArtist(artist)));
    
    // Flatten and shuffle results
    let mergedSongs: any[] = [];
    
    // Interleave songs from different artists to create a balanced mix
    const maxSongs = Math.max(...songLists.map(list => list.length));
    for (let i = 0; i < maxSongs; i++) {
      for (const list of songLists) {
        if (list[i]) {
          mergedSongs.push(list[i]);
        }
      }
    }

    // Deduplicate songs by ID
    const seenIds = new Set<string>();
    const uniqueSongs = mergedSongs.filter((song) => {
      if (seenIds.has(song.id)) {
        return false;
      }
      seenIds.add(song.id);
      return true;
    });

    // Shuffle the unique list for variance
    const shuffledSongs = uniqueSongs.sort(() => Math.random() - 0.5);

    return NextResponse.json({ songs: shuffledSongs.slice(0, 15) });
  } catch (error: any) {
    console.error('Recommendations API failed:', error);
    return NextResponse.json({ songs: [] });
  }
}
