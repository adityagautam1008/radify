import { create } from 'zustand';

export type MusicSource = 'saavn' | 'youtube' | 'demo';

export interface Song {
  id: string;
  title: string;
  album: string;
  year: string;
  duration: number;
  artist: string;
  image: string;
  source: MusicSource;
  streamUrl?: string;
  previewUrl?: string;
  embedUrl?: string;
  externalUrl?: string;
}

export interface Playlist {
  id: string;
  name: string;
  songs: Song[];
  createdAt: number;
}

export type ThemeMood = 'emerald' | 'sunset' | 'ocean' | 'amethyst' | 'cyberpunk';

export interface LibraryBackupData {
  likedSongs?: Song[];
  playlists?: Playlist[];
  recentSongs?: Song[];
  downloadedSongs?: Song[];
  theme?: ThemeMood;
}

interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  queue: Song[];
  currentIndex: number;
  volume: number;
  currentTime: number;
  duration: number;
  likedSongs: Song[];
  playlists: Playlist[];
  recentSongs: Song[];
  downloadedSongs: Song[];
  theme: ThemeMood;
  setSong: (song: Song, queue?: Song[]) => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (volume: number) => void;
  setTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setQueue: (queue: Song[], currentSong?: Song | null) => void;
  moveQueueSong: (songId: string, direction: -1 | 1) => void;
  moveLikedSong: (songId: string, direction: -1 | 1) => void;
  movePlaylistSong: (playlistId: string, songId: string, direction: -1 | 1) => void;
  toggleLike: (song: Song) => void;
  createPlaylist: (name: string) => void;
  addSongToPlaylist: (playlistId: string, song: Song) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  deletePlaylist: (playlistId: string) => void;
  addDownloadedSong: (song: Song) => void;
  removeDownloadedSong: (songId: string) => void;
  setTheme: (theme: ThemeMood) => void;
  importLibrary: (data: LibraryBackupData) => void;
  loadLibrary: () => void;
}

const readJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
};

