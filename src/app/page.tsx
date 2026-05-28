'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bot,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Download,
  ExternalLink,
  GripVertical,
  Heart,
  Home,
  Library,
  ListMusic,
  Loader2,
  Mic2,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  Settings,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  Palette,
} from 'lucide-react';
import AudioPlayer from '@/components/AudioPlayer';
import {
  downloadBlobFile,
  exportAdifyBackup,
  importAdifyBackup,
  removeOfflineAudio,
  saveOfflineAudio,
} from '@/lib/offlineLibrary';
import { fallbackSongs } from '@/lib/musicProviders';
import { Song, ThemeMood, usePlayerStore } from '@/store/playerStore';

type Tab = 'home' | 'search' | 'liked' | 'playlists' | 'downloads' | 'queue' | 'settings' | 'nowPlaying';

const quickSearches = ['Hindi hits', 'Punjabi workout', 'Arijit Singh', 'Global pop', 'Lo-fi coding'];

const themes: Array<{ id: ThemeMood; name: string; color: string }> = [
  { id: 'emerald', name: 'Emerald', color: '#22c55e' },
  { id: 'sunset', name: 'Sunset', color: '#f97316' },
  { id: 'ocean', name: 'Ocean', color: '#06b6d4' },
  { id: 'amethyst', name: 'Amethyst', color: '#8b5cf6' },
  { id: 'cyberpunk', name: 'Cyberpunk', color: '#ec4899' },
];

const sourceLabel: Record<Song['source'], string> = {
  saavn: 'Saavn',
  youtube: 'YouTube',
  demo: 'Preview',
};

