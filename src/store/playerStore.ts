import { create } from 'zustand';

export interface Song {
  id: string;
  title: string;
  album: string;
  year: string;
  duration: number;
  artist: string;
  image: string;
  streamUrl: string;
  streamUrl_low?: string;
  streamUrl_med?: string;
  streamUrl_high?: string;
  source?: 'saavn' | 'youtube';
}

export interface Playlist {
  id: string;
  name: string;
  songs: Song[];
  createdAt: number;
}

interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  queue: Song[];
  currentIndex: number;
  volume: number;
  likedSongs: Song[];
  currentTime: number;
  duration: number;
  shuffle: boolean;
  sleepTimerMinutes: number | null;  // null = off
  sleepTimerEnd: number | null;      // epoch ms when timer expires
  
  // Custom Personalization States
  recentSongs: Song[];
  playlists: Playlist[];

  // Actions
  play: () => void;
  pause: () => void;
  setSong: (song: Song, queue?: Song[]) => void;
  setQueue: (queue: Song[]) => void;
  next: () => void;
  prev: () => void;
  setVolume: (volume: number) => void;
  toggleLike: (song: Song) => void;
  setTime: (time: number) => void;
  setDuration: (duration: number) => void;
  loadLikedSongs: () => void;
  toggleShuffle: () => void;
  setSleepTimer: (minutes: number | null) => void;

  moveQueueSong: (fromIndex: number, toIndex: number) => void;
  removeQueueSong: (index: number) => void;

  // Custom Personalization Actions
  addRecentSong: (song: Song) => void;
  createPlaylist: (name: string) => void;
  deletePlaylist: (playlistId: string) => void;
  addSongToPlaylist: (playlistId: string, song: Song) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  loadHistoryAndPlaylists: () => void;
  setLikedSongs: (songs: Song[]) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  queue: [],
  currentIndex: -1,
  volume: 0.8,
  likedSongs: [],
  currentTime: 0,
  duration: 0,
  shuffle: false,
  sleepTimerMinutes: null,
  sleepTimerEnd: null,

  // Initial State
  recentSongs: [],
  playlists: [],

  play: () => {
    if (typeof window !== 'undefined' && (window as any).__adifyBlessAudio) {
      (window as any).__adifyBlessAudio();
    }
    set({ isPlaying: true });
  },
  
  pause: () => set({ isPlaying: false }),
  
  setSong: (song, queue = []) => {
    if (typeof window !== 'undefined' && (window as any).__adifyBlessAudio) {
      (window as any).__adifyBlessAudio();
    }
    const activeQueue = queue.length > 0 ? queue : [song];
    const index = activeQueue.findIndex((s) => s.id === song.id);
    
    // Automatically add song to history on play
    get().addRecentSong(song);

    set({
      currentSong: song,
      queue: activeQueue,
      currentIndex: index !== -1 ? index : 0,
      isPlaying: true,
      currentTime: 0,
    });
  },

  setQueue: (queue) => set({ queue }),

  next: () => {
    if (typeof window !== 'undefined' && (window as any).__adifyBlessAudio) {
      (window as any).__adifyBlessAudio();
    }
    const { queue, currentIndex, shuffle } = get();
    if (queue.length === 0) return;
    
    let nextIndex: number;
    if (shuffle) {
      if (queue.length === 1) {
        nextIndex = 0;
      } else {
        do {
          nextIndex = Math.floor(Math.random() * queue.length);
        } while (nextIndex === currentIndex);
      }
    } else {
      nextIndex = (currentIndex + 1) % queue.length;
    }

    // Automatically add next song to history
    get().addRecentSong(queue[nextIndex]);

    set({
      currentSong: queue[nextIndex],
      currentIndex: nextIndex,
      isPlaying: true,
      currentTime: 0,
    });
  },

  prev: () => {
    if (typeof window !== 'undefined' && (window as any).__adifyBlessAudio) {
      (window as any).__adifyBlessAudio();
    }
    const { queue, currentIndex } = get();
    if (queue.length === 0) return;
    
    const prevIndex = currentIndex - 1 < 0 ? queue.length - 1 : currentIndex - 1;
    
    // Automatically add previous song to history
    get().addRecentSong(queue[prevIndex]);

    set({
      currentSong: queue[prevIndex],
      currentIndex: prevIndex,
      isPlaying: true,
      currentTime: 0,
    });
  },

  setVolume: (volume) => set({ volume }),

  toggleLike: (song) => {
    const { likedSongs } = get();
    const isLiked = likedSongs.some((s) => s.id === song.id);
    let updated: Song[];
    
    if (isLiked) {
      updated = likedSongs.filter((s) => s.id !== song.id);
    } else {
      updated = [...likedSongs, song];
    }
    
    localStorage.setItem('adify_liked_songs', JSON.stringify(updated));
    set({ likedSongs: updated });
  },

  setTime: (currentTime) => set({ currentTime }),
  
  setDuration: (duration) => set({ duration }),

  loadLikedSongs: () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('adify_liked_songs');
      if (saved) {
        try {
          set({ likedSongs: JSON.parse(saved) });
        } catch (e) {
          console.error('Failed to parse liked songs', e);
        }
      }
    }
  },

  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),

  setSleepTimer: (minutes) => {
    if (minutes === null) {
      set({ sleepTimerMinutes: null, sleepTimerEnd: null });
    } else {
      set({
        sleepTimerMinutes: minutes,
        sleepTimerEnd: Date.now() + minutes * 60 * 1000,
      });
    }
  },

  moveQueueSong: (fromIndex, toIndex) => {
    const { queue, currentIndex } = get();
    if (fromIndex < 0 || fromIndex >= queue.length || toIndex < 0 || toIndex >= queue.length) return;

    const updated = [...queue];
    const [movedSong] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedSong);

    let newCurrentIndex = currentIndex;
    if (currentIndex === fromIndex) {
      newCurrentIndex = toIndex;
    } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
      newCurrentIndex = currentIndex - 1;
    } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
      newCurrentIndex = currentIndex + 1;
    }

    set({ queue: updated, currentIndex: newCurrentIndex });
  },

  removeQueueSong: (index) => {
    const { queue, currentIndex, currentSong } = get();
    if (index < 0 || index >= queue.length) return;

    const updated = queue.filter((_, idx) => idx !== index);
    
    let newCurrentIndex = currentIndex;
    let newCurrentSong = currentSong;
    
    if (currentIndex === index) {
      if (updated.length > 0) {
        newCurrentIndex = index >= updated.length ? 0 : index;
        newCurrentSong = updated[newCurrentIndex];
      } else {
        newCurrentIndex = -1;
        newCurrentSong = null;
      }
    } else if (index < currentIndex) {
      newCurrentIndex = currentIndex - 1;
    }

    set({ 
      queue: updated, 
      currentIndex: newCurrentIndex,
      currentSong: newCurrentSong,
      isPlaying: updated.length > 0 ? get().isPlaying : false 
    });
  },

  // HISTORY ACTIONS
  addRecentSong: (song) => {
    const { recentSongs } = get();
    // Filter out if song already exists in history, then prepend it to top
    const filtered = recentSongs.filter((s) => s.id !== song.id);
    const updated = [song, ...filtered].slice(0, 25); // Limit history to last 25 songs
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('adify_recent_songs', JSON.stringify(updated));
    }
    set({ recentSongs: updated });
  },

  // PLAYLIST ACTIONS
  createPlaylist: (name) => {
    const { playlists } = get();
    const newPlaylist: Playlist = {
      id: `playlist-${Date.now()}`,
      name,
      songs: [],
      createdAt: Date.now(),
    };
    const updated = [...playlists, newPlaylist];
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('adify_playlists', JSON.stringify(updated));
    }
    set({ playlists: updated });
  },

  deletePlaylist: (playlistId) => {
    const { playlists } = get();
    const updated = playlists.filter((p) => p.id !== playlistId);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('adify_playlists', JSON.stringify(updated));
    }
    set({ playlists: updated });
  },

  addSongToPlaylist: (playlistId, song) => {
    const { playlists } = get();
    const updated = playlists.map((p) => {
      if (p.id === playlistId) {
        // Prevent duplicate songs in playlist
        const exists = p.songs.some((s) => s.id === song.id);
        if (exists) return p;
        return {
          ...p,
          songs: [...p.songs, song],
        };
      }
      return p;
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem('adify_playlists', JSON.stringify(updated));
    }
    set({ playlists: updated });
  },

  removeSongFromPlaylist: (playlistId, songId) => {
    const { playlists } = get();
    const updated = playlists.map((p) => {
      if (p.id === playlistId) {
        return {
          ...p,
          songs: p.songs.filter((s) => s.id !== songId),
        };
      }
      return p;
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem('adify_playlists', JSON.stringify(updated));
    }
    set({ playlists: updated });
  },

  loadHistoryAndPlaylists: () => {
    if (typeof window !== 'undefined') {
      const savedHistory = localStorage.getItem('adify_recent_songs');
      const savedPlaylists = localStorage.getItem('adify_playlists');

      try {
        const recentSongs = savedHistory ? JSON.parse(savedHistory) : [];
        const playlists = savedPlaylists ? JSON.parse(savedPlaylists) : [];
        set({ recentSongs, playlists });
      } catch (e) {
        console.error('Failed to parse history or playlists', e);
      }
    }
  },

  setLikedSongs: (songs) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('adify_liked_songs', JSON.stringify(songs));
    }
    set({ likedSongs: songs });
  },
}));