const moveItem = <T extends { id: string }>(items: T[], itemId: string, direction: -1 | 1) => {
  const index = items.findIndex((item) => item.id === itemId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  queue: [],
  currentIndex: -1,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  likedSongs: [],
  playlists: [],
  recentSongs: [],
  downloadedSongs: [],
  theme: 'emerald',

  setSong: (song, queue = []) => {
    const nextQueue = queue.length ? queue : [song];
    const currentIndex = Math.max(0, nextQueue.findIndex((item) => item.id === song.id));
    const recentSongs = [song, ...get().recentSongs.filter((item) => item.id !== song.id)].slice(0, 16);
    const isSameSong = get().currentSong?.id === song.id;

    writeJson('adify_recent_songs', recentSongs);

    if (typeof window !== 'undefined' && (window as any).Android) {
      (window as any).Android.onTrackChanged(song.title, song.artist, song.image);
      (window as any).Android.onPlaybackStateChanged(true, isSameSong ? get().currentTime : 0, isSameSong ? get().duration || song.duration || 0 : song.duration || 0);
    }

    set({
      currentSong: song,
      queue: nextQueue,
      currentIndex,
      isPlaying: true,
      currentTime: isSameSong ? get().currentTime : 0,
      duration: isSameSong ? get().duration || song.duration || 0 : song.duration || 0,
      recentSongs,
    });
  },

  play: () => {
    if (typeof window !== 'undefined' && (window as any).Android) {
      (window as any).Android.onPlaybackStateChanged(true, get().currentTime, get().duration);
    }
    set({ isPlaying: true });
  },
  pause: () => {
    if (typeof window !== 'undefined' && (window as any).Android) {
      (window as any).Android.onPlaybackStateChanged(false, get().currentTime, get().duration);
    }
    set({ isPlaying: false });
  },

  next: () => {
    const { queue, currentIndex, setSong } = get();
    if (!queue.length) return;
    setSong(queue[(currentIndex + 1) % queue.length], queue);
  },

  prev: () => {
    const { queue, currentIndex, setSong } = get();
    if (!queue.length) return;
    setSong(queue[(currentIndex - 1 + queue.length) % queue.length], queue);
  },

  setVolume: (volume) => set({ volume }),
  setTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setQueue: (queue, currentSong) => {
    const activeSong = currentSong || get().currentSong;
    set({
      queue,
      currentIndex: activeSong ? Math.max(0, queue.findIndex((song) => song.id === activeSong.id)) : -1,
    });
  },

  moveQueueSong: (songId, direction) => {
    const queue = moveItem(get().queue, songId, direction);
    const currentSong = get().currentSong;
    set({
      queue,
      currentIndex: currentSong ? Math.max(0, queue.findIndex((song) => song.id === currentSong.id)) : -1,
    });
  },

  moveLikedSong: (songId, direction) => {
    const likedSongs = moveItem(get().likedSongs, songId, direction);
    writeJson('adify_liked_songs', likedSongs);
    set({ likedSongs });
  },

  movePlaylistSong: (playlistId, songId, direction) => {
    const playlists = get().playlists.map((playlist) => (
      playlist.id === playlistId
        ? { ...playlist, songs: moveItem(playlist.songs, songId, direction) }
        : playlist
    ));
    writeJson('adify_playlists', playlists);
    set({ playlists });
  },

  toggleLike: (song) => {
    const exists = get().likedSongs.some((item) => item.id === song.id);
    const likedSongs = exists
      ? get().likedSongs.filter((item) => item.id !== song.id)
      : [song, ...get().likedSongs];
    writeJson('adify_liked_songs', likedSongs);
    set({ likedSongs });
  },

  createPlaylist: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const playlists = [
      ...get().playlists,
      { id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36), name: trimmed, songs: [], createdAt: Date.now() },
    ];
    writeJson('adify_playlists', playlists);
    set({ playlists });
  },

  addSongToPlaylist: (playlistId, song) => {
    const playlists = get().playlists.map((playlist) => {
      if (playlist.id !== playlistId || playlist.songs.some((item) => item.id === song.id)) return playlist;
      return { ...playlist, songs: [...playlist.songs, song] };
    });
    writeJson('adify_playlists', playlists);
    set({ playlists });
  },

  removeSongFromPlaylist: (playlistId, songId) => {
    const playlists = get().playlists.map((playlist) => (
      playlist.id === playlistId
        ? { ...playlist, songs: playlist.songs.filter((song) => song.id !== songId) }
        : playlist
    ));
    writeJson('adify_playlists', playlists);
    set({ playlists });
  },

  deletePlaylist: (playlistId) => {
    const playlists = get().playlists.filter((playlist) => playlist.id !== playlistId);
    writeJson('adify_playlists', playlists);
    set({ playlists });
  },

  addDownloadedSong: (song) => {
    const downloadedSongs = [song, ...get().downloadedSongs.filter((item) => item.id !== song.id)];
    writeJson('adify_downloaded_songs', downloadedSongs);
    set({ downloadedSongs });
  },

  removeDownloadedSong: (songId) => {
    const downloadedSongs = get().downloadedSongs.filter((song) => song.id !== songId);
    writeJson('adify_downloaded_songs', downloadedSongs);
    set({ downloadedSongs });
  },

  setTheme: (theme) => {
    writeJson('adify_theme', theme);
    set({ theme });
  },

  importLibrary: (data) => {
    const likedSongs = data.likedSongs || [];
    const playlists = data.playlists || [];
    const recentSongs = data.recentSongs || [];
    const downloadedSongs = data.downloadedSongs || [];
    const theme = data.theme || 'emerald';

    writeJson('adify_liked_songs', likedSongs);
    writeJson('adify_playlists', playlists);
    writeJson('adify_recent_songs', recentSongs);
    writeJson('adify_downloaded_songs', downloadedSongs);
    writeJson('adify_theme', theme);
    set({ likedSongs, playlists, recentSongs, downloadedSongs, theme });
  },

  loadLibrary: () => set({
    likedSongs: readJson<Song[]>('adify_liked_songs', []),
    playlists: readJson<Playlist[]>('adify_playlists', []),
    recentSongs: readJson<Song[]>('adify_recent_songs', []),
    downloadedSongs: readJson<Song[]>('adify_downloaded_songs', []),
    theme: readJson<ThemeMood>('adify_theme', 'emerald'),
  }),
}));