const formatTime = (seconds: number) => {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

function SourcePill({ source }: { source: Song['source'] }) {
  const className = source === 'saavn'
    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
    : 'border-sky-400/25 bg-sky-400/10 text-sky-300';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${className}`}>
      {sourceLabel[source]}
    </span>
  );
}

function TrackRow({
  song,
  songs,
  index,
  onAdd,
  onDownload,
  isDownloaded,
  isDownloading,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  song: Song;
  songs: Song[];
  index: number;
  onAdd?: (song: Song) => void;
  onDownload?: (song: Song) => void;
  isDownloaded?: boolean;
  isDownloading?: boolean;
  onMoveUp?: (song: Song) => void;
  onMoveDown?: (song: Song) => void;
  onRemove?: (song: Song) => void;
}) {
  const { currentSong, isPlaying, setSong, pause, toggleLike, likedSongs } = usePlayerStore();
  const active = currentSong?.id === song.id;
  const liked = likedSongs.some((item) => item.id === song.id);

  return (
    <div className={`track-row group grid grid-cols-[32px_52px_minmax(0,1fr)] items-center gap-3 rounded-xl border p-2 transition sm:grid-cols-[32px_52px_minmax(0,1fr)_auto] ${active ? 'border-emerald-400/25 bg-emerald-400/10' : 'border-transparent hover:border-white/10 hover:bg-white/[0.055]'}`}>
      <button
        className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
        onClick={() => (active && isPlaying ? pause() : setSong(song, songs))}
        title={active && isPlaying ? 'Pause' : 'Play'}
      >
        {active && isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
      </button>
      <button className="relative h-13 w-13 overflow-hidden rounded-lg bg-zinc-900" onClick={() => setSong(song, songs)}>
        {song.image ? (
          <img src={song.image} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-zinc-600"><Music2 size={20} /></span>
        )}
      </button>
      <button className="min-w-0 text-left" onClick={() => setSong(song, songs)}>
        <div className={`truncate text-sm font-black ${active ? 'text-emerald-300' : 'text-white'}`}>{song.title}</div>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-zinc-400">
          <span className="truncate">{song.artist}</span>
          <span className="text-zinc-700">#{index + 1}</span>
          <SourcePill source={song.source} />
        </div>
      </button>
      <div className="col-span-3 flex items-center justify-end gap-1 border-t border-white/6 pt-2 sm:col-span-1 sm:border-t-0 sm:pt-0">
        <span className="hidden w-16 text-right text-xs font-bold text-zinc-500 sm:block">{song.duration ? formatTime(song.duration) : 'Live'}</span>
        {(onMoveUp || onMoveDown) && (
          <span className="flex items-center gap-0.5">
            <button
              onClick={() => onMoveUp?.(song)}
              className="rounded-full p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
              disabled={!onMoveUp || index === 0}
              title="Move up"
            >
              <ArrowUp size={14} />
            </button>
            <button
              onClick={() => onMoveDown?.(song)}
              className="rounded-full p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white"
              disabled={!onMoveDown || index === songs.length - 1}
              title="Move down"
            >
              <ArrowDown size={14} />
            </button>
          </span>
        )}
        {onDownload && (
          <button
            onClick={() => onDownload(song)}
            disabled={isDownloaded || isDownloading}
            className="rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white disabled:opacity-45"
            title={isDownloaded ? 'Downloaded' : 'Download'}
          >
            {isDownloading ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
          </button>
        )}
        <button
          onClick={() => toggleLike(song)}
          className={`rounded-full border p-2 transition hover:bg-white/10 hover:text-emerald-300 ${liked ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/10 text-zinc-300'}`}
          title={liked ? 'Remove from liked' : 'Like'}
        >
          <Heart size={17} fill={liked ? 'currentColor' : 'none'} className={liked ? 'text-emerald-300' : ''} />
        </button>
        {onAdd && (
          <button
            onClick={() => onAdd(song)}
            className="rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            title="Add to playlist"
          >
            <Plus size={17} />
          </button>
        )}
        {onRemove && (
          <button
            onClick={() => onRemove(song)}
            className="rounded-full p-2 text-zinc-400 transition hover:bg-red-500/10 hover:text-red-300"
            title="Remove"
          >
            <Trash2 size={17} />
          </button>
        )}
      </div>
    </div>
  );
}

function TrackGrid({ songs }: { songs: Song[] }) {
  const { currentSong, isPlaying, setSong, pause } = usePlayerStore();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {songs.map((song) => {
        const active = currentSong?.id === song.id;
        return (
          <button
            key={song.id}
            onClick={() => (active && isPlaying ? pause() : setSong(song, songs))}
            className="group min-w-0 rounded-xl border border-white/5 bg-zinc-950/60 p-3 text-left transition hover:border-white/10 hover:bg-zinc-900/90"
          >
            <div className="relative aspect-square overflow-hidden rounded-lg bg-zinc-900">
              {song.image ? (
                <img src={song.image} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" decoding="async" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-zinc-600"><Disc3 size={36} /></span>
              )}
              <span className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-black opacity-0 shadow-lg shadow-emerald-400/20 transition group-hover:opacity-100">
                {active && isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              </span>
            </div>
            <div className="mt-3 truncate text-sm font-black text-white">{song.title}</div>
            <div className="mt-1 truncate text-xs font-semibold text-zinc-400">{song.artist}</div>
          </button>
        );
      })}
    </div>
  );
}

export default function AppHome() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [featuredSongs, setFeaturedSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<string[]>([]);
  const [syncMessage, setSyncMessage] = useState('');
  const [providerNote, setProviderNote] = useState('Curated official links');
  const [playlistName, setPlaylistName] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const {
    currentSong,
    isPlaying,
    volume,
    currentTime,
    duration,
    likedSongs,
    playlists,
    recentSongs,
    downloadedSongs,
    queue,
    theme,
    play,
    pause,
    next,
    prev,
    setVolume,
    setTime,
    setQueue,
    moveQueueSong,
    moveLikedSong,
    movePlaylistSong,
    createPlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    deletePlaylist,
    addDownloadedSong,
    removeDownloadedSong,
    setTheme,
    toggleLike,
    importLibrary,
    loadLibrary,
  } = usePlayerStore();

  useEffect(() => {
    loadLibrary();
    fetch('/api/featured')
      .then((response) => response.json())
      .then((data) => {
        setFeaturedSongs(data.songs || []);
        setProviderNote((data.providers || []).join(' + ') || 'Curated official links');
      })
      .catch(() => setFeaturedSongs([]));
  }, [loadLibrary]);

  // Register global back button handler for Android WebView.
  // Instead of webView.goBack() (which reloads the SPA and kills the audio player),
  // this navigates between in-app tabs. Returns true if handled, false to let Android minimize.
  useEffect(() => {
    (window as any).handleBackButton = () => {
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      return false; // Already on home — let Android minimize the app
    };
    return () => { delete (window as any).handleBackButton; };
  }, [activeTab]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId) || playlists[0],
    [playlists, selectedPlaylistId]
  );

  const runSearch = async (query = searchQuery) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setActiveTab('search');
    setLoading(true);
    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(trimmed)}`);
      const data = await response.json();
      setSearchResults(data.songs || []);
      setProviderNote((data.providers || []).join(' + ') || 'Official providers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    runSearch();
  };

  const handleCreatePlaylist = (event: FormEvent) => {
    event.preventDefault();
    createPlaylist(playlistName);
    setPlaylistName('');
    setActiveTab('playlists');
  };

  const addToPrimaryPlaylist = (song: Song) => {
    if (!playlists.length) {
      createPlaylist('My ADIFY Mix');
      setTimeout(() => {
        const latest = usePlayerStore.getState().playlists.at(-1);
        if (latest) addSongToPlaylist(latest.id, song);
      }, 0);
      return;
    }
    addSongToPlaylist((selectedPlaylist || playlists[0]).id, song);
  };

  const downloadedIds = useMemo(
    () => new Set(downloadedSongs.map((song) => song.id)),
    [downloadedSongs]
  );

  const downloadSong = async (song: Song) => {
    const audioUrl = song.streamUrl || song.previewUrl;
    if (!audioUrl || downloadingIds.includes(song.id) || downloadedIds.has(song.id)) return;

    setDownloadingIds((ids) => [...ids, song.id]);
    setSyncMessage(`Downloading ${song.title}...`);
    try {
      const response = await fetch(`/api/download?url=${encodeURIComponent(audioUrl)}`);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      await saveOfflineAudio(song.id, blob);
      addDownloadedSong(song);
      setSyncMessage(`Downloaded ${song.title}`);
    } catch {
      setSyncMessage(`Could not download ${song.title}`);
    } finally {
      setDownloadingIds((ids) => ids.filter((id) => id !== song.id));
    }
  };

  const removeDownload = async (song: Song) => {
    await removeOfflineAudio(song.id).catch(() => undefined);
    removeDownloadedSong(song.id);
    setSyncMessage(`Removed ${song.title} from downloads`);
  };

  const exportLibrary = async () => {
    setSyncMessage('Preparing ADIFY backup...');
    try {
      const blob = await exportAdifyBackup({
        version: 1,
        exportedAt: new Date().toISOString(),
        likedSongs,
        playlists,
        recentSongs,
        downloadedSongs,
        theme,
      });
      const filename = `adify-backup-${new Date().toISOString().slice(0, 10)}.zip`;

      if (typeof window !== 'undefined' && (window as any).Android && (window as any).Android.saveFile) {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          (window as any).Android.saveFile(filename, base64data);
          setSyncMessage('Backup exported to Downloads');
        };
      } else {
        downloadBlobFile(blob, filename);
        setSyncMessage('Backup exported');
      }
    } catch (e) {
      setSyncMessage('Failed to export backup');
    }
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setSyncMessage('Importing ADIFY backup...');
    try {
      const payload = await importAdifyBackup(file);
      importLibrary(payload);
      setSyncMessage('Backup imported');
    } catch {
      setSyncMessage('Import failed. Choose an ADIFY backup zip.');
    }
  };

  const displayDuration = currentSong?.streamUrl || currentSong?.previewUrl ? duration : currentSong?.duration || duration;
  const currentProgress = displayDuration ? Math.min(100, (currentTime / displayDuration) * 100) : 0;
  const homeSongs = featuredSongs.length ? featuredSongs : searchResults.length ? searchResults : fallbackSongs;
  const currentSongLiked = currentSong ? likedSongs.some((song) => song.id === currentSong.id) : false;
  const mobileTabs: Array<[Tab, typeof Home, string]> = [
    ['home', Home, 'Home'],
    ['search', Search, 'Search'],
    ['liked', Heart, 'Liked'],
    ['downloads', Download, 'Offline'],
    ['queue', ListMusic, 'Queue'],
    ['settings', Settings, 'Settings'],
  ];

  return (
    <div className={`theme-${theme} app-shell flex overflow-hidden bg-black text-white`}>
      <AudioPlayer />

      <aside className="hidden w-64 shrink-0 border-r border-white/6 bg-[#050606] p-6 md:flex md:flex-col">
        <button className="mb-9 flex items-center gap-3 text-left" onClick={() => setActiveTab('home')}>
          <img src="/logo.jpg" alt="ADIFY" className="h-10 w-10 rounded-xl border border-emerald-400/25 object-cover shadow-[0_0_24px_rgba(74,222,128,0.25)]" />
          <span className="text-3xl font-black tracking-tight text-emerald-400">ADIFY</span>
        </button>

        <nav className="space-y-2 text-sm font-black">
          {[
            ['home', Home, 'Home'],
            ['search', Search, 'Search'],
            ['liked', Heart, 'Liked Songs'],
            ['playlists', Library, 'Playlists'],
            ['downloads', Download, 'Downloads'],
            ['queue', ListMusic, 'Queue'],
            ['settings', Settings, 'Settings'],
          ].map(([id, Icon, label]) => (
            <button
              key={id as string}
              onClick={() => setActiveTab(id as Tab)}
              className={`flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left transition ${activeTab === id ? 'text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}
            >
              <Icon size={22} className={activeTab === id ? 'text-emerald-400' : ''} />
              {label as string}
            </button>
          ))}
        </nav>

        <div className="mt-9 flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">
            <span className="flex items-center gap-2"><ListMusic size={13} /> Playlists</span>
            <Plus size={14} />
          </div>
          <div className="min-h-0 space-y-1 overflow-y-auto pr-1">
            <button
              onClick={() => setActiveTab('liked')}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm font-bold text-zinc-300 transition hover:bg-white/5"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-emerald-400 text-white"><Heart size={15} fill="currentColor" /></span>
              Liked Songs ({likedSongs.length})
            </button>
            <button
              onClick={() => setActiveTab('downloads')}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm font-bold text-zinc-300 transition hover:bg-white/5"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-emerald-300"><Download size={15} /></span>
              Downloads ({downloadedSongs.length})
            </button>
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => {
                  setSelectedPlaylistId(playlist.id);
                  setActiveTab('playlists');
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm font-bold text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-emerald-300"><Music2 size={15} /></span>
                <span className="truncate">{playlist.name}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="mb-[244px] flex min-w-0 flex-1 flex-col md:mb-0">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/6 bg-[#0b0b0d]/80 px-4 backdrop-blur-xl sm:h-18 sm:px-8">
          <div className="flex items-center gap-2">
            <button className="hidden h-8 w-8 items-center justify-center rounded-full bg-black/50 text-zinc-400 md:flex" title="Back"><ChevronLeft size={18} /></button>
            <button className="hidden h-8 w-8 items-center justify-center rounded-full bg-black/50 text-zinc-400 md:flex" title="Forward"><ChevronRight size={18} /></button>
            <button onClick={() => setActiveTab('home')} className="flex items-center gap-2 md:hidden">
              <img src="/logo.jpg" alt="ADIFY" className="h-8 w-8 rounded-lg object-cover" />
              <span className="font-black text-emerald-400">ADIFY</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button className="inline-flex h-9 items-center gap-2 rounded-full bg-emerald-400 px-3 text-xs font-black text-black shadow-lg shadow-emerald-400/10 sm:px-4">
              <Bot size={14} /> AI Mix
            </button>
            <button className="hidden h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 text-xs font-black text-zinc-200 sm:inline-flex">
              <Mic2 size={14} /> Voice
            </button>
            <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-[11px] font-black uppercase tracking-wide text-emerald-300 lg:inline-flex">
              <Radio size={13} className="mr-2" /> {providerNote}
            </span>
            <button
              onClick={() => setActiveTab('settings')}
              className="h-9 w-9 rounded-full border border-white/10 bg-white/[0.04] text-zinc-400"
              title="Settings"
            >
              <Settings size={16} className="mx-auto" />
            </button>
          </div>
        </header>

        <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-5 sm:px-8 md:pb-36 md:pt-6">
          {(activeTab === 'home' || activeTab === 'search') && (
            <section className="relative mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#111318_0%,#07090d_58%,#04120a_100%)] p-4 shadow-2xl shadow-black/30 sm:mb-9 sm:p-8">
              <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 items-center justify-center opacity-20 lg:flex">
                <Music2 size={190} className="text-emerald-400" />
              </div>
              <div className="relative max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300 sm:mb-5 sm:tracking-[0.24em]">
                  <Sparkles size={12} /> Premium Music Center
                </div>
                <h1 className="max-w-2xl text-2xl font-black tracking-tight text-white sm:text-5xl">
                  Your Sound. Your Rules.
                </h1>
                <p className="mt-3 hidden max-w-2xl text-sm font-semibold leading-6 text-zinc-300 sm:mt-4 sm:block sm:text-base">
                  Search Saavn audio streams from one fast, ad-free ADIFY interface.
                </p>
                <form onSubmit={handleSubmit} className="mt-4 flex max-w-2xl gap-2 sm:mt-7">
                  <label className="relative min-w-0 flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={19} />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search songs, artists, albums..."
                      className="h-11 w-full rounded-full border border-white/10 bg-black/55 pl-11 pr-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/50 sm:h-12 sm:pl-12 sm:pr-4"
                    />
                  </label>
                  <button className="h-11 rounded-full bg-emerald-400 px-4 text-sm font-black text-black transition hover:bg-emerald-300 disabled:opacity-50 sm:h-12 sm:px-7" disabled={!searchQuery.trim() || loading}>
                    {loading ? <Loader2 size={18} className="animate-spin" /> : 'Search'}
                  </button>
                </form>
                <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 sm:mt-5 sm:flex-wrap sm:overflow-visible">
                  {quickSearches.map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        setSearchQuery(item);
                        runSearch(item);
                      }}
                      className="shrink-0 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-zinc-300 transition hover:border-emerald-400/30 hover:text-white"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'home' && (
            <div className="space-y-10">
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex min-w-0 items-center gap-2 text-2xl font-black tracking-tight sm:gap-3"><Music2 className="shrink-0 text-emerald-400" /> <span className="truncate">Trending Indian Hits</span></h2>
                  <button onClick={() => runSearch('top hits India')} className="text-xs font-black uppercase tracking-wide text-zinc-400 transition hover:text-white">Refresh</button>
                </div>
                <div className="hidden sm:block">
                  <TrackGrid songs={homeSongs} />
                </div>
                <div className="space-y-2 sm:hidden">
                  {homeSongs.map((song, index) => (
                    <TrackRow
                      key={`${song.id}-${index}`}
                      song={song}
                      songs={homeSongs}
                      index={index}
                      onAdd={addToPrimaryPlaylist}
                      onDownload={downloadSong}
                      isDownloaded={downloadedIds.has(song.id)}
                      isDownloading={downloadingIds.includes(song.id)}
                    />
                  ))}
                </div>
              </section>

              {recentSongs.length > 0 && (
                <section>
                  <h2 className="mb-4 text-2xl font-black tracking-tight">Recently Played</h2>
                  <div className="space-y-2">
                    {recentSongs.slice(0, 6).map((song, index) => (
                      <TrackRow
                        key={`${song.id}-${index}`}
                        song={song}
                        songs={recentSongs}
                        index={index}
                        onAdd={addToPrimaryPlaylist}
                        onDownload={downloadSong}
                        isDownloaded={downloadedIds.has(song.id)}
                        isDownloading={downloadingIds.includes(song.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === 'search' && (
            <section>
              <h2 className="mb-4 text-2xl font-black tracking-tight">Search Results</h2>
              {loading ? (
                <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-white/8 bg-zinc-950/50 text-zinc-400">
                  <Loader2 className="animate-spin text-emerald-400" size={34} />
                  <span className="text-xs font-black uppercase tracking-[0.2em]">Tuning to the frequency</span>
                </div>
              ) : searchResults.length ? (
                <div className="space-y-2">
                  {searchResults.map((song, index) => (
                    <TrackRow
                      key={`${song.id}-${index}`}
                      song={song}
                      songs={searchResults}
                      index={index}
                      onAdd={addToPrimaryPlaylist}
                      onDownload={downloadSong}
                      isDownloaded={downloadedIds.has(song.id)}
                      isDownloading={downloadingIds.includes(song.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-white/8 bg-zinc-950/50 text-center text-zinc-500">
                  <Search size={38} />
                  <span className="text-sm font-bold">Search for an artist, track, or album.</span>
                </div>
              )}
            </section>
          )}

          {activeTab === 'liked' && (
            <section>
              <h2 className="mb-4 text-3xl font-black tracking-tight">Liked Songs</h2>
              {likedSongs.length ? (
                <div className="space-y-2">
                  {likedSongs.map((song, index) => (
                    <TrackRow
                      key={song.id}
                      song={song}
                      songs={likedSongs}
                      index={index}
                      onAdd={addToPrimaryPlaylist}
                      onDownload={downloadSong}
                      isDownloaded={downloadedIds.has(song.id)}
                      isDownloading={downloadingIds.includes(song.id)}
                      onMoveUp={(item) => moveLikedSong(item.id, -1)}
                      onMoveDown={(item) => moveLikedSong(item.id, 1)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-white/8 bg-zinc-950/50 text-zinc-500">
                  <Heart size={42} />
                  <span className="text-sm font-bold">Liked tracks will appear here.</span>
                </div>
              )}
            </section>
          )}

          {activeTab === 'playlists' && (
            <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div>
                <h2 className="mb-4 text-3xl font-black tracking-tight">Playlists</h2>
                <form onSubmit={handleCreatePlaylist} className="mb-5 flex gap-2">
                  <input
                    value={playlistName}
                    onChange={(event) => setPlaylistName(event.target.value)}
                    placeholder="New playlist name"
                    className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-zinc-950 px-4 text-sm font-bold text-white outline-none focus:border-emerald-400/50"
                  />
                  <button className="h-11 rounded-xl bg-emerald-400 px-4 text-black" title="Create playlist"><Plus size={18} /></button>
                </form>
                <div className="space-y-2">
                  {playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => setSelectedPlaylistId(playlist.id)}
                      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${selectedPlaylist?.id === playlist.id ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/6 bg-zinc-950/50 hover:bg-white/[0.05]'}`}
                    >
                      <span>
                        <span className="block text-sm font-black text-white">{playlist.name}</span>
                        <span className="text-xs font-semibold text-zinc-500">{playlist.songs.length} tracks</span>
                      </span>
                      <Trash2
                        size={16}
                        className="text-zinc-500 transition hover:text-red-300"
                        onClick={(event) => {
                          event.stopPropagation();
                          deletePlaylist(playlist.id);
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-4 text-2xl font-black tracking-tight">{selectedPlaylist?.name || 'Create a playlist'}</h3>
                {selectedPlaylist?.songs.length ? (
                  <div className="space-y-2">
                    {selectedPlaylist.songs.map((song, index) => (
                      <TrackRow
                        key={song.id}
                        song={song}
                        songs={selectedPlaylist.songs}
                        index={index}
                        onDownload={downloadSong}
                        isDownloaded={downloadedIds.has(song.id)}
                        isDownloading={downloadingIds.includes(song.id)}
                        onMoveUp={(item) => movePlaylistSong(selectedPlaylist.id, item.id, -1)}
                        onMoveDown={(item) => movePlaylistSong(selectedPlaylist.id, item.id, 1)}
                        onRemove={(item) => removeSongFromPlaylist(selectedPlaylist.id, item.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-white/8 bg-zinc-950/50 text-zinc-500">
                    <Library size={42} />
                    <span className="text-sm font-bold">Add songs from search results.</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'downloads' && (
            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-3 text-3xl font-black tracking-tight"><Download className="text-emerald-400" /> Downloads</h2>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-zinc-400">{downloadedSongs.length} offline</span>
              </div>
              {downloadedSongs.length ? (
                <div className="space-y-2">
                  {downloadedSongs.map((song, index) => (
                    <TrackRow
                      key={song.id}
                      song={song}
                      songs={downloadedSongs}
                      index={index}
                      onAdd={addToPrimaryPlaylist}
                      isDownloaded
                      onRemove={removeDownload}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-white/8 bg-zinc-950/50 text-zinc-500">
                  <Download size={42} />
                  <span className="text-sm font-bold">Downloaded songs will appear here.</span>
                </div>
              )}
            </section>
          )}

          {activeTab === 'queue' && (
            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-3 text-3xl font-black tracking-tight"><GripVertical className="text-emerald-400" /> Queue</h2>
                <button
                  onClick={() => setQueue([])}
                  className="rounded-full border border-white/10 px-3 py-2 text-xs font-black text-zinc-400 transition hover:text-white"
                >
                  Clear
                </button>
              </div>
              {queue.length ? (
                <div className="space-y-2">
                  {queue.map((song, index) => (
                    <TrackRow
                      key={`${song.id}-${index}`}
                      song={song}
                      songs={queue}
                      index={index}
                      onDownload={downloadSong}
                      isDownloaded={downloadedIds.has(song.id)}
                      isDownloading={downloadingIds.includes(song.id)}
                      onMoveUp={(item) => moveQueueSong(item.id, -1)}
                      onMoveDown={(item) => moveQueueSong(item.id, 1)}
                      onRemove={(item) => setQueue(queue.filter((queued) => queued.id !== item.id), currentSong)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-white/8 bg-zinc-950/50 text-zinc-500">
                  <ListMusic size={42} />
                  <span className="text-sm font-bold">Play any list to create a queue.</span>
                </div>
              )}
            </section>
          )}

          {activeTab === 'nowPlaying' && (
            <section>
              <div className="mx-auto max-w-3xl">
                <button
                  onClick={() => setActiveTab('queue')}
                  className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-black text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <ChevronLeft size={15} /> Queue
                </button>

                <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
                  <div className="aspect-square overflow-hidden rounded-2xl border border-white/8 bg-zinc-950">
                    {currentSong?.image ? (
                      <img src={currentSong.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-zinc-700"><Disc3 size={96} /></span>
                    )}
                  </div>

                  <div className="min-w-0 self-center">
                    <div className="mb-3">{currentSong && <SourcePill source={currentSong.source} />}</div>
                    <h2 className="truncate text-3xl font-black tracking-tight text-white sm:text-4xl">
                      {currentSong?.title || 'Choose a track'}
                    </h2>
                    <p className="mt-2 truncate text-base font-bold text-zinc-400">
                      {currentSong?.artist || 'Play a song to control it here'}
                    </p>

                    <div className="mt-6 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => (isPlaying ? pause() : play())}
                        disabled={!currentSong}
                        className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-black transition hover:scale-[1.02] disabled:opacity-40"
                      >
                        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        {isPlaying ? 'Pause' : 'Play'}
                      </button>
                      <button onClick={prev} disabled={!currentSong} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-40" title="Previous">
                        <SkipBack size={18} fill="currentColor" />
                      </button>
                      <button onClick={next} disabled={!currentSong} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-40" title="Next">
                        <SkipForward size={18} fill="currentColor" />
                      </button>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <button
                        onClick={() => currentSong && toggleLike(currentSong)}
                        disabled={!currentSong}
                        className={`flex h-12 items-center justify-center gap-2 rounded-xl border px-2 text-xs font-black transition disabled:opacity-40 ${currentSongLiked ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/[0.035] text-zinc-200 hover:bg-white/[0.07]'}`}
                      >
                        <Heart size={17} fill={currentSongLiked ? 'currentColor' : 'none'} /> Like
                      </button>
                      <button
                        onClick={() => currentSong && addToPrimaryPlaylist(currentSong)}
                        disabled={!currentSong}
                        className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-2 text-xs font-black text-zinc-200 transition hover:bg-white/[0.07] disabled:opacity-40"
                      >
                        <Plus size={17} /> Playlist
                      </button>
                      <button
                        onClick={() => currentSong && downloadSong(currentSong)}
                        disabled={!currentSong || (currentSong ? downloadedIds.has(currentSong.id) || downloadingIds.includes(currentSong.id) : true)}
                        className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-2 text-xs font-black text-zinc-200 transition hover:bg-white/[0.07] disabled:opacity-40"
                      >
                        {currentSong && downloadingIds.includes(currentSong.id) ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
                        {currentSong && downloadedIds.has(currentSong.id) ? 'Saved' : 'Download'}
                      </button>
                    </div>
                  </div>
                </div>

                {queue.length > 1 && (
                  <div className="mt-8">
                    <h3 className="mb-3 text-xl font-black tracking-tight">Change Song</h3>
                    <div className="space-y-2">
                      {queue.map((song, index) => (
                        <TrackRow
                          key={`${song.id}-${index}`}
                          song={song}
                          songs={queue}
                          index={index}
                          onAdd={addToPrimaryPlaylist}
                          onDownload={downloadSong}
                          isDownloaded={downloadedIds.has(song.id)}
                          isDownloading={downloadingIds.includes(song.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'settings' && (
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-zinc-950/50 p-5">
                <h2 className="mb-4 flex items-center gap-3 text-2xl font-black tracking-tight"><Palette className="text-emerald-400" /> Mood Color</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {themes.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setTheme(item.id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${theme === item.id ? 'border-emerald-400/50 bg-emerald-400/10 text-white' : 'border-white/8 bg-black/30 text-zinc-300 hover:bg-white/[0.05]'}`}
                    >
                      <span className="h-5 w-5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm font-black">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-zinc-950/50 p-5">
                <h2 className="mb-4 flex items-center gap-3 text-2xl font-black tracking-tight"><Upload className="text-emerald-400" /> Backup & Sync</h2>
                <div className="space-y-3">
                  <button
                    onClick={exportLibrary}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-black transition hover:bg-emerald-300"
                  >
                    <Download size={17} /> Export ADIFY Data
                  </button>
                  <button
                    onClick={() => importInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-black text-white transition hover:bg-white/[0.07]"
                  >
                    <Upload size={17} /> Import ADIFY Backup
                  </button>
                  <input ref={importInputRef} type="file" accept=".zip" className="hidden" onChange={importBackup} />
                  <p className="text-sm font-semibold leading-6 text-zinc-400">
                    Export saves liked songs, playlists, recent songs, mood color, download list, and downloaded audio into one ADIFY backup zip.
                  </p>
                  {syncMessage && (
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200">
                      {syncMessage}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      <aside className="hidden w-[360px] shrink-0 border-l border-white/6 bg-[#08090b] p-5 xl:block">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">Now Playing</h2>
          {currentSong?.externalUrl && (
            <a href={currentSong.externalUrl} target="_blank" rel="noreferrer" className="rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white" title="Open source">
              <ExternalLink size={17} />
            </a>
          )}
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/8 bg-zinc-950/70">
          <div className="flex aspect-square items-center justify-center bg-zinc-950">
            {currentSong?.image ? (
              <img src={currentSong.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <Disc3 size={88} className="text-zinc-800" />
            )}
          </div>
          <div className="p-4">
            <div className="truncate text-xl font-black">{currentSong?.title || 'Choose a track'}</div>
            <div className="mt-1 truncate text-sm font-bold text-zinc-400">{currentSong?.artist || 'Saavn audio ready'}</div>
            {currentSong && (
              <div className="mt-4"><SourcePill source={currentSong.source} /></div>
            )}
          </div>
        </div>
      </aside>

      <nav className="fixed bottom-[148px] left-0 right-0 z-50 grid grid-cols-6 border-t border-white/8 bg-[#070808]/95 px-1 py-2 backdrop-blur-xl md:hidden">
        {mobileTabs.map(([id, Icon, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-black transition ${activeTab === id ? 'bg-emerald-400/10 text-emerald-300' : 'text-zinc-500 hover:text-white'}`}
          >
            <Icon size={18} fill={id === 'liked' && activeTab === id ? 'currentColor' : 'none'} />
            {label}
          </button>
        ))}
      </nav>

      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/8 bg-[#050606]/95 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-xl md:left-64 md:px-4 md:py-3 md:pb-3 xl:right-[360px]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 md:grid-cols-[minmax(0,1fr)_minmax(260px,420px)_minmax(0,1fr)] md:gap-3">
          <button
            onClick={() => currentSong && setActiveTab('nowPlaying')}
            disabled={!currentSong}
            className="flex min-w-0 items-center gap-3 rounded-xl text-left transition hover:bg-white/[0.04] disabled:cursor-default disabled:hover:bg-transparent"
            title={currentSong ? 'Open now playing' : 'No song playing'}
          >
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-zinc-900 md:h-12 md:w-12">
              {currentSong?.image ? <img src={currentSong.image} alt="" className="h-full w-full object-cover" /> : <Music2 className="m-3 text-zinc-600" />}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-black">{currentSong?.title || 'ADIFY'}</div>
              <div className="truncate text-xs font-bold text-zinc-500">{currentSong?.artist || 'Ready to stream'}</div>
            </div>
          </button>

          <div className="min-w-0 md:col-start-2 md:row-start-1 md:self-start">
            <div className="flex items-center justify-end gap-2 md:mb-2 md:justify-center md:gap-3">
              <button onClick={prev} disabled={!currentSong || queue.length < 2} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-zinc-200 transition hover:bg-white/[0.12] hover:text-white active:scale-95 disabled:opacity-30" title="Previous"><SkipBack size={20} fill="currentColor" /></button>
              <button
                onClick={() => (isPlaying ? pause() : play())}
                disabled={!currentSong}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 disabled:opacity-40"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
              </button>
              <button onClick={next} disabled={!currentSong || queue.length < 2} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-zinc-200 transition hover:bg-white/[0.12] hover:text-white active:scale-95 disabled:opacity-30" title="Next"><SkipForward size={20} fill="currentColor" /></button>
            </div>
          </div>

          <div className="col-span-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1 md:self-end">
            <div className="grid grid-cols-[34px_minmax(0,1fr)_34px] items-center gap-2 text-[10px] font-bold text-zinc-500 md:grid-cols-[40px_minmax(0,1fr)_40px] md:text-[11px]">
              <span>{formatTime(currentTime)}</span>
              <label className="relative flex h-5 items-center">
                <span className="pointer-events-none absolute left-0 right-0 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${currentProgress}%` }} />
                </span>
                <input
                  type="range"
                  min="0"
                  max={Math.max(1, displayDuration || 0)}
                  step="0.1"
                  value={Math.min(currentTime, displayDuration || currentTime || 0)}
                  onChange={(event) => setTime(Number(event.target.value))}
                  disabled={!currentSong || !displayDuration}
                  className="seek-slider relative z-10 h-5 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Seek song position"
                />
              </label>
              <span className="text-right">{formatTime(displayDuration || 0)}</span>
            </div>
          </div>

          <div className="hidden items-center justify-end gap-2 md:flex">
            <Volume2 size={18} className="text-zinc-500" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              className="h-1.5 w-28 accent-emerald-400"
              aria-label="Volume"
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
