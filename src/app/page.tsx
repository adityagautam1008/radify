'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, Heart, SkipForward, SkipBack, Search, Home, Library, 
  Volume2, VolumeX, Download, Disc, Sparkles, Music, Loader2, Shuffle, Timer, X,
  Plus, Trash2, Clock, ListMusic, Layers, GripVertical, Settings,
  ChevronUp, ChevronDown, Mic, Share2, Palette, Bot, Radio, AlertTriangle, Zap,
  Folder, FolderOpen, FileText, FileAudio, FileCode, CheckCircle, File as FileIcon,
  ChevronsUpDown
} from "lucide-react";
import { usePlayerStore, Song } from '@/store/playerStore';
import AudioPlayer from '@/components/AudioPlayer';
import * as offlineDb from '@/lib/db';
import JSZip from 'jszip';

const AVAILABLE_LANGUAGES = [
  { id: 'hindi', name: 'Hindi' },
  { id: 'punjabi', name: 'Punjabi' },
  { id: 'haryanvi', name: 'Haryanvi' },
  { id: 'english', name: 'English (Global)' },
  { id: 'telugu', name: 'Telugu' },
  { id: 'tamil', name: 'Tamil' },
  { id: 'bhojpuri', name: 'Bhojpuri' },
  { id: 'kannada', name: 'Kannada' },
  { id: 'malayalam', name: 'Malayalam' },
  { id: 'marathi', name: 'Marathi' }
];

const POPULAR_REGIONAL_PRESETS = [
  { id: 'assamese', name: 'Assamese', desc: 'Bihu & Assam Folk' },
  { id: 'awadhi', name: 'Awadhi', desc: 'Central UP & Avadh Classics' },
  { id: 'bengali', name: 'Bengali', desc: 'Rabindra Sangeet & Folk' },
  { id: 'brajbhasha', name: 'Brajbhasha', desc: 'Devotional Krishna & Braj Folk' },
  { id: 'chhattisgarhi', name: 'Chhattisgarhi', desc: 'Chhattisgarh Folk & Karma' },
  { id: 'dogri', name: 'Dogri', desc: 'Jammu Folk & Dogra Songs' },
  { id: 'garhwali', name: 'Garhwali', desc: 'Uttarakhand Folk Traditions' },
  { id: 'gondi', name: 'Gondi', desc: 'Central Indian Gondi Heritage' },
  { id: 'gujarati', name: 'Gujarati', desc: 'Garba & Gujarati Hits' },
  { id: 'himachali', name: 'Himachali', desc: 'Himachal Devotional & Nati' },
  { id: 'kashmiri', name: 'Kashmiri', desc: 'Sufi & Valley Melodies' },
  { id: 'khasi', name: 'Khasi', desc: 'Meghalaya Hills Acoustic Folk' },
  { id: 'konkani', name: 'Konkani', desc: 'Goa Coastal Hits' },
  { id: 'kumaoni', name: 'Kumaoni', desc: 'Kumaon Hills Folk' },
  { id: 'ladakhi', name: 'Ladakhi', desc: 'Himalayan Buddhist Chants & Folk' },
  { id: 'maithili', name: 'Maithili', desc: 'Mithila & Bihar Classics' },
  { id: 'manipuri', name: 'Manipuri', desc: 'Manipur Classical & Pena Melodies' },
  { id: 'odia', name: 'Odia', desc: 'Odisha Superhits & Odissi' },
  { id: 'pahari', name: 'Pahari', desc: 'Himalayan Folk & Pahadi Hits' },
  { id: 'rajasthani', name: 'Rajasthani', desc: 'Marwari Folk & Ghoomar' },
  { id: 'sanskrit', name: 'Sanskrit', desc: 'Vedic Chants & Shlokas' },
  { id: 'santhali', name: 'Santhali', desc: 'Jharkhand Tribal Folk' },
  { id: 'sindhi', name: 'Sindhi', desc: 'Sindh Heritage & Lada' },
  { id: 'tulu', name: 'Tulu', desc: 'Karnataka Coastal Folk' }
];

const THEMES = [
  { id: 'emerald', name: 'Emerald', swatch: 'bg-green-500' },
  { id: 'sunset', name: 'Sunset', swatch: 'bg-orange-500' },
  { id: 'cyberpunk', name: 'Cyberpunk', swatch: 'bg-pink-500' },
  { id: 'ocean', name: 'Ocean', swatch: 'bg-cyan-500' },
  { id: 'amethyst', name: 'Amethyst', swatch: 'bg-violet-500' }
];

export default function AppHome() {
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'liked' | 'playlist' | 'downloads' | 'settings'>('home');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Premium Custom Skins
  const [theme, setTheme] = useState<string>('emerald');

  // AI Mood Playlist Generator Modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiResolvedOptions, setAiResolvedOptions] = useState<Song[]>([]);
  const [aiMixTitle, setAiMixTitle] = useState('');

  // Synced Lyrics Side Panel
  const [showLyrics, setShowLyrics] = useState(false);

  // Expanded Mobile Song Details Drawer Overlay
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const [showMobileQueue, setShowMobileQueue] = useState(false);

  // Web Speech Hands-free Voice Assistant
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceCommandText, setVoiceCommandText] = useState('');

  // Offline downloads caching lists
  const [offlineSongs, setOfflineSongs] = useState<offlineDb.OfflineSong[]>([]);
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});

  // Home Featured Languages State
  const [activeLanguages, setActiveLanguages] = useState<string[]>(['hindi', 'punjabi', 'haryanvi']);
  const [featuredLanguage, setFeaturedLanguage] = useState<string>('hindi');
  const [featuredSongs, setFeaturedSongs] = useState<Record<string, Song[]>>({});
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [showLanguageSettings, setShowLanguageSettings] = useState(false);
  const [customLanguages, setCustomLanguages] = useState<{ id: string; name: string }[]>([]);
  const [customLanguageInput, setCustomLanguageInput] = useState('');

  const getLanguageName = (id: string) => {
    const preset = AVAILABLE_LANGUAGES.find(l => l.id === id);
    if (preset) return preset.name;
    const regional = POPULAR_REGIONAL_PRESETS.find(l => l.id === id);
    if (regional) return regional.name;
    const custom = customLanguages.find(l => l.id === id);
    if (custom) return custom.name;
    return id.charAt(0).toUpperCase() + id.slice(1);
  };

  // Drag and Drop reordering state for Liked Songs
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [isHoldingHandle, setIsHoldingHandle] = useState(false);

  // Recommendations State
  const [recommendedSongs, setRecommendedSongs] = useState<Song[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);

  // Playlist Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  // Dropdown Song Add Menu
  const [activePlaylistMenuSongId, setActivePlaylistMenuSongId] = useState<string | null>(null);
  
  // Custom Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Seek bar local state
  const [isSeeking, setIsSeeking] = useState(false);
  const [tempSeekTime, setTempSeekTime] = useState(0);

  // Sleep timer UI
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState('');

  // Backup & Restore states
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportTotal, setExportTotal] = useState(0);
  const [exportStatus, setExportStatus] = useState('');

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importStatus, setImportStatus] = useState('');

  // Local Storage Data & Content Center states
  const [showSettingsLikedList, setShowSettingsLikedList] = useState(false);
  const [showSettingsPlaylistsList, setShowSettingsPlaylistsList] = useState(false);
  const [showSettingsDownloadsList, setShowSettingsDownloadsList] = useState(false);
  const [showSettingsHistoryList, setShowSettingsHistoryList] = useState(false);
  const [confirmWipeState, setConfirmWipeState] = useState<'idle' | 'confirm' | 'final_confirm'>('idle');

  // Sandbox Directory Tree States
  const [showSandboxTree, setShowSandboxTree] = useState(true);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    root: true,
    settings: false,
    liked_songs: false,
    playlists: false,
    play_history: false,
    offline_music_cache: false
  });
  const [selectedSandboxFile, setSelectedSandboxFile] = useState<{
    name: string;
    path: string;
    content: string;
    type: 'json' | 'audio';
    meta?: any;
  } | null>(null);

  // Player Store States
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    likedSongs,
    shuffle,
    sleepTimerEnd,
    sleepTimerMinutes,
    recentSongs,
    playlists,
    play,
    pause,
    setSong,
    next,
    prev,
    setVolume,
    toggleLike,
    setTime,
    loadLikedSongs,
    toggleShuffle,
    setSleepTimer,
    createPlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    loadHistoryAndPlaylists,
    setLikedSongs,
    queue,
    currentIndex,
    moveQueueSong,
    removeQueueSong,
    isBuffering
  } = usePlayerStore();

  // Lyrics Side Drawer Refs and Calculations
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  const loadOfflineSongs = async () => {
    try {
      const songs = await offlineDb.getAllOfflineSongs();
      setOfflineSongs(songs);
    } catch (e) {
      console.error('Failed to load offline songs:', e);
    }
  };

  // Directory explorer helpers
  const toggleFolder = (folderKey: string) => {
    setOpenFolders(prev => ({
      ...prev,
      [folderKey]: !prev[folderKey]
    }));
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const estimateJsonSize = (obj: any): number => {
    return new Blob([JSON.stringify(obj)]).size;
  };

  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (selectedSandboxFile?.type === 'audio' && selectedSandboxFile.meta?.audioBlob) {
      const url = URL.createObjectURL(selectedSandboxFile.meta.audioBlob);
      setPreviewAudioUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setPreviewAudioUrl(null);
      };
    } else {
      setPreviewAudioUrl(null);
    }
  }, [selectedSandboxFile]);

  // Prevent background scrolling when mobile song details overlay is open
  useEffect(() => {
    if (showMobileDetails) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showMobileDetails]);

  // History popstate navigation interceptor for overlay/drawer dismissals ("go back one step")
  const isSyncingRef = useRef(false);
  const prevOverlaysRef = useRef<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (event: PopStateEvent) => {
      isSyncingRef.current = true;
      const nextOverlays: string[] = event.state?.activeOverlays || [];
      
      setShowLyrics(nextOverlays.includes('lyrics'));
      setShowMobileDetails(nextOverlays.includes('mobileDetails'));
      setShowMobileQueue(nextOverlays.includes('mobileQueue'));
      setShowAiModal(nextOverlays.includes('aiModal'));
      setShowCreateModal(nextOverlays.includes('createModal'));
      
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 0);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentOverlays: string[] = [];
    if (showLyrics) currentOverlays.push('lyrics');
    if (showMobileDetails) currentOverlays.push('mobileDetails');
    if (showMobileQueue) currentOverlays.push('mobileQueue');
    if (showAiModal) currentOverlays.push('aiModal');
    if (showCreateModal) currentOverlays.push('createModal');

    if (isSyncingRef.current) {
      prevOverlaysRef.current = currentOverlays;
      return;
    }

    const prevOverlays = prevOverlaysRef.current;
    
    if (currentOverlays.length > prevOverlays.length) {
      // Overlay opened: push history entry
      window.history.pushState({ activeOverlays: currentOverlays }, '');
    } else if (currentOverlays.length < prevOverlays.length) {
      // Overlay closed manually by UI click: sync history stack by going back
      window.history.back();
    }

    prevOverlaysRef.current = currentOverlays;
  }, [showLyrics, showMobileDetails, showMobileQueue, showAiModal, showCreateModal]);

  // Load state and data on mount
  useEffect(() => {
    loadLikedSongs();
    loadHistoryAndPlaylists();
    loadOfflineSongs();
    
    // Load custom theme
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('adify_theme');
      if (savedTheme) {
        setTheme(savedTheme);
      }
    }
    
    // Load custom languages list
    if (typeof window !== 'undefined') {
      const savedCustom = localStorage.getItem('adify_custom_languages');
      if (savedCustom) {
        try {
          const parsed = JSON.parse(savedCustom);
          if (Array.isArray(parsed)) {
            setCustomLanguages(parsed);
          }
        } catch (e) {
          console.error('Failed to parse custom languages', e);
        }
      }
    }
    
    // Load custom active languages from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('adify_active_languages');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setActiveLanguages(parsed);
            setFeaturedLanguage(parsed[0]);
            fetchFeaturedCharts(parsed);
            return;
          }
        } catch (e) {
          console.error('Failed to parse active languages', e);
        }
      }
    }
    fetchFeaturedCharts(['hindi', 'punjabi', 'haryanvi']);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const marker = '#adify-collab=';
    if (!window.location.hash.startsWith(marker)) return;

    try {
      const payload = JSON.parse(decodeURIComponent(atob(window.location.hash.slice(marker.length)))) as { name?: string; songs?: Song[] };
      if (!payload.name || !Array.isArray(payload.songs)) return;

      const importedPlaylist = {
        id: `collab-${Date.now()}`,
        name: `${payload.name} (Collab)`,
        songs: payload.songs,
        createdAt: Date.now()
      };
      const updated = [...usePlayerStore.getState().playlists, importedPlaylist];
      localStorage.setItem('adify_playlists', JSON.stringify(updated));
      usePlayerStore.setState({ playlists: updated });
      setSelectedPlaylistId(importedPlaylist.id);
      setActiveTab('playlist');
      window.history.replaceState(null, '', window.location.pathname);
      triggerToast(`Imported collaborative playlist "${payload.name}"`);
    } catch (error) {
      console.error('Failed to import collaborative playlist:', error);
      triggerToast('Could not import collaborative playlist link.');
    }
  }, []);

  // Fetch customizable superhit language playlists
  const fetchFeaturedCharts = async (langsList = activeLanguages) => {
    try {
      setLoadingFeatured(true);
      const res = await fetch(`/api/featured?langs=${langsList.join(',')}`);
      const data = await res.json();
      if (data) {
        setFeaturedSongs(data);
      }
    } catch (e) {
      console.error('Failed to load featured charts:', e);
    } finally {
      setLoadingFeatured(false);
    }
  };

  // Generate recommendations based on history
  const generateRecommendations = async (history: Song[]) => {
    try {
      setLoadingRecs(true);
      // Pick top 3 unique artists from recently played
      const artists = Array.from(new Set(history.map(s => s.artist.split(',')[0].trim())))
        .filter(Boolean)
        .slice(0, 3)
        .join(',');

      const url = artists
        ? `/api/recommendations?artists=${encodeURIComponent(artists)}`
        : '/api/recommendations';

      const res = await fetch(url);
      const data = await res.json();
      if (data.songs) {
        setRecommendedSongs(data.songs);
      }
    } catch (e) {
      console.error('Failed to generate recommendations:', e);
    } finally {
      setLoadingRecs(false);
    }
  };

  // Trigger recommendations when history changes
  useEffect(() => {
    generateRecommendations(recentSongs);
  }, [recentSongs]);

  // Handle Toast helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Expose toast globally for AudioPlayer stream errors
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__adifyTriggerToast = (msg: string) => triggerToast(msg);
    }
  }, []);

  const handleThemeChange = (themeId: string) => {
    setTheme(themeId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('adify_theme', themeId);
    }
    triggerToast(`Theme switched to ${THEMES.find((t) => t.id === themeId)?.name || themeId}`);
  };

  const handleShare = async (title: string, text: string) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text, url });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${text} ${url}`.trim());
        triggerToast('Share link copied to clipboard.');
      }
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleCollaborativePlaylistShare = async (playlistId: string) => {
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist || typeof window === 'undefined') return;

    const payload = btoa(encodeURIComponent(JSON.stringify({
      name: playlist.name,
      songs: playlist.songs
    })));
    const link = `${window.location.origin}${window.location.pathname}#adify-collab=${payload}`;
    await navigator.clipboard?.writeText(link);
    triggerToast('Collaborative playlist link copied.');
  };

  const handleDeleteOfflineSong = async (songId: string) => {
    await offlineDb.deleteOfflineSong(songId);
    await loadOfflineSongs();
    triggerToast('Removed offline download.');
  };

  // Create custom playlist handler
  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    createPlaylist(newPlaylistName.trim());
    triggerToast(`Playlist "${newPlaylistName.trim()}" created successfully!`);
    setNewPlaylistName('');
    setShowCreateModal(false);
  };

  // Add song to playlist helper
  const handleAddSongToPlaylist = (playlistId: string, playlistName: string, song: Song) => {
    addSongToPlaylist(playlistId, song);
    triggerToast(`Added "${song.title}" to ${playlistName}`);
    setActivePlaylistMenuSongId(null);
  };

  // Toggle regional chart language tab
  const handleToggleLanguage = (langId: string) => {
    let updated: string[];
    if (activeLanguages.includes(langId)) {
      if (activeLanguages.length <= 1) {
        triggerToast("Keep at least one active trending language!");
        return;
      }
      updated = activeLanguages.filter((l) => l !== langId);
    } else {
      updated = [...activeLanguages, langId];
    }

    setActiveLanguages(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('adify_active_languages', JSON.stringify(updated));
    }

    // Switch selected tab if the current active one was unchecked
    if (!updated.includes(featuredLanguage)) {
      setFeaturedLanguage(updated[0]);
    }

    // Dynamic refetch
    fetchFeaturedCharts(updated);
  };

  // Add custom regional or global language
  const handleAddCustomLanguage = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    
    const id = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    
    // Check presets & existing custom list
    if (AVAILABLE_LANGUAGES.some(l => l.id === id) || customLanguages.some(l => l.id === id)) {
      triggerToast(`Language "${trimmed}" is already added!`);
      return;
    }
    
    const newLang = { id, name: trimmed };
    const updatedCustoms = [...customLanguages, newLang];
    setCustomLanguages(updatedCustoms);
    if (typeof window !== 'undefined') {
      localStorage.setItem('adify_custom_languages', JSON.stringify(updatedCustoms));
    }
    
    // Auto-select this custom language as active
    const updatedActive = [...activeLanguages, id];
    setActiveLanguages(updatedActive);
    if (typeof window !== 'undefined') {
      localStorage.setItem('adify_active_languages', JSON.stringify(updatedActive));
    }
    
    setFeaturedLanguage(id);
    fetchFeaturedCharts(updatedActive);
    
    triggerToast(`Added custom language "${trimmed}" and enabled charts! 📻✨`);
    setCustomLanguageInput('');
  };

  // Delete custom language
  const handleDeleteCustomLanguage = (id: string, name: string) => {
    const updatedCustoms = customLanguages.filter(l => l.id !== id);
    setCustomLanguages(updatedCustoms);
    if (typeof window !== 'undefined') {
      localStorage.setItem('adify_custom_languages', JSON.stringify(updatedCustoms));
    }
    
    // De-activate if it was active
    if (activeLanguages.includes(id)) {
      const updatedActive = activeLanguages.filter(l => l !== id);
      setActiveLanguages(updatedActive);
      if (typeof window !== 'undefined') {
        localStorage.setItem('adify_active_languages', JSON.stringify(updatedActive));
      }
      if (featuredLanguage === id) {
        setFeaturedLanguage(updatedActive[0] || 'hindi');
      }
      fetchFeaturedCharts(updatedActive);
    }
    
    triggerToast(`Removed language "${name}"`);
  };

  // Drag and Drop reordering in Liked Songs tab
  const handleDragEnter = (targetIndex: number) => {
    if (draggingIndex === null || draggingIndex === targetIndex) return;
    const updated = [...likedSongs];
    const [draggedItem] = updated.splice(draggingIndex, 1);
    updated.splice(targetIndex, 0, draggedItem);
    
    // Smooth inline swap
    setDraggingIndex(targetIndex);
    setLikedSongs(updated);
  };

  // Move song manually using buttons
  const moveSong = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= likedSongs.length) return;
    
    const updated = [...likedSongs];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, movedItem);
    
    setLikedSongs(updated);
  };

  // Helper to convert Blob to Base64 data URL
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Helper to convert Base64 data URL to Blob
  const dataURLtoBlob = async (dataurl: string): Promise<Blob> => {
    const res = await fetch(dataurl);
    return await res.blob();
  };

  // Export all local memory & data to a download profile (.zip) or (.json)
  const handleExportBackup = async (full: boolean) => {
    try {
      setIsExporting(true);
      setExportProgress(0);
      setExportTotal(100);
      setExportStatus('Creating virtual Sandbox Folder structure...');

      const themeVal = localStorage.getItem('adify_theme') || 'emerald';
      const langsVal = localStorage.getItem('adify_active_languages') || '["hindi", "punjabi", "haryanvi"]';
      const customLangsVal = localStorage.getItem('adify_custom_languages') || '[]';

      const zip = new JSZip();
      
      // We put everything in a root folder "ADIFY_Sandbox_Data"
      const sandbox = zip.folder('ADIFY_Sandbox_Data');
      
      if (!sandbox) {
        throw new Error('Failed to initialize virtual zip folders.');
      }

      // 1. Settings & Skins folder
      setExportStatus('Exporting personalization settings...');
      const config = {
        version: '1.0',
        exportedAt: Date.now(),
        theme: themeVal,
        activeLanguages: JSON.parse(langsVal),
        customLanguages: JSON.parse(customLangsVal)
      };
      sandbox.folder('settings')?.file('app_config.json', JSON.stringify(config, null, 2));

      // 2. Liked Songs folder
      setExportStatus('Exporting liked music collection...');
      sandbox.folder('liked_songs')?.file('liked_songs_list.json', JSON.stringify(likedSongs, null, 2));

      // 3. Playlists folder
      setExportStatus('Exporting custom playlists...');
      sandbox.folder('playlists')?.file('playlists.json', JSON.stringify(playlists, null, 2));

      // 4. Play History folder
      setExportStatus('Exporting play history...');
      sandbox.folder('play_history')?.file('history_list.json', JSON.stringify(recentSongs, null, 2));

      // 5. Offline Music Cache folder (if full is selected)
      if (full) {
        setExportStatus('Gathering offline audio tracks...');
        const allSongs = await offlineDb.getAllOfflineSongs();
        setExportTotal(allSongs.length + 1);

        const registry: any[] = [];
        const cacheFolder = sandbox.folder('offline_music_cache');

        if (cacheFolder) {
          for (let i = 0; i < allSongs.length; i++) {
            const track = allSongs[i];
            // Format song names to make them user-readable and safe
            const cleanTitle = (track.songData?.title || 'Track').replace(/[/\\?%*:|"<>\s]+/g, '_');
            const cleanArtist = (track.songData?.artist || 'Unknown').replace(/[/\\?%*:|"<>\s]+/g, '_');
            const filename = `${cleanTitle}_-_${cleanArtist}.mp3`;

            registry.push({
              id: track.id,
              songData: track.songData,
              downloadedAt: track.downloadedAt,
              filename: filename
            });

            setExportStatus(`Compiling audio track ${i + 1}/${allSongs.length}: ${track.songData?.title || 'Unknown'}`);
            setExportProgress(i + 1);
            
            // Add raw binary MP3 file to zip folder!
            cacheFolder.file(filename, track.audioBlob, { binary: true });
          }

          setExportStatus('Finalizing offline registry...');
          cacheFolder.file('offline_tracks_registry.json', JSON.stringify(registry, null, 2));
        }
      }

      setExportStatus('Compressing your ADIFY Sandbox Folder into a ZIP archive...');
      setExportProgress(95);

      const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        setExportProgress(Math.round(metadata.percent));
        setExportStatus(`Assembling sandbox file tree: ${Math.round(metadata.percent)}%`);
      });

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `adify_sandbox_data_${full ? 'full' : 'settings'}_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      triggerToast(`${full ? 'Full Sandbox Folder' : 'Settings Folder'} (.zip) exported successfully! 📂⚡`);
    } catch (e) {
      console.error('Backup export failed:', e);
      triggerToast('Backup export failed. Please try again.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setExportStatus('');
    }
  };

  // Import local memory & data from backup profile (.zip or legacy .json)
  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setImportProgress(0);
      setImportTotal(0);
      setImportStatus('Inspecting backup package...');

      const filename = file.name.toLowerCase();

      // CASE A: It is a modern ZIP sandbox package!
      if (filename.endsWith('.zip')) {
        setImportStatus('Extracting virtual Sandbox Tree folders...');
        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(file);

        // Find optional root folder prefix (in case it is zipped inside a folder or root level)
        let rootPrefix = '';
        if (loadedZip.file('ADIFY_Sandbox_Data/settings/app_config.json')) {
          rootPrefix = 'ADIFY_Sandbox_Data/';
        }

        // 1. Theme and Languages Restore
        const configText = await loadedZip.file(`${rootPrefix}settings/app_config.json`)?.async('text');
        if (configText) {
          setImportStatus('Syncing active color skins & languages...');
          const config = JSON.parse(configText);
          
          if (config.theme) {
            setTheme(config.theme);
            localStorage.setItem('adify_theme', config.theme);
          }

          if (config.customLanguages && Array.isArray(config.customLanguages)) {
            setCustomLanguages(config.customLanguages);
            localStorage.setItem('adify_custom_languages', JSON.stringify(config.customLanguages));
          } else {
            setCustomLanguages([]);
            localStorage.setItem('adify_custom_languages', '[]');
          }

          if (config.activeLanguages && Array.isArray(config.activeLanguages)) {
            setActiveLanguages(config.activeLanguages);
            localStorage.setItem('adify_active_languages', JSON.stringify(config.activeLanguages));
            if (config.activeLanguages.length > 0) {
              setFeaturedLanguage(config.activeLanguages[0]);
              fetchFeaturedCharts(config.activeLanguages);
            }
          }
        }

        // 2. Liked Songs Restore
        const likedText = await loadedZip.file(`${rootPrefix}liked_songs/liked_songs_list.json`)?.async('text');
        if (likedText) {
          setImportStatus('Syncing liked library...');
          const songs = JSON.parse(likedText);
          setLikedSongs(songs);
        }

        // 3. Playlists Restore
        const playlistsText = await loadedZip.file(`${rootPrefix}playlists/playlists.json`)?.async('text');
        if (playlistsText) {
          setImportStatus('Syncing custom playlists...');
          const lists = JSON.parse(playlistsText);
          localStorage.setItem('adify_playlists', JSON.stringify(lists));
          usePlayerStore.setState({ playlists: lists });
        }

        // 4. History Restore
        const historyText = await loadedZip.file(`${rootPrefix}play_history/history_list.json`)?.async('text');
        if (historyText) {
          setImportStatus('Syncing recent history...');
          const history = JSON.parse(historyText);
          localStorage.setItem('adify_recent_songs', JSON.stringify(history));
          usePlayerStore.setState({ recentSongs: history });
        }

        // 5. Offline MP3 tracks Restore
        const registryText = await loadedZip.file(`${rootPrefix}offline_music_cache/offline_tracks_registry.json`)?.async('text');
        if (registryText) {
          setImportStatus('Restoring offline media binary files...');
          const registry = JSON.parse(registryText);
          setImportTotal(registry.length);

          for (let i = 0; i < registry.length; i++) {
            const item = registry[i];
            setImportProgress(i + 1);
            setImportStatus(`Importing track ${i + 1}/${registry.length}: ${item.songData?.title || 'Unknown'}`);

            const audioFile = loadedZip.file(`${rootPrefix}offline_music_cache/${item.filename}`);
            if (audioFile) {
              try {
                const blob = await audioFile.async('blob');
                await offlineDb.saveOfflineSong(item.songData, blob);
              } catch (err) {
                console.error(`Failed to restore song ${item.id}:`, err);
              }
            }
          }

          // Refresh downloads queue state
          await loadOfflineSongs();
        }

        setImportStatus('Sync finished!');
        triggerToast('ADIFY sandbox data restore completed successfully! 📂⚡');

      // CASE B: It is a legacy JSON backup profile!
      } else if (filename.endsWith('.json')) {
        setImportStatus('Importing legacy JSON backup...');
        const text = await file.text();
        const backupData = JSON.parse(text);

        if (!backupData || backupData.version !== '1.0') {
          throw new Error('Unsupported or corrupted backup schema.');
        }

        // 1. Theme Sync
        if (backupData.theme) {
          setImportStatus('Syncing color skin...');
          setTheme(backupData.theme);
          localStorage.setItem('adify_theme', backupData.theme);
        }

        // 2. Languages Sync
        if (backupData.customLanguages && Array.isArray(backupData.customLanguages)) {
          setCustomLanguages(backupData.customLanguages);
          localStorage.setItem('adify_custom_languages', JSON.stringify(backupData.customLanguages));
        } else {
          setCustomLanguages([]);
          localStorage.setItem('adify_custom_languages', '[]');
        }

        if (backupData.activeLanguages && Array.isArray(backupData.activeLanguages)) {
          setImportStatus('Syncing visual dialects...');
          setActiveLanguages(backupData.activeLanguages);
          localStorage.setItem('adify_active_languages', JSON.stringify(backupData.activeLanguages));
          if (backupData.activeLanguages.length > 0) {
            setFeaturedLanguage(backupData.activeLanguages[0]);
            fetchFeaturedCharts(backupData.activeLanguages);
          }
        }

        // 3. Playlists Sync
        if (backupData.playlists && Array.isArray(backupData.playlists)) {
          setImportStatus('Syncing custom playlists...');
          localStorage.setItem('adify_playlists', JSON.stringify(backupData.playlists));
          usePlayerStore.setState({ playlists: backupData.playlists });
        }

        // 4. Liked Songs Sync
        if (backupData.likedSongs && Array.isArray(backupData.likedSongs)) {
          setImportStatus('Syncing liked library...');
          setLikedSongs(backupData.likedSongs);
        }

        // 5. Recent History Sync
        if (backupData.recentSongs && Array.isArray(backupData.recentSongs)) {
          setImportStatus('Syncing recent history...');
          localStorage.setItem('adify_recent_songs', JSON.stringify(backupData.recentSongs));
          usePlayerStore.setState({ recentSongs: backupData.recentSongs });
        }

        // 6. Offline Songs DB Restructuring
        if (backupData.offlineSongs && Array.isArray(backupData.offlineSongs) && backupData.offlineSongs.length > 0) {
          setImportStatus('Restructuring offline media files...');
          setImportTotal(backupData.offlineSongs.length);

          for (let i = 0; i < backupData.offlineSongs.length; i++) {
            const song = backupData.offlineSongs[i];
            setImportProgress(i + 1);
            setImportStatus(`Decoding track ${i + 1}/${backupData.offlineSongs.length}: ${song.songData.title}`);

            try {
              const blob = await dataURLtoBlob(song.audioBlobBase64);
              await offlineDb.saveOfflineSong(song.songData, blob);
            } catch (err) {
              console.error(`Failed to restore song ${song.id}:`, err);
            }
          }

          // Refresh downloads queue state
          await loadOfflineSongs();
        }

        setImportStatus('Sync finished!');
        triggerToast('ADIFY legacy sync completed successfully! ⚡');
      } else {
        throw new Error('Unsupported file extension. Please upload .zip (Sandbox Data Folder) or .json (Legacy Backup).');
      }
    } catch (e: any) {
      console.error('Import failed:', e);
      triggerToast(`Import failed: ${e.message || 'Check backup file structure'}`);
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setImportStatus('');
      event.target.value = '';
    }
  };

  // Permanently wipe all local data
  const handleWipeAllData = async () => {
    try {
      localStorage.clear();
      
      // Clear IndexedDB
      const db = await offlineDb.openDB();
      const transaction = db.transaction('offline_songs', 'readwrite');
      const store = transaction.objectStore('offline_songs');
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      // Clear player store states
      usePlayerStore.setState({
        likedSongs: [],
        playlists: [],
        recentSongs: [],
        currentSong: null,
        isPlaying: false,
        queue: [],
        currentIndex: -1
      });
      
      // Clear local states
      setOfflineSongs([]);
      setTheme('emerald');
      setActiveLanguages(['hindi', 'punjabi', 'haryanvi']);
      
      triggerToast('All local memory and cached data cleared successfully! 🧹');
      setConfirmWipeState('idle');
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error('Failed to wipe data:', err);
      triggerToast('Error encountered while clearing memory.');
    }
  };

  // Sleep timer countdown tick
  useEffect(() => {
    if (!sleepTimerEnd) {
      setTimerRemaining('');
      return;
    }

    const tick = () => {
      const remaining = sleepTimerEnd - Date.now();
      if (remaining <= 0) {
        pause();
        setSleepTimer(null);
        setTimerRemaining('');
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setTimerRemaining(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEnd, pause, setSleepTimer]);

  // Handle Search submit
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      const res = await fetch(`/api/search?query=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.songs) {
        setSearchResults(data.songs);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search for instant typing experience
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 550);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Format time (seconds -> MM:SS)
  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Direct download and offline caching handler
  const handleDownload = async (song: Song) => {
    if (isDownloading[song.id]) return;
    
    try {
      setIsDownloading((prev) => ({ ...prev, [song.id]: true }));
      triggerToast(`Caching "${song.title}" offline...`);
      
      const response = await fetch(song.streamUrl);
      if (!response.ok) throw new Error(`HTTP status ${response.status}`);
      const blob = await response.blob();
      
      // 1. Save to browser IndexedDB for offline app playback
      await offlineDb.saveOfflineSong(song, blob);
      
      // 2. Trigger browser direct download prompt for user's convenience
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${song.title} - ${song.artist}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      // 3. Refresh offline list
      await loadOfflineSongs();
      
      triggerToast(`"${song.title}" saved offline in library! ⚡`);
    } catch (error) {
      console.error('Download and cache failed, opening direct link:', error);
      triggerToast('Direct download initiated...');
      window.open(song.streamUrl, '_blank');
    } finally {
      setIsDownloading((prev) => ({ ...prev, [song.id]: false }));
    }
  };

  // Synced Lyrics Database of popular tracks
  const LYRICS_DATABASE: Record<string, { time: number; text: string }[]> = {
    'believer': [
      { time: 0, text: "[Imagine Dragons - Believer]" },
      { time: 2, text: "First things first" },
      { time: 4, text: "I'ma say all the words inside my head" },
      { time: 7, text: "I'm fired up and tired of the way" },
      { time: 10, text: "that things have been, oh-ooh" },
      { time: 13, text: "The way that things have been, oh-ooh" },
      { time: 16, text: "Second things second" },
      { time: 18, text: "Don't you tell me what you think that I could be" },
      { time: 21, text: "I'm the one at the sail, I'm the master of my sea" },
      { time: 24, text: "The master of my sea, oh-ooh" },
      { time: 27, text: "I was broken from a young age" },
      { time: 30, text: "Taking my sulking to the masses" },
      { time: 33, text: "Writing my poems for the few" },
      { time: 35, text: "That look at me, took to me, shook to me, feeling me" },
      { time: 38, text: "Singing from heartache from the pain" },
      { time: 41, text: "Taking my message from the veins" },
      { time: 44, text: "Speaking my lesson from the brain" },
      { time: 46, text: "Seeing the beauty through the..." },
      { time: 49, text: "Pain!" },
      { time: 51, text: "You made me a, you made me a believer, believer!" },
      { time: 57, text: "Pain!" },
      { time: 59, text: "You break me down, you build me up, believer, believer!" }
    ],
    'someonelikeyou': [
      { time: 0, text: "[Adele - Someone Like You]" },
      { time: 2, text: "I heard that you're settled down" },
      { time: 6, text: "That you found a girl and you're married now" },
      { time: 13, text: "I heard that your dreams came true" },
      { time: 18, text: "Guess she gave you things I didn't give to you" },
      { time: 25, text: "Old friend, why are you so shy?" },
      { time: 31, text: "Ain't like you to hold back or hide from the light" },
      { time: 39, text: "I hate to turn up out of the blue, uninvited" },
      { time: 45, text: "But I couldn't stay away, I couldn't fight it" },
      { time: 51, text: "I had hoped you'd see my face" },
      { time: 54, text: "And that you'd be reminded that for me, it isn't over" },
      { time: 61, text: "Never mind, I'll find someone like you" },
      { time: 68, text: "I wish nothing but the best for you, too" },
      { time: 74, text: "Don't forget me, I beg, I remember you said" },
      { time: 80, text: "\"Sometimes it lasts in love, but sometimes it hurts instead\"" }
    ],
    'fixyou': [
      { time: 0, text: "[Coldplay - Fix You]" },
      { time: 5, text: "When you try your best, but you don't succeed" },
      { time: 11, text: "When you get what you want, but not what you need" },
      { time: 17, text: "When you feel so tired, but you can't sleep" },
      { time: 23, text: "Stuck in reverse..." },
      { time: 29, text: "And the tears come streaming down your face" },
      { time: 35, text: "When you lose something you cannot replace" },
      { time: 41, text: "When you love someone, but it goes to waste" },
      { time: 47, text: "Could it be worse?" },
      { time: 53, text: "Lights will guide you home" },
      { time: 60, text: "And ignite your bones" },
      { time: 66, text: "And I will try to fix you" }
    ],
    'loseyourself': [
      { time: 0, text: "[Eminem - Lose Yourself]" },
      { time: 2, text: "Look, if you had one shot, or one opportunity" },
      { time: 6, text: "To seize everything you ever wanted in one moment" },
      { time: 10, text: "Would you capture it, or just let it slip?" },
      { time: 13, text: "Yo, his palms are sweaty, knees weak, arms are heavy" },
      { time: 16, text: "There's vomit on his sweater already, mom's spaghetti" },
      { time: 19, text: "He's nervous, but on the surface he looks calm and ready" },
      { time: 22, text: "To drop bombs, but he keeps on forgettin'" },
      { time: 25, text: "What he wrote down, the whole crowd goes so loud" },
      { time: 28, text: "He opens his mouth, but the words won't come out" },
      { time: 30, text: "He's chokin', how? Everybody's jokin' now" },
      { time: 33, text: "The clock's run out, time's up, over, blaow!" },
      { time: 36, text: "Snap back to reality, oh, there goes gravity" },
      { time: 39, text: "Oh, there goes Rabbit, he choked, he's so mad" },
      { time: 42, text: "But he won't give up that easy, no, he won't have it" },
      { time: 45, text: "He knows his whole back's to these ropes, it don't matter" },
      { time: 48, text: "You better lose yourself in the music, the moment" },
      { time: 51, text: "You own it, you better never let it go" },
      { time: 54, text: "You only get one shot, do not miss your chance to blow" },
      { time: 57, text: "This opportunity comes once in a lifetime, yo" }
    ]
  };

  const getLyricsForCurrentSong = useCallback(() => {
    if (!currentSong) return null;
    const cleanTitle = currentSong.title.toLowerCase().replace(/[^a-z]/g, '');
    for (const key of Object.keys(LYRICS_DATABASE)) {
      if (cleanTitle.includes(key) || key.includes(cleanTitle)) {
        return LYRICS_DATABASE[key];
      }
    }
    return null;
  }, [currentSong, LYRICS_DATABASE]);

  const currentSongLyrics = getLyricsForCurrentSong();

  const getActiveLyricIndex = useCallback((lyricsList: { time: number; text: string }[]) => {
    let activeIdx = -1;
    for (let i = 0; i < lyricsList.length; i++) {
      if (currentTime >= lyricsList[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }
    return activeIdx;
  }, [currentTime]);

  const activeLyricIndex = currentSongLyrics ? getActiveLyricIndex(currentSongLyrics) : -1;

  // Auto-scroll lyrics
  useEffect(() => {
    if (showLyrics && lyricsContainerRef.current && activeLyricIndex !== -1) {
      const activeEl = lyricsContainerRef.current.children[activeLyricIndex] as HTMLElement;
      if (activeEl) {
        lyricsContainerRef.current.scrollTo({
          top: activeEl.offsetTop - lyricsContainerRef.current.clientHeight / 2 + activeEl.clientHeight / 2,
          behavior: 'smooth'
        });
      }
    }
  }, [activeLyricIndex, showLyrics]);

  // HTML5 Double-Sine Canvas wave visualizer
  useEffect(() => {
    if (!showLyrics || !visualizerCanvasRef.current) return;
    const canvas = visualizerCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;
      const midY = height / 2;
      const amplitude = isPlaying ? 16 : 2.5;
      const speed = isPlaying ? 0.08 : 0.01;
      
      phase += speed;

      ctx.beginPath();
      ctx.strokeStyle = theme === 'emerald' ? 'rgba(16, 185, 129, 0.6)' :
                        theme === 'sunset' ? 'rgba(249, 115, 22, 0.6)' :
                        theme === 'cyberpunk' ? 'rgba(236, 72, 153, 0.6)' :
                        theme === 'ocean' ? 'rgba(6, 182, 212, 0.6)' :
                        'rgba(139, 92, 246, 0.6)';
      ctx.lineWidth = 2.5;
      for (let x = 0; x < width; x++) {
        const angle = (x / width) * Math.PI * 4 + phase;
        const y = midY + Math.sin(angle) * amplitude;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = theme === 'emerald' ? 'rgba(16, 185, 129, 0.25)' :
                        theme === 'sunset' ? 'rgba(249, 115, 22, 0.25)' :
                        theme === 'cyberpunk' ? 'rgba(236, 72, 153, 0.25)' :
                        theme === 'ocean' ? 'rgba(6, 182, 212, 0.25)' :
                        'rgba(139, 92, 246, 0.25)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < width; x++) {
        const angle = (x / width) * Math.PI * 4 - phase + Math.PI;
        const y = midY + Math.sin(angle) * (amplitude * 0.75);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [showLyrics, isPlaying, theme]);

  // AI Playlist Generator Trigger
  const handleGenerateAiPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    const normalizeTrackText = (value: string) =>
      value
        .toLowerCase()
        .replace(/&quot;|&#34;|&amp;/g, ' ')
        .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const normalizedAiPrompt = normalizeTrackText(aiPrompt);
    const promptTerms = normalizedAiPrompt.split(' ').filter((term) => term.length > 2);
    const intentRules = [
      {
        match: ['hindi', 'bollywood', 'desi', 'urdu', 'ghazal', 'gazal', 'gajal', 'qawwali', 'qawali', 'sufi', 'nusrat', 'arijit', 'jagjit'],
        boost: ['hindi', 'bollywood', 'urdu', 'ghazal', 'gazal', 'qawwali', 'qawali', 'sufi', 'jagjit singh', 'ghulam ali', 'mehdi hassan', 'pankaj udhas', 'farida khanum', 'nusrat fateh ali khan', 'arijit singh'],
        block: ['adele', 'coldplay', 'eminem', 'imagine dragons', 'billie eilish', 'sam smith', 'kodaline', 'passenger', 'justin bieber', 'bruno mars', 'taylor swift']
      },
      {
        match: ['punjabi', 'sidhu', 'karan', 'ap', 'diljit'],
        boost: ['punjabi', 'sidhu moose wala', 'karan aujla', 'ap dhillon', 'diljit dosanjh', 'shubh'],
        block: ['adele', 'coldplay', 'imagine dragons', 'bruno mars', 'taylor swift']
      },
      {
        match: ['himachali', 'pahari', 'karnail', 'rana'],
        boost: ['karnail rana', 'himachali', 'pahari', 't series himachali', 'trinetra house', 'karnail rana official'],
        block: ['podcast', 'interview', 'episode', 'reaction', 'biography', 'adele', 'coldplay', 'imagine dragons', 'taylor swift']
      },
      {
        match: ['workout', 'gym', 'run', 'running', 'energy', 'hype'],
        boost: ['official audio', 'official video', 'workout', 'hype'],
        block: ['sleep', 'lullaby', 'meditation']
      },
      {
        match: ['lofi', 'lo fi', 'study', 'focus', 'chill'],
        boost: ['lofi', 'lo fi', 'chill', 'study', 'focus'],
        block: ['reaction', 'interview']
      }
    ];
    const activeIntent = intentRules.find((rule) => rule.match.some((term) => normalizedAiPrompt.includes(term)));
    const wantsHindiGhazal = Boolean(activeIntent?.match.some((term) => ['hindi', 'urdu', 'ghazal', 'gazal', 'gajal', 'qawwali', 'qawali', 'sufi', 'nusrat'].includes(term) && normalizedAiPrompt.includes(term)));

    const scoreResolvedSong = (song: Song, track: { title: string; artist: string }) => {
      const wantedTitle = normalizeTrackText(track.title);
      const wantedArtist = normalizeTrackText(track.artist);
      const foundTitle = normalizeTrackText(song.title);
      const foundArtist = normalizeTrackText(song.artist);
      const combined = `${foundTitle} ${foundArtist}`;
      const noisyWords = ['karaoke', 'cover', 'instrumental', 'reaction', 'tutorial', 'remix', 'sped up', 'slowed', 'nightcore', 'live'];
      const nonSongWords = ['story', 'untold', 'truth behind', 'talking', 'interview', 'tribute', 'status', 'whatsapp', 'shorts', 'biography', 'documentary', 'podcast', 'episode'];
      const ghazalArtists = [
        'jagjit singh',
        'chitra singh',
        'ghulam ali',
        'mehdi hassan',
        'pankaj udhas',
        'talat aziz',
        'farida khanum',
        'nusrat fateh ali khan',
        'ustad nusrat'
      ];
      const englishDriftArtists = [
        'adele',
        'coldplay',
        'eminem',
        'imagine dragons',
        'billie eilish',
        'sam smith',
        'kodaline',
        'passenger',
        'justin bieber',
        'bruno mars'
      ];

      let score = 0;
      promptTerms.forEach((term) => {
        if (combined.includes(term)) score += 6;
      });
      if (foundTitle === wantedTitle) score += 90;
      if (foundTitle.includes(wantedTitle) || wantedTitle.includes(foundTitle)) score += 45;
      if (foundArtist.includes(wantedArtist) || combined.includes(wantedArtist)) score += 35;
      if (song.source === 'youtube') score += 10;
      if (song.source === 'saavn') score += 6;
      if (combined.includes('nusrat fateh ali khan') || combined.includes('ustad nusrat')) score += 30;
      if (activeIntent?.boost.some((term) => combined.includes(term))) score += 45;
      if (activeIntent?.block.some((term) => combined.includes(term))) score -= 150;
      if (wantsHindiGhazal && ghazalArtists.some((artist) => combined.includes(artist))) score += 70;
      if (wantsHindiGhazal && (combined.includes('ghazal') || combined.includes('gazal') || combined.includes('qawwali') || combined.includes('sufi'))) score += 20;
      if (wantsHindiGhazal && englishDriftArtists.some((artist) => combined.includes(artist))) score -= 140;
      if (combined.includes('osa official') || combined.includes('official hd video')) score += 12;
      if (combined.includes('official audio') || combined.includes('official video') || combined.includes('lyrics')) score += 8;
      if (song.duration && song.duration >= 90 && song.duration <= 600) score += 8;
      if (noisyWords.some((word) => combined.includes(word)) && !wantedTitle.includes('remix') && !wantedTitle.includes('live')) score -= 35;
      if (nonSongWords.some((word) => combined.includes(word))) score -= 80;

      return score;
    };

    const searchBestTrackMatch = async (track: { title: string; artist: string }) => {
      const queryVariants = [
        activeIntent ? `${track.title} ${track.artist} ${activeIntent.boost.slice(0, 2).join(' ')}` : '',
        `${track.title} ${track.artist}`,
        `${track.artist} ${track.title}`,
        `${track.title} ${track.artist} official audio`,
        `${track.title} ${track.artist} official video`,
        wantsHindiGhazal ? `${track.title} ${track.artist} ghazal` : '',
        wantsHindiGhazal ? `${track.artist} ${track.title} hindi ghazal` : '',
        `${track.title}`
      ].filter(Boolean);

      const candidates: Song[] = [];
      for (const query of queryVariants) {
        const searchRes = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
        if (!searchRes.ok) continue;
        const searchData = await searchRes.json();
        if (searchData.songs && searchData.songs.length > 0) {
          candidates.push(...searchData.songs);
        }
      }

      const uniqueCandidates = Array.from(
        new Map(candidates.map((song) => [song.id || `${song.title}-${song.artist}`, song])).values()
      );

      return uniqueCandidates
        .sort((a, b) => scoreResolvedSong(b, track) - scoreResolvedSong(a, track))[0] || null;
    };

    try {
      setIsGeneratingAi(true);
      triggerToast("AI is cooking your mood mix... 🔮");

      const res = await fetch(`/api/ai-playlist?prompt=${encodeURIComponent(aiPrompt)}`);
      if (!res.ok) throw new Error("AI playlist generation failed");
      const data = await res.json();
      
      if (!data.tracks || data.tracks.length === 0) {
        throw new Error("Empty tracks returned from AI");
      }

      triggerToast("AI resolving best matches across YouTube and Saavn... ⚡");

      const resolvedSongs: Song[] = [];
      const tracksToResolve = data.tracks.slice(0, 8); // Resolve first 8 tracks in parallel for speed

      const searchPromises = tracksToResolve.map(async (track: { title: string; artist: string }) => {
        try {
          return searchBestTrackMatch(track);
        } catch (e) {
          console.error("AI track resolution error:", track, e);
        }
        return null;
      });

      const results = await Promise.all(searchPromises);
      results.forEach((s) => {
        if (s) resolvedSongs.push(s);
      });

      if (resolvedSongs.length === 0) {
        triggerToast("AI failed to find streamable matches for this mood!");
        return;
      }

      setAiResolvedOptions(resolvedSongs);
      setAiMixTitle(aiPrompt);
      triggerToast(`AI found ${resolvedSongs.length} options. Choose one to play.`);
    } catch (err: any) {
      console.error("AI Playlist generation caught error:", err);
      triggerToast("Failed to compile AI playlist. Please try a different mood!");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Hands-free Web Speech Voice Assistant Controller
  const startVoiceAssistant = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      triggerToast("Voice Assistant is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListeningVoice(true);
      setVoiceCommandText("Listening for command...");
    };

    recognition.onerror = (e: any) => {
      const errorCode = e?.error || 'unknown';
      setIsListeningVoice(false);
      setVoiceCommandText('');

      if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
        triggerToast("Microphone permission is blocked for voice assistant.");
      } else if (errorCode === 'no-speech') {
        triggerToast("No voice command detected. Try again.");
      } else if (errorCode === 'audio-capture') {
        triggerToast("No microphone was found for voice assistant.");
      } else {
        triggerToast("Voice assistant could not start in this browser.");
      }
    };

    recognition.onend = () => {
      setIsListeningVoice(false);
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript.trim().toLowerCase();
      setVoiceCommandText(`"${transcript}"`);

      setTimeout(async () => {
        setIsListeningVoice(false);

        if (transcript === 'play' || transcript === 'resume') {
          play();
          triggerToast("Resuming music playback.");
        } else if (transcript === 'pause' || transcript === 'stop') {
          pause();
          triggerToast("Music playback paused.");
        } else if (transcript === 'next' || transcript === 'skip') {
          next();
          triggerToast("Skipped to next song.");
        } else if (transcript === 'previous' || transcript === 'back' || transcript === 'prev') {
          prev();
          triggerToast("Skipped to previous song.");
        } else if (transcript === 'volume up' || transcript === 'louder') {
          setVolume(Math.min(1, volume + 0.25));
          triggerToast("Volume level increased.");
        } else if (transcript === 'volume down' || transcript === 'quieter') {
          setVolume(Math.max(0, volume - 0.25));
          triggerToast("Volume level decreased.");
        } else if (transcript === 'mute') {
          setVolume(0);
          triggerToast("Playback muted.");
        } else if (transcript === 'unmute') {
          setVolume(0.8);
          triggerToast("Playback volume restored.");
        } else if (transcript.startsWith('play ') || transcript.startsWith('search ')) {
          const query = transcript.replace('play ', '').replace('search ', '').trim();
          if (query) {
            triggerToast(`Searching for "${query}" via voice...`);
            setActiveTab('search');
            setSearchQuery(query);
            try {
              setIsSearching(true);
              const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
              const searchData = await res.json();
              if (searchData.songs && searchData.songs.length > 0) {
                setSearchResults(searchData.songs);
                setSong(searchData.songs[0], searchData.songs);
                triggerToast(`Playing voice match: "${searchData.songs[0].title}"`);
              } else {
                triggerToast(`No voice search matches found for "${query}"`);
              }
            } catch (err) {
              console.error("Voice playback search error:", err);
            } finally {
               setIsSearching(false);
            }
          }
        } else {
          triggerToast(`Speech command unrecognized: "${transcript}"`);
        }
      }, 900);
    };

    recognition.start();
  };

  // Wrapper for song play clicks
  const playSong = async (song: Song, queue?: Song[]) => {
    const isOffline = offlineSongs.some((s) => s.id === song.id);
    if (isOffline) {
      triggerToast(`⚡ Offline Mode: Playing "${song.title}" from local cache!`);
    }
    setSong(song, queue || [song]);
  };

  // Seek bar handlers
  const handleSeekStart = () => {
    setIsSeeking(true);
    setTempSeekTime(currentTime);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempSeekTime(Number(e.target.value));
  };

  const handleSeekEnd = () => {
    setTime(tempSeekTime);
    setIsSeeking(false);
  };

  const timerOptions = [
    { label: '5 min', value: 5 },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '45 min', value: 45 },
    { label: '1 hour', value: 60 },
  ];

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActivePlaylistMenuSongId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);

  return (
    <div className={`theme-${theme} flex h-screen bg-black text-white select-none relative overflow-hidden font-sans`}>
      <AudioPlayer />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 text-green-400 border border-green-500/20 backdrop-blur-md px-6 py-3 rounded-full font-bold text-xs tracking-wide shadow-2xl flex items-center gap-2 z-[999] animate-bounce">
          <Sparkles size={14} className="text-green-400 animate-pulse" />
          {toastMessage}
        </div>
      )}

      {/* Export / Import Processing Modal */}
      {(isExporting || isImporting) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[999] p-4 select-none animate-fade-in">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-850 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-green-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
            
            <div className="relative mb-6">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20">
                <Loader2 className="text-green-500 animate-spin" size={40} />
              </div>
            </div>
            
            <h3 className="text-xl font-black tracking-tight text-white mb-2">
              {isExporting ? 'Packaging Backup Profile' : 'Restoring Sync Profile'}
            </h3>
            
            <p className="text-xs font-semibold text-zinc-400 max-w-xs mb-6 leading-relaxed">
              {isExporting 
                ? 'Compiling settings, playlists, visual styles, and encoding cached audio media files into a secure sync file. Please do not close this browser tab.'
                : 'Reading backup structure, writing custom visual themes, populating database tables, and decoding audio tracks. Please do not close this browser tab.'}
            </p>
            
            {/* Status message */}
            <div className="w-full bg-black/40 border border-zinc-900 px-4 py-3 rounded-2xl mb-6">
              <span className="text-[11px] font-mono font-bold text-green-455 block animate-pulse">
                {isExporting ? exportStatus : importStatus}
              </span>
            </div>
            
            {/* Progress bar */}
            {((isExporting && exportTotal > 0) || (isImporting && importTotal > 0)) && (
              <div className="w-full animate-slide-up">
                <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 mb-1">
                  <span>PROGRESS</span>
                  <span>
                    {isExporting 
                      ? `${exportProgress}/${exportTotal} SONGS` 
                      : `${importProgress}/${importTotal} SONGS`}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-850">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                    style={{ 
                      width: `${
                        isExporting 
                          ? (exportProgress / exportTotal) * 100 
                          : (importProgress / importTotal) * 100
                      }%` 
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200]">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative">
            <button 
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Plus size={20} className="text-green-500" /> Create Custom Playlist
            </h2>
            <form onSubmit={handleCreatePlaylist} className="flex flex-col gap-4">
              <input 
                type="text" 
                placeholder="Give your playlist a cool name..." 
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                maxLength={32}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 font-semibold"
                autoFocus
              />
              <button 
                type="submit" 
                disabled={!newPlaylistName.trim()}
                className="bg-green-500 text-black py-3 rounded-xl font-bold text-sm hover:scale-105 hover:bg-green-400 disabled:opacity-50 disabled:scale-100 transition shadow-lg"
              >
                Create Playlist
              </button>
            </form>
          </div>
        </div>
      )}

      {showAiModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] px-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setShowAiModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Bot size={20} className="text-green-500" /> AI Mood Playlist
            </h2>
            <p className="text-xs text-zinc-400 mb-5 font-semibold">
              Gemini runs when `GEMINI_API_KEY` is configured; otherwise ADIFY uses the local mood fallback.
            </p>
            <form onSubmit={handleGenerateAiPlaylist} className="flex flex-col gap-4">
              <textarea
                placeholder="late night coding, Punjabi gym energy, calm focus..."
                value={aiPrompt}
                onChange={(e) => {
                  setAiPrompt(e.target.value);
                  setAiResolvedOptions([]);
                }}
                maxLength={160}
                className="w-full min-h-28 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 font-semibold resize-none"
                autoFocus
              />
              <button 
                type="submit"
                disabled={!aiPrompt.trim() || isGeneratingAi}
                className="bg-green-500 text-black py-3 rounded-xl font-bold text-sm hover:scale-105 hover:bg-green-400 disabled:opacity-50 disabled:scale-100 transition shadow-lg flex items-center justify-center gap-2"
              >
                {isGeneratingAi ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Generate and Play
              </button>
            </form>
            {aiResolvedOptions.length > 0 && (
              <div className="mt-5 border-t border-zinc-800 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-green-400">Choose A Match</h3>
                  <button
                    onClick={() => {
                      setSong(aiResolvedOptions[0], aiResolvedOptions);
                      setShowAiModal(false);
                      triggerToast(`Playing AI Mix: "${aiMixTitle}"`);
                    }}
                    className="text-[10px] font-black text-black bg-green-500 px-3 py-1.5 rounded-full hover:bg-green-400 transition"
                  >
                    Play All
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
                  {aiResolvedOptions.map((song, index) => (
                    <button
                      key={`${song.id}-${index}`}
                      onClick={() => {
                        setSong(song, aiResolvedOptions);
                        setShowAiModal(false);
                        triggerToast(`Playing "${song.title}" from AI Mix`);
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-left transition group"
                    >
                      <div className="w-11 h-11 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                        {song.image ? (
                          <img src={song.image} alt={song.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music size={18} className="text-zinc-600" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-white truncate group-hover:text-green-400">{song.title}</div>
                        <div className="text-xs text-zinc-400 truncate">{song.artist}</div>
                      </div>
                      <span className="text-[9px] uppercase font-black text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">
                        {song.source || 'track'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showLyrics && (
        <aside className="fixed right-0 top-0 h-full w-full sm:w-[390px] bg-zinc-950/95 backdrop-blur-xl border-l border-zinc-800 z-[160] shadow-2xl flex flex-col">
          <div className="p-5 border-b border-zinc-900 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-green-400 font-black">Synced Lyrics</div>
              <h2 className="text-lg font-black truncate">{currentSong?.title || 'Nothing playing'}</h2>
              <p className="text-xs text-zinc-400 truncate">{currentSong?.artist || 'Start a song to sync lines'}</p>
            </div>
            <button onClick={() => setShowLyrics(false)} className="text-zinc-500 hover:text-white transition">
              <X size={20} />
            </button>
          </div>
          <canvas ref={visualizerCanvasRef} width={390} height={84} className="w-full h-20 bg-black/30" />
          <div ref={lyricsContainerRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {currentSongLyrics ? (
              currentSongLyrics.map((line, index) => (
                <button
                  key={`${line.time}-${index}`}
                  onClick={() => setTime(line.time)}
                  className={`block w-full text-left py-3 text-lg font-black leading-snug transition ${
                    index === activeLyricIndex ? 'text-green-400 scale-[1.02]' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {line.text}
                </button>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 gap-3">
                <Music size={40} className="text-zinc-700" />
                <p className="font-bold text-sm">No synced lyrics saved for this track yet.</p>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-zinc-950 p-6 hidden md:flex flex-col gap-6 border-r border-zinc-900 shrink-0">
        <div className="text-3xl font-black tracking-tighter text-green-500 mb-4 flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
          <img src="/logo.jpg" alt="ADIFY" className="w-9 h-9 rounded-xl object-cover shadow-[0_0_15px_rgba(34,197,94,0.3)] border border-green-500/25" /> ADIFY
        </div>
        
        <nav className="flex flex-col gap-5 font-bold text-zinc-400">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex items-center gap-4 transition text-left ${activeTab === 'home' ? 'text-white' : 'hover:text-white'}`}
          >
            <Home size={22} className={activeTab === 'home' ? 'text-green-500' : ''} /> Home
          </button>
          <button 
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-4 transition text-left ${activeTab === 'search' ? 'text-white' : 'hover:text-white'}`}
          >
            <Search size={22} className={activeTab === 'search' ? 'text-green-500' : ''} /> Search
          </button>
          <button 
            onClick={() => setActiveTab('liked')}
            className={`flex items-center gap-4 transition text-left ${activeTab === 'liked' ? 'text-white' : 'hover:text-white'}`}
          >
            <Heart size={22} className={activeTab === 'liked' ? 'text-green-500' : ''} /> Liked Songs
          </button>
          <button 
            onClick={() => setActiveTab('downloads')}
            className={`flex items-center gap-4 transition text-left ${activeTab === 'downloads' ? 'text-white' : 'hover:text-white'}`}
          >
            <Download size={22} className={activeTab === 'downloads' ? 'text-green-500' : ''} /> Downloads
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-4 transition text-left ${activeTab === 'settings' ? 'text-white' : 'hover:text-white'}`}
          >
            <Settings size={22} className={activeTab === 'settings' ? 'text-green-500' : ''} /> Settings
          </button>
        </nav>
        
        <div className="mt-4 flex-1 flex flex-col min-h-0">
          <div className="text-xs tracking-widest text-zinc-500 uppercase font-black mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2"><Library size={14} /> PLAYLISTS</span>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition"
              title="Create Custom Playlist"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <ul className="flex flex-col gap-2.5 text-sm text-zinc-400 font-bold overflow-y-auto pr-2 custom-scrollbar">
            <li 
              onClick={() => setActiveTab('liked')} 
              className={`hover:text-white cursor-pointer transition flex items-center gap-2.5 p-1.5 rounded-lg ${activeTab === 'liked' ? 'bg-zinc-900 text-white' : ''}`}
            >
              <span className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center text-white text-[11px] shadow-md">❤</span>
              Liked Songs ({likedSongs.length})
            </li>

            {playlists.map((pl) => (
              <li 
                key={pl.id}
                onClick={() => {
                  setSelectedPlaylistId(pl.id);
                  setActiveTab('playlist');
                }}
                className={`hover:text-white cursor-pointer transition flex items-center justify-between p-1.5 rounded-lg group ${activeTab === 'playlist' && selectedPlaylistId === pl.id ? 'bg-zinc-900 text-white' : ''}`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="w-7 h-7 bg-gradient-to-tr from-zinc-800 to-zinc-700 rounded flex items-center justify-center text-zinc-300 text-xs shadow-md"><ListMusic size={14} /></span>
                  <span className="truncate">{pl.name}</span>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePlaylist(pl.id);
                    triggerToast(`Deleted playlist "${pl.name}"`);
                    if (selectedPlaylistId === pl.id) setActiveTab('home');
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-gradient-to-b from-zinc-900 to-black overflow-y-auto pb-32">
        
        {/* Mobile Header / Nav */}
        <header className="flex md:hidden items-center justify-between p-4 bg-zinc-950/80 sticky top-0 backdrop-blur-md z-30 border-b border-zinc-900">
          <div className="text-2xl font-black tracking-tighter text-green-500 flex items-center gap-2" onClick={() => setActiveTab('home')}>
            <img src="/logo.jpg" alt="ADIFY" className="w-7 h-7 rounded-lg object-cover shadow-[0_0_10px_rgba(34,197,94,0.25)] border border-green-500/20" /> ADIFY
          </div>
          <div className="flex gap-2 sm:gap-4 items-center">
            <button onClick={() => setActiveTab('home')} className={`p-1.5 rounded-full ${activeTab === 'home' ? 'text-green-500 bg-zinc-900 shadow-inner' : 'text-zinc-400'}`}>
              <Home size={18} />
            </button>
            <button onClick={() => setActiveTab('search')} className={`p-1.5 rounded-full ${activeTab === 'search' ? 'text-green-500 bg-zinc-900 shadow-inner' : 'text-zinc-400'}`}>
              <Search size={18} />
            </button>
            <button onClick={() => setActiveTab('liked')} className={`p-1.5 rounded-full ${activeTab === 'liked' ? 'text-green-500 bg-zinc-900 shadow-inner' : 'text-zinc-400'}`}>
              <Heart size={18} />
            </button>
            <button onClick={() => setActiveTab('downloads')} className={`p-1.5 rounded-full ${activeTab === 'downloads' ? 'text-green-500 bg-zinc-900 shadow-inner' : 'text-zinc-400'}`}>
              <Download size={18} />
            </button>
            <button onClick={() => setActiveTab('settings')} className={`p-1.5 rounded-full ${activeTab === 'settings' ? 'text-green-500 bg-zinc-900 shadow-inner' : 'text-zinc-400'}`}>
              <Settings size={18} />
            </button>
            <button onClick={() => setShowCreateModal(true)} className="p-1.5 text-zinc-400 hover:text-white">
              <Plus size={18} />
            </button>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between p-6 sticky top-0 bg-zinc-950/20 backdrop-blur-md z-10">
          <div className="flex gap-2">
            <button className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-zinc-400 hover:text-white transition">&lt;</button>
            <button className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-zinc-400 hover:text-white transition">&gt;</button>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowAiModal(true)}
              className="flex items-center gap-2 bg-green-500 text-black px-3 py-1.5 rounded-full text-xs font-black hover:bg-green-400 transition"
              title="Generate mood playlist"
            >
              <Bot size={14} /> AI Mix
            </button>
            <button
              onClick={startVoiceAssistant}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black transition ${
                isListeningVoice ? 'bg-red-500/15 text-red-300 border-red-500/40' : 'bg-black/45 text-zinc-300 border-zinc-800 hover:text-white'
              }`}
              title="Voice Assistant"
            >
              <Mic size={14} /> {isListeningVoice ? voiceCommandText : 'Voice'}
            </button>
            <div className="flex items-center gap-1 bg-black/45 px-2 py-1 rounded-full border border-zinc-800">
              <Palette size={14} className="text-zinc-400" />
              {THEMES.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleThemeChange(item.id)}
                  className={`w-5 h-5 rounded-full ${item.swatch} ${theme === item.id ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : 'opacity-70 hover:opacity-100'} transition`}
                  title={`${item.name} Theme`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 bg-black/45 px-3 py-1.5 rounded-full border border-zinc-800 text-xs font-bold text-green-400">
              <Sparkles size={14} /> AD-FREE STREAMING
            </div>
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-600 hover:scale-105 cursor-pointer transition flex items-center justify-center font-bold text-xs text-green-500">AD</div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="p-4 md:p-8">
          
          {/* HOME TAB */}
          {activeTab === 'home' && (
            <div>
              {/* Premium Welcome Glassmorphic Banner */}
              <div className="mb-8 bg-gradient-to-r from-green-500/15 via-blue-500/10 to-indigo-500/15 p-6 md:p-8 rounded-3xl border border-zinc-800/80 shadow-2xl relative overflow-hidden">
                <div className="relative z-10 max-w-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full shadow-inner">⚡ Premium Music Center</span>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-3 mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-100 to-zinc-400">Your Sound. Your Rules.</h1>
                  <p className="text-sm text-zinc-300 leading-relaxed font-semibold">
                    Stream millions of tracks completely ad-free. Decrypt premium tracks instantly, search global matches, build offline-first custom playlists, and discover intelligent recommendations.
                  </p>
                  <form 
                    onSubmit={(e) => {
                      handleSearch(e);
                      setActiveTab('search');
                    }}
                    className="mt-6 flex flex-col sm:flex-row gap-2 max-w-lg"
                  >
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search songs, artists, albums..."
                        className="w-full pl-11 pr-4 py-3 bg-black/45 border border-zinc-800 rounded-full focus:outline-none focus:border-green-500 transition text-white placeholder-zinc-500 font-semibold text-sm shadow-inner"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!searchQuery.trim()}
                      className="bg-green-500 text-black px-6 py-3 rounded-full font-black text-xs hover:scale-105 hover:bg-green-400 disabled:opacity-50 disabled:scale-100 transition shadow-lg shadow-green-500/10"
                    >
                      Search
                    </button>
                  </form>
                  <div className="flex items-center gap-3 mt-6">
                    <button 
                      onClick={() => setActiveTab('search')}
                      className="bg-green-500 text-black px-6 py-2.5 rounded-full font-black text-xs hover:scale-105 hover:bg-green-400 transition shadow-lg shadow-green-500/10"
                    >
                      Start Listening
                    </button>
                    <button 
                      onClick={() => setShowCreateModal(true)}
                      className="bg-zinc-800 border border-zinc-700 text-white px-5 py-2.5 rounded-full font-black text-xs hover:scale-105 hover:bg-zinc-700 transition"
                    >
                      + Create Playlist
                    </button>
                  </div>
                </div>
                <div className="absolute right-0 bottom-0 opacity-10 translate-x-12 translate-y-12 shrink-0 pointer-events-none">
                  <img src="/logo.jpg" alt="" className="w-[280px] h-[280px] rounded-full object-cover animate-spin-slow" />
                </div>
              </div>

              {/* Playback History Section (Recently Played) */}
              {recentSongs.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl md:text-2xl font-black mb-4 flex items-center gap-2.5 text-zinc-100">
                    <Clock size={20} className="text-green-500" /> Recently Played
                  </h2>
                  <div className="flex gap-4 overflow-x-auto pb-4 pr-4 scrollbar-thin scrollbar-thumb-zinc-800">
                    {recentSongs.slice(0, 8).map((song) => (
                      <div 
                        key={song.id} 
                        className="w-[140px] md:w-[160px] p-3.5 bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-900/60 rounded-2xl transition cursor-pointer group shrink-0"
                        onClick={() => setSong(song, recentSongs)}
                      >
                        <div className="w-full aspect-square bg-zinc-800 rounded-xl mb-3 shadow-md relative overflow-hidden">
                          {song.image ? (
                            <img src={song.image} alt={song.title} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                              <Music size={28} className="text-zinc-600" />
                            </div>
                          )}
                          <div className="absolute bottom-2.5 right-2.5 w-9 h-9 bg-green-500 rounded-full flex items-center justify-center text-black opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 shadow-lg z-10">
                            {currentSong?.id === song.id && isPlaying ? (
                              <Pause size={14} fill="currentColor" />
                            ) : (
                              <Play size={14} fill="currentColor" className="ml-0.5" />
                            )}
                          </div>
                        </div>
                        <h3 className="font-bold text-white mb-0.5 truncate text-xs">{song.title}</h3>
                        <p className="text-[10px] text-zinc-400 truncate">{song.artist}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Trending Indian Hits Section */}
              <div className="mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                  <h2 className="text-xl md:text-2xl font-black flex items-center gap-2.5 text-zinc-100">
                    <Music size={20} className="text-green-500" /> Trending Indian Hits
                  </h2>
                  
                  {/* Language Tab Selectors with Customize Config Cog */}
                  <div className="flex items-center gap-3 relative">
                    <div className="flex bg-zinc-900 border border-zinc-800 p-1.5 rounded-full w-fit shadow-inner overflow-x-auto max-w-[240px] sm:max-w-none scrollbar-none">
                      {activeLanguages.map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setFeaturedLanguage(lang)}
                          className={`px-4 py-1.5 rounded-full text-xs font-black transition whitespace-nowrap ${
                            featuredLanguage === lang 
                              ? 'bg-green-500 text-black shadow-md' 
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          {getLanguageName(lang)}
                        </button>
                      ))}
                    </div>

                    {/* Manage Tabs settings button */}
                    <button
                      onClick={() => setShowLanguageSettings(!showLanguageSettings)}
                      className={`p-2 rounded-full border border-zinc-800 transition shadow-md flex items-center justify-center hover:scale-105 ${
                        showLanguageSettings ? 'bg-green-500 text-black border-green-400' : 'bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700'
                      }`}
                      title="Manage Trending Tabs"
                    >
                      <Settings size={16} />
                    </button>

                    {/* Glassmorphic Dropdown Popover */}
                    {showLanguageSettings && (
                      <div className="absolute right-0 top-12 z-40 w-64 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 p-4 rounded-2xl shadow-2xl animate-fade-in flex flex-col gap-2.5">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-1">
                          <span className="text-xs font-black text-white uppercase tracking-wider">Trending Charts</span>
                          <button 
                            onClick={() => setShowLanguageSettings(false)}
                            className="text-zinc-500 hover:text-white transition"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
                          <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-1 block">Presets</span>
                          {AVAILABLE_LANGUAGES.map((lang) => {
                            const isActive = activeLanguages.includes(lang.id);
                            return (
                              <button
                                key={lang.id}
                                onClick={() => handleToggleLanguage(lang.id)}
                                className={`flex items-center justify-between w-full p-2 rounded-lg text-left text-xs font-semibold transition ${
                                  isActive 
                                    ? 'bg-white/5 text-green-500' 
                                    : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                                }`}
                              >
                                <span>{lang.name}</span>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                  isActive ? 'border-green-500 bg-green-500 text-black' : 'border-zinc-700 bg-zinc-900'
                                }`}>
                                  {isActive && <div className="text-[10px] font-black">✓</div>}
                                </div>
                              </button>
                            );
                          })}

                          {/* Suggested Dialects */}
                          <div className="flex flex-col gap-1 border-t border-zinc-900 pt-2.5 mt-1">
                            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-1 block">Suggested Dialects</span>
                            <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                              {POPULAR_REGIONAL_PRESETS.map((lang) => {
                                const isAdded = AVAILABLE_LANGUAGES.some(l => l.id === lang.id) || customLanguages.some(l => l.id === lang.id);
                                if (isAdded) return null;
                                return (
                                  <button
                                    key={lang.id}
                                    onClick={() => handleAddCustomLanguage(lang.name)}
                                    className="px-2 py-0.5 bg-zinc-900 hover:bg-green-500/10 border border-zinc-800 hover:border-green-500/30 text-[9px] font-bold text-zinc-400 hover:text-green-400 rounded-md transition shrink-0"
                                  >
                                    + {lang.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Custom Languages */}
                          {customLanguages.length > 0 && (
                            <div className="flex flex-col gap-1 border-t border-zinc-800 pt-2.5 mt-1.5">
                              <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-1 block">Custom Languages</span>
                              {customLanguages.map((lang) => {
                                const isActive = activeLanguages.includes(lang.id);
                                return (
                                  <div key={lang.id} className="flex items-center justify-between w-full group">
                                    <button
                                      onClick={() => handleToggleLanguage(lang.id)}
                                      className={`flex items-center justify-between flex-1 p-2 rounded-lg text-left text-xs font-semibold transition ${
                                        isActive 
                                          ? 'bg-white/5 text-green-500' 
                                          : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                                      }`}
                                    >
                                      <span className="truncate">{lang.name}</span>
                                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ml-2 ${
                                        isActive ? 'border-green-500 bg-green-500 text-black' : 'border-zinc-700 bg-zinc-900'
                                      }`}>
                                        {isActive && <div className="text-[10px] font-black">✓</div>}
                                      </div>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteCustomLanguage(lang.id, lang.name);
                                      }}
                                      className="p-1.5 text-zinc-500 hover:text-red-500 transition opacity-0 group-hover:opacity-100 ml-1 shrink-0"
                                      title="Delete custom language"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Add Custom Language Form inside Popover */}
                        <div className="border-t border-zinc-800 pt-2.5 mt-1 flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Add language: e.g. Pahari"
                            value={customLanguageInput}
                            onChange={(e) => setCustomLanguageInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddCustomLanguage(customLanguageInput);
                              }
                            }}
                            className="bg-black/60 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-[10px] text-white placeholder-zinc-650 focus:outline-none focus:border-green-500/50 w-full"
                          />
                          <button
                            onClick={() => handleAddCustomLanguage(customLanguageInput)}
                            className="bg-green-500 hover:bg-green-400 text-black font-extrabold px-2.5 rounded-xl text-[10px] shrink-0 transition"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {loadingFeatured ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-400 bg-zinc-950/20 border border-zinc-900/60 rounded-2xl">
                    <Loader2 size={32} className="animate-spin text-green-500" />
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 animate-pulse">Tuning to the frequency...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {featuredSongs[featuredLanguage]?.slice(0, 10).map((song) => (
                      <div 
                        key={song.id} 
                        className="p-3.5 bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-900/60 hover:border-zinc-800/80 transition rounded-2xl cursor-pointer group flex flex-col justify-between"
                      >
                        <div 
                          className="w-full aspect-square bg-zinc-800 rounded-xl mb-3 shadow-lg relative overflow-hidden"
                          onClick={() => setSong(song, featuredSongs[featuredLanguage])}
                        >
                          {song.image ? (
                            <img src={song.image} alt={song.title} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                              <Music size={32} className="text-zinc-600" />
                            </div>
                          )}
                          <div className="absolute bottom-2.5 right-2.5 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-black opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 shadow-xl hover:scale-105 z-10">
                            {currentSong?.id === song.id && isPlaying ? (
                              <Pause size={16} fill="currentColor" />
                            ) : (
                              <Play size={16} fill="currentColor" className="ml-0.5" />
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0" onClick={() => setSong(song, featuredSongs[featuredLanguage])}>
                            <h3 className="font-bold text-white mb-0.5 truncate text-xs">{song.title}</h3>
                            <p className="text-[10px] text-zinc-400 truncate">{song.artist}</p>
                          </div>
                          
                          {/* Floating Plus menu trigger */}
                          <div className="relative">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActivePlaylistMenuSongId(
                                  activePlaylistMenuSongId === song.id ? null : song.id
                                );
                              }}
                              className="p-1 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition"
                            >
                              <Plus size={14} />
                            </button>

                            {/* Dropdown Menu */}
                            {activePlaylistMenuSongId === song.id && (
                              <div className="absolute right-0 bottom-6 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-2 w-44 z-[99] max-h-48 overflow-y-auto">
                                <div className="text-[9px] font-black tracking-wider text-zinc-500 uppercase px-2 py-1 border-b border-zinc-900 mb-1">Add to Playlist</div>
                                {playlists.length === 0 ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowCreateModal(true);
                                      setActivePlaylistMenuSongId(null);
                                    }}
                                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold text-green-400 hover:bg-zinc-900 flex items-center gap-1.5 transition"
                                  >
                                    <Plus size={12} /> Create Playlist
                                  </button>
                                ) : (
                                  playlists.map((pl) => (
                                    <button
                                      key={pl.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddSongToPlaylist(pl.id, pl.name, song);
                                      }}
                                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold text-zinc-300 hover:bg-zinc-900 hover:text-white truncate block transition"
                                    >
                                      {pl.name}
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recommended For You Section */}
              <div className="mb-8">
                <h2 className="text-xl md:text-2xl font-black mb-4 flex items-center gap-2.5 text-zinc-100">
                  <Sparkles size={20} className="text-green-500" /> Recommended For You
                </h2>

                {loadingRecs ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-400 bg-zinc-950/20 border border-zinc-900/60 rounded-2xl">
                    <Loader2 size={24} className="animate-spin text-green-500" />
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Generating dynamic playlist...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {recommendedSongs.map((song) => (
                      <div 
                        key={`rec-${song.id}`}
                        className="p-3.5 bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-900/60 hover:border-zinc-800/80 transition rounded-2xl cursor-pointer group flex flex-col justify-between"
                      >
                        <div 
                          className="w-full aspect-square bg-zinc-800 rounded-xl mb-3 shadow-lg relative overflow-hidden"
                          onClick={() => setSong(song, recommendedSongs)}
                        >
                          {song.image ? (
                            <img src={song.image} alt={song.title} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                              <Music size={32} className="text-zinc-600" />
                            </div>
                          )}
                          <div className="absolute bottom-2.5 right-2.5 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-black opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 shadow-xl hover:scale-105 z-10">
                            {currentSong?.id === song.id && isPlaying ? (
                              <Pause size={16} fill="currentColor" />
                            ) : (
                              <Play size={16} fill="currentColor" className="ml-0.5" />
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0" onClick={() => setSong(song, recommendedSongs)}>
                            <h3 className="font-bold text-white mb-0.5 truncate text-xs">{song.title}</h3>
                            <p className="text-[10px] text-zinc-400 truncate">{song.artist}</p>
                          </div>
                          
                          {/* Floating Plus menu trigger */}
                          <div className="relative">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActivePlaylistMenuSongId(
                                  activePlaylistMenuSongId === song.id ? null : song.id
                                );
                              }}
                              className="p-1 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition"
                            >
                              <Plus size={14} />
                            </button>

                            {/* Dropdown Menu */}
                            {activePlaylistMenuSongId === song.id && (
                              <div className="absolute right-0 bottom-6 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-2 w-44 z-[99] max-h-48 overflow-y-auto">
                                <div className="text-[9px] font-black tracking-wider text-zinc-500 uppercase px-2 py-1 border-b border-zinc-900 mb-1">Add to Playlist</div>
                                {playlists.length === 0 ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowCreateModal(true);
                                      setActivePlaylistMenuSongId(null);
                                    }}
                                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold text-green-400 hover:bg-zinc-900 flex items-center gap-1.5 transition"
                                  >
                                    <Plus size={12} /> Create Playlist
                                  </button>
                                ) : (
                                  playlists.map((pl) => (
                                    <button
                                      key={pl.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddSongToPlaylist(pl.id, pl.name, song);
                                      }}
                                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold text-zinc-300 hover:bg-zinc-900 hover:text-white truncate block transition"
                                    >
                                      {pl.name}
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PLAYLIST VIEW TAB */}
          {activeTab === 'playlist' && selectedPlaylist && (
            <div>
              {/* Dynamic colored header */}
              <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 bg-gradient-to-r from-zinc-900 to-zinc-950 p-6 rounded-3xl border border-zinc-800/80 shadow-xl relative">
                <div className="w-28 h-28 sm:w-36 sm:h-36 bg-gradient-to-tr from-green-500/20 via-blue-500/10 to-indigo-500/20 rounded-2xl flex items-center justify-center text-green-500 shadow-2xl border border-zinc-800">
                  <ListMusic size={64} className="animate-pulse" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-green-400 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">Custom Playlist</span>
                  <h1 className="text-3xl sm:text-4xl font-black mt-3 mb-2">{selectedPlaylist.name}</h1>
                  <p className="text-xs text-zinc-400 flex items-center justify-center sm:justify-start gap-2 font-bold">
                    <span>{selectedPlaylist.songs.length} tracks</span>
                    <span>•</span>
                    <span>Created {new Date(selectedPlaylist.createdAt).toLocaleDateString()}</span>
                  </p>
                  <div className="flex items-center justify-center sm:justify-start gap-3 mt-4">
                    {selectedPlaylist.songs.length > 0 && (
                      <button 
                        onClick={() => setSong(selectedPlaylist.songs[0], selectedPlaylist.songs)}
                        className="bg-green-500 text-black px-6 py-2 rounded-full font-black text-xs hover:scale-105 hover:bg-green-400 transition shadow-lg"
                      >
                        Play Playlist
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        deletePlaylist(selectedPlaylist.id);
                        triggerToast(`Deleted playlist "${selectedPlaylist.name}"`);
                        setActiveTab('home');
                      }}
                      className="text-red-400 hover:text-red-300 font-black text-xs px-4 py-2 rounded-full border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition"
                    >
                      Delete Playlist
                    </button>
                    <button
                      onClick={() => handleShare(selectedPlaylist.name, `Check out my ADIFY playlist "${selectedPlaylist.name}" with ${selectedPlaylist.songs.length} tracks.`)}
                      className="text-zinc-300 hover:text-white font-black text-xs px-4 py-2 rounded-full border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition flex items-center gap-2"
                    >
                      <Share2 size={13} /> Share
                    </button>
                    <button
                      onClick={() => handleCollaborativePlaylistShare(selectedPlaylist.id)}
                      className="text-zinc-300 hover:text-white font-black text-xs px-4 py-2 rounded-full border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition flex items-center gap-2"
                    >
                      <Plus size={13} /> Collab Link
                    </button>
                  </div>
                </div>
              </div>

              {selectedPlaylist.songs.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {selectedPlaylist.songs.map((song, index) => (
                    <div 
                      key={song.id} 
                      className={`flex items-center gap-4 p-2 hover:bg-white/5 rounded-xl cursor-pointer group transition ${currentSong?.id === song.id ? 'bg-white/5' : ''}`}
                    >
                      <div className="text-zinc-500 w-6 text-center text-sm font-semibold">{index + 1}</div>
                      <div 
                        className="w-12 h-12 relative rounded-lg overflow-hidden flex-shrink-0" 
                        onClick={() => setSong(song, selectedPlaylist.songs)}
                      >
                        {song.image ? (
                          <img src={song.image} alt={song.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                            <Music size={20} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          {currentSong?.id === song.id && isPlaying ? (
                            <Pause size={16} fill="white" />
                          ) : (
                            <Play size={16} fill="white" className="ml-0.5" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0" onClick={() => setSong(song, selectedPlaylist.songs)}>
                        <div className={`font-bold truncate text-sm ${currentSong?.id === song.id ? 'text-green-500' : 'text-white'}`}>{song.title}</div>
                        <div className="text-xs text-zinc-400 truncate">{song.artist}</div>
                      </div>
                      <div className="text-xs text-zinc-400 hidden sm:block truncate max-w-[150px]">{song.album}</div>
                      
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => toggleLike(song)} 
                          className="text-zinc-400 hover:text-green-500 transition"
                        >
                          <Heart 
                            size={18} 
                            fill={likedSongs.some((s) => s.id === song.id) ? '#22c55e' : 'none'} 
                            className={likedSongs.some((s) => s.id === song.id) ? 'text-green-500' : ''} 
                          />
                        </button>
                        <button 
                          onClick={() => handleDownload(song)} 
                          className="text-zinc-400 hover:text-white transition"
                        >
                          <Download size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            removeSongFromPlaylist(selectedPlaylist.id, song.id);
                            triggerToast(`Removed "${song.title}"`);
                          }}
                          className="text-zinc-500 hover:text-red-400 transition"
                          title="Remove Song from Playlist"
                        >
                          <Trash2 size={18} />
                        </button>
                        <span className="text-xs text-zinc-500 font-mono hidden md:block">
                          {formatTime(song.duration)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950/20 border border-zinc-900/60 rounded-3xl">
                  <Music size={48} className="mb-4 text-zinc-700 animate-bounce" />
                  <p className="font-black text-sm">Your playlist is empty.</p>
                  <p className="text-xs mt-1.5 text-zinc-600">Search for tracks, then use Add to Playlist to customize it.</p>
                  <button 
                    onClick={() => setActiveTab('search')}
                    className="mt-4 bg-zinc-900 border border-zinc-800 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-zinc-800 transition"
                  >
                    Go Search Tracks
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SEARCH TAB */}
          {activeTab === 'search' && (
            <div>
              <div className="max-w-2xl mb-8">
                <h1 className="text-3xl font-black tracking-tight mb-4">Search Music</h1>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                    <input 
                      type="text"
                      placeholder="What do you want to listen to?"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-full focus:outline-none focus:border-green-500 transition text-white placeholder-zinc-500 font-semibold"
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="bg-green-500 text-black px-6 py-3 rounded-full font-bold hover:scale-105 hover:bg-green-400 transition"
                  >
                    Search
                  </button>
                </form>
              </div>

              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-400">
                  <Loader2 size={32} className="animate-spin text-green-500" />
                  <p className="text-sm font-semibold">Digging the crates...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <h2 className="text-xl font-bold mb-2">Search Results</h2>
                  {searchResults.map((song, index) => (
                    <div 
                      key={song.id} 
                      className={`flex items-center gap-4 p-2 hover:bg-white/5 rounded-xl cursor-pointer group transition ${currentSong?.id === song.id ? 'bg-white/5' : ''}`}
                    >
                      <div className="text-zinc-500 w-6 text-center text-sm font-semibold">{index + 1}</div>
                      <div className="w-12 h-12 relative rounded-lg overflow-hidden flex-shrink-0" onClick={() => setSong(song, searchResults)}>
                        {song.image ? (
                          <img src={song.image} alt={song.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                            <Music size={20} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          {currentSong?.id === song.id && isPlaying ? (
                            <Pause size={16} fill="white" />
                          ) : (
                            <Play size={16} fill="white" className="ml-0.5" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0" onClick={() => setSong(song, searchResults)}>
                        <div className={`font-bold truncate text-sm ${currentSong?.id === song.id ? 'text-green-500' : 'text-white'}`}>{song.title}</div>
                        <div className="text-xs text-zinc-400 truncate flex items-center gap-2 mt-0.5">
                          <span className="truncate max-w-[120px] sm:max-w-none">{song.artist}</span>
                          <span className="shrink-0 text-zinc-600 text-[10px]">•</span>
                          {song.source === 'youtube' ? (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-zinc-900 text-[9px] font-extrabold text-blue-400 border border-zinc-800 tracking-wider flex items-center gap-1 shadow-inner">
                              <Sparkles size={8} /> GLOBAL
                            </span>
                          ) : (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-green-500/10 text-[9px] font-extrabold text-green-400 border border-green-500/20 tracking-wider flex items-center gap-1 shadow-inner">
                              <Sparkles size={8} /> PREMIUM
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-400 hidden sm:block truncate max-w-[150px]">{song.album}</div>
                      
                      {/* Action buttons */}
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => toggleLike(song)} 
                          className="text-zinc-400 hover:text-green-500 transition"
                        >
                          <Heart 
                            size={18} 
                            fill={likedSongs.some((s) => s.id === song.id) ? '#22c55e' : 'none'} 
                            className={likedSongs.some((s) => s.id === song.id) ? 'text-green-500' : ''} 
                          />
                        </button>
                        <button 
                          onClick={() => handleDownload(song)} 
                          className="text-zinc-400 hover:text-white transition"
                          title="Download Song"
                        >
                          <Download size={18} />
                        </button>
                        
                        {/* Playlist Add Trigger */}
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActivePlaylistMenuSongId(
                                activePlaylistMenuSongId === song.id ? null : song.id
                              );
                            }}
                            className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-850 rounded-full transition"
                            title="Add to Playlist"
                          >
                            <Plus size={18} />
                          </button>

                          {/* Float Dropdown Menu */}
                          {activePlaylistMenuSongId === song.id && (
                            <div className="absolute right-0 bottom-6 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-2 w-44 z-[99] max-h-48 overflow-y-auto">
                              <div className="text-[9px] font-black tracking-wider text-zinc-500 uppercase px-2 py-1 border-b border-zinc-900 mb-1">Add to Playlist</div>
                              {playlists.length === 0 ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowCreateModal(true);
                                    setActivePlaylistMenuSongId(null);
                                  }}
                                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold text-green-400 hover:bg-zinc-900 flex items-center gap-1.5 transition"
                                >
                                  <Plus size={12} /> Create Playlist
                                </button>
                              ) : (
                                playlists.map((pl) => (
                                  <button
                                    key={pl.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddSongToPlaylist(pl.id, pl.name, song);
                                    }}
                                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold text-zinc-300 hover:bg-zinc-900 hover:text-white truncate block transition"
                                  >
                                    {pl.name}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>

                        <span className="text-xs text-zinc-500 font-mono hidden md:block">
                          {formatTime(song.duration)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchQuery.trim() ? (
                <div className="text-zinc-500 py-10 font-semibold text-center">No songs found. Try checking the spelling or searching a different term!</div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-zinc-500">
                  <Music size={48} className="mb-4 text-zinc-700" />
                  <p className="font-semibold">Type a song, artist, or album to stream ad-free!</p>
                </div>
              )}
            </div>
          )}

          {/* DOWNLOADS TAB */}
          {activeTab === 'downloads' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-gradient-to-r from-zinc-900 to-zinc-950 p-6 rounded-2xl border border-zinc-800/80">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-green-400">IndexedDB Queue</span>
                  <h1 className="text-3xl sm:text-4xl font-black mt-1">Offline Downloads</h1>
                  <p className="text-sm text-zinc-400 mt-2">{offlineSongs.length} tracks cached for browser playback</p>
                </div>
                <button
                  onClick={loadOfflineSongs}
                  className="bg-zinc-900 border border-zinc-800 text-white px-4 py-2 rounded-full text-xs font-black hover:bg-zinc-800 transition flex items-center gap-2 justify-center"
                >
                  <Radio size={14} /> Refresh Queue
                </button>
              </div>

              {offlineSongs.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {offlineSongs.map((entry, index) => {
                    const song = entry.songData as Song;
                    return (
                      <div 
                        key={entry.id}
                        className={`flex items-center gap-4 p-2.5 hover:bg-white/5 rounded-xl cursor-pointer group transition ${
                          currentSong?.id === song.id ? 'bg-white/5' : ''
                        }`}
                      >
                        <div className="text-zinc-500 w-6 text-center text-sm font-semibold">{index + 1}</div>
                        <div className="w-12 h-12 relative rounded-lg overflow-hidden flex-shrink-0" onClick={() => playSong(song, offlineSongs.map((item) => item.songData as Song))}>
                          {song.image ? (
                            <img src={song.image} alt={song.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                              <Music size={20} />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            {currentSong?.id === song.id && isPlaying ? (
                              <Pause size={16} fill="white" />
                            ) : (
                              <Play size={16} fill="white" className="ml-0.5" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0" onClick={() => playSong(song, offlineSongs.map((item) => item.songData as Song))}>
                          <div className={`font-bold truncate text-sm ${currentSong?.id === song.id ? 'text-green-500' : 'text-white'}`}>{song.title}</div>
                          <div className="text-xs text-zinc-400 truncate">{song.artist}</div>
                        </div>
                        <div className="text-xs text-zinc-500 hidden md:block">
                          {new Date(entry.downloadedAt).toLocaleDateString()}
                        </div>
                        <button
                          onClick={() => handleDeleteOfflineSong(entry.id)}
                          className="text-zinc-500 hover:text-red-400 transition"
                          title="Remove offline download"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950/20 border border-zinc-900/60 rounded-3xl">
                  <Download size={48} className="mb-4 text-zinc-700" />
                  <p className="font-semibold">No offline tracks yet.</p>
                  <p className="text-sm mt-1 text-zinc-600">Use the download button beside any song to cache it here.</p>
                </div>
              )}
            </div>
          )}

          {/* LIKED SONGS TAB */}
          {activeTab === 'liked' && (
            <div>
              <div className="flex items-center gap-6 mb-8 bg-gradient-to-r from-purple-900/50 to-indigo-900/30 p-6 rounded-2xl border border-zinc-800/80">
                <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-5xl shadow-2xl">
                  ❤
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-purple-400">PLAYLIST</span>
                  <h1 className="text-3xl sm:text-4xl font-black mt-1">Liked Songs</h1>
                  <p className="text-sm text-zinc-400 mt-2">{likedSongs.length} songs saved offline in your browser</p>
                </div>
              </div>

              {likedSongs.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {likedSongs.map((song, index) => (
                    <div 
                      key={song.id} 
                      draggable={true}
                      onDragStart={(e) => {
                        if (!isHoldingHandle) {
                          e.preventDefault();
                          return;
                        }
                        setDraggingIndex(index);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnter={() => handleDragEnter(index)}
                      onDragEnd={() => {
                        setDraggingIndex(null);
                        setIsHoldingHandle(false);
                      }}
                      className={`flex items-center gap-4 p-2.5 hover:bg-white/5 rounded-xl cursor-pointer group transition select-none ${
                        currentSong?.id === song.id ? 'bg-white/5' : ''
                      } ${
                        draggingIndex === index 
                          ? 'opacity-40 border border-dashed border-green-500 bg-green-500/5 scale-[0.98]' 
                          : 'border border-transparent'
                      }`}
                    >
                      {/* Drag handle, reorder buttons, and index number */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div 
                          className="text-zinc-650 hover:text-zinc-400 active:text-green-500 cursor-grab active:cursor-grabbing p-1 transition-colors flex items-center justify-center rounded-lg hover:bg-white/5"
                          title="Hold and drag to reorder"
                          onMouseDown={() => setIsHoldingHandle(true)}
                          onMouseUp={() => setIsHoldingHandle(false)}
                          onTouchStart={() => setIsHoldingHandle(true)}
                          onTouchEnd={() => setIsHoldingHandle(false)}
                        >
                          <GripVertical size={16} />
                        </div>
                        
                        {/* Quick Up/Down Chevron reorder buttons (visible on hover) */}
                        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-150 -mx-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSong(index, 'up');
                            }}
                            disabled={index === 0}
                            className="text-zinc-500 hover:text-green-400 disabled:opacity-20 disabled:hover:text-zinc-500 p-0.25 transition-colors"
                            title="Move Up"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSong(index, 'down');
                            }}
                            disabled={index === likedSongs.length - 1}
                            className="text-zinc-500 hover:text-green-400 disabled:opacity-20 disabled:hover:text-zinc-500 p-0.25 transition-colors"
                            title="Move Down"
                          >
                            <ChevronDown size={12} />
                          </button>
                        </div>

                        <div className="text-zinc-500 w-5 text-center text-xs font-bold ml-1">{index + 1}</div>
                      </div>

                      <div className="w-12 h-12 relative rounded-lg overflow-hidden flex-shrink-0" onClick={() => setSong(song, likedSongs)}>
                        {song.image ? (
                          <img src={song.image} alt={song.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                            <Music size={20} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          {currentSong?.id === song.id && isPlaying ? (
                            <Pause size={16} fill="white" />
                          ) : (
                            <Play size={16} fill="white" className="ml-0.5" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0" onClick={() => setSong(song, likedSongs)}>
                        <div className={`font-bold truncate text-sm ${currentSong?.id === song.id ? 'text-green-500' : 'text-white'}`}>{song.title}</div>
                        <div className="text-xs text-zinc-400 truncate">{song.artist}</div>
                      </div>
                      <div className="text-xs text-zinc-400 hidden sm:block truncate max-w-[150px]">{song.album}</div>
                      
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => toggleLike(song)} 
                          className="text-green-500 hover:text-zinc-400 transition"
                        >
                          <Heart size={18} fill="#22c55e" />
                        </button>
                        <button 
                          onClick={() => handleDownload(song)} 
                          className="text-zinc-400 hover:text-white transition"
                        >
                          <Download size={18} />
                        </button>
                        <span className="text-xs text-zinc-500 font-mono hidden md:block">
                          {formatTime(song.duration)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-zinc-500">
                  <Heart size={48} className="mb-4 text-zinc-700" />
                  <p className="font-semibold">Your liked songs list is empty.</p>
                  <p className="text-sm mt-1 text-zinc-600">Heart a song during a search to save it here!</p>
                </div>
              )}
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="max-w-4xl mx-auto pb-12 animate-fade-in">
              <div className="flex items-center gap-6 mb-8 bg-gradient-to-r from-zinc-900 via-zinc-950 to-black p-6 rounded-3xl border border-zinc-800/80 shadow-xl">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex flex-shrink-0 items-center justify-center text-black text-2xl shadow-2xl">
                  <Settings className="animate-spin-slow text-zinc-950" size={32} />
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight">App Settings</h1>
                  <p className="text-sm text-zinc-400 mt-1">Configure your workspace skins, active music dialects, and export/import device backup profiles.</p>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                
                {/* THEME PICKER SKINS */}
                <div className="bg-zinc-900/40 backdrop-blur-md p-6 rounded-3xl border border-zinc-800/60 shadow-lg">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-white mb-2">
                    <Palette className="text-green-400" size={20} /> Personalization Skins
                  </h2>
                  <p className="text-xs text-zinc-400 mb-6">Choose a curated visual style to adapt active status lights, seek bars, and background highlights.</p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {THEMES.map((themeOption) => (
                      <button
                        key={themeOption.id}
                        onClick={() => handleThemeChange(themeOption.id)}
                        className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all duration-300 ${
                          theme === themeOption.id
                            ? 'bg-white/5 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.15)] scale-[1.03]'
                            : 'bg-black/20 border-zinc-800 hover:border-zinc-700 hover:bg-white/5 hover:scale-[1.01]'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full ${themeOption.swatch} flex items-center justify-center shadow-lg relative`}>
                          {theme === themeOption.id && (
                            <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-white flex items-center justify-center">
                              <div className="w-2.5 h-2.5 bg-white rounded-full" />
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-bold tracking-wide text-zinc-200">{themeOption.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ACTIVE DIALECTS / MUSIC LANGUAGES */}
                <div className="bg-zinc-900/40 backdrop-blur-md p-6 rounded-3xl border border-zinc-800/60 shadow-lg flex flex-col gap-6">
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-2 text-white mb-2">
                      <Radio className="text-green-400 animate-pulse" size={20} /> Regional & Global Music Zones
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Select your default trending music zones. Checked zones will fetch live JioSaavn charts and display them on your Home dashboard tabs.
                    </p>
                  </div>
                  
                  {/* Preset Zones */}
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-zinc-550 block mb-3">Preset Charts</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {AVAILABLE_LANGUAGES.map((lang) => {
                        const isActive = activeLanguages.includes(lang.id);
                        return (
                          <button
                            key={lang.id}
                            onClick={() => handleToggleLanguage(lang.id)}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-bold transition-all duration-200 ${
                              isActive
                                ? 'bg-green-500/10 border-green-500 text-green-400'
                                : 'bg-black/25 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                            }`}
                          >
                            <span>{lang.name}</span>
                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all shrink-0 ml-2 ${
                              isActive ? 'border-green-500 bg-green-500 text-black' : 'border-zinc-700 bg-transparent'
                            }`}>
                              {isActive && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Custom / Added Zones */}
                  {customLanguages.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-widest text-zinc-550 block mb-3">Active Custom Dialects</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {customLanguages.map((lang) => {
                          const isActive = activeLanguages.includes(lang.id);
                          return (
                            <div 
                              key={lang.id}
                              className={`flex items-center justify-between pl-4 pr-2 py-3 rounded-xl border text-xs font-bold transition-all duration-200 ${
                                isActive
                                  ? 'bg-green-500/10 border-green-500 text-green-400'
                                  : 'bg-black/25 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                              }`}
                            >
                              <button 
                                onClick={() => handleToggleLanguage(lang.id)}
                                className="flex-1 text-left truncate mr-2"
                              >
                                {lang.name}
                              </button>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => handleToggleLanguage(lang.id)}
                                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                                    isActive ? 'border-green-500 bg-green-500 text-black' : 'border-zinc-700 bg-transparent'
                                  }`}
                                >
                                  {isActive && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteCustomLanguage(lang.id, lang.name)}
                                  className="p-1 text-zinc-500 hover:text-red-500 transition"
                                  title="Remove language"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Recommended Regional Folk Dialects Grid */}
                  <div className="border-t border-zinc-850 pt-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] uppercase font-black tracking-widest text-zinc-550 block">Suggested Regional Dialects & Folk Zones</span>
                      <span className="text-[9px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">Dynamic JioSaavn Scraping</span>
                    </div>
                    <p className="text-xs text-zinc-400 mb-4">Click to instantly enable charts and curated playlists for these beautiful traditional dialect zones of India and the world.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {POPULAR_REGIONAL_PRESETS.map((lang) => {
                        const isAdded = AVAILABLE_LANGUAGES.some(l => l.id === lang.id) || customLanguages.some(l => l.id === lang.id);
                        return (
                          <button
                            key={lang.id}
                            disabled={isAdded}
                            onClick={() => handleAddCustomLanguage(lang.name)}
                            className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all duration-300 ${
                              isAdded
                                ? 'bg-zinc-950/20 border-zinc-900 text-zinc-600 cursor-not-allowed opacity-60'
                                : 'bg-black/30 border-zinc-800/80 hover:border-green-500/40 hover:bg-green-500/[0.02] hover:scale-[1.01] text-zinc-300'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full mb-1">
                              <span className={`text-xs font-black ${isAdded ? 'text-zinc-500' : 'text-white'}`}>{lang.name}</span>
                              {!isAdded && (
                                <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-lg border border-green-500/20 font-bold hover:bg-green-500 hover:text-black transition-all">
                                  + Enable
                                </span>
                              )}
                              {isAdded && (
                                <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-lg border border-zinc-850 font-bold">
                                  Enabled
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-500 leading-normal">{lang.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Add Any Custom Language / Search Query Card */}
                  <div className="border-t border-zinc-850 pt-5 flex flex-col md:flex-row items-center gap-4">
                    <div className="flex-1">
                      <h3 className="text-xs font-black text-white uppercase tracking-wider mb-1">Deploy Custom Dialect Music Charts</h3>
                      <p className="text-xs text-zinc-400">Can't find your dialect in the suggestions? Type any regional language or music genre (e.g. Haryanvi Ragni, Garhwali Nonstop, or K-Pop) to build and deploy its live chart on your Home tab.</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto shrink-0">
                      <input
                        type="text"
                        placeholder="Type any language (e.g. Pahari)..."
                        value={customLanguageInput}
                        onChange={(e) => setCustomLanguageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddCustomLanguage(customLanguageInput);
                          }
                        }}
                        className="bg-black/60 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-green-500 w-64"
                      />
                      <button
                        onClick={() => handleAddCustomLanguage(customLanguageInput)}
                        className="bg-green-500 hover:bg-green-400 text-black font-extrabold px-5 py-2.5 rounded-xl text-xs transition shadow-md hover:scale-[1.02] active:scale-95 shrink-0"
                      >
                        Deploy Dialect
                      </button>
                    </div>
                  </div>
                </div>

                {/* DEVICE SYNC & DATA BACKUPS */}
                <div className="bg-zinc-900/40 backdrop-blur-md p-6 rounded-3xl border border-zinc-800/60 shadow-lg">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-white mb-2">
                    <Disc className="text-green-400 animate-spin-slow" size={20} /> Device Migration & Local Backup
                  </h2>
                  <p className="text-xs text-zinc-400 mb-6">Migrate your entire library, settings, play history, custom playlists, and offline downloaded audio files to any other device (like a new phone or desktop browser).</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* EXPORT BACKUP */}
                    <div className="bg-black/35 p-5 rounded-2xl border border-zinc-800/60 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2">1. Export Backup Profile</h3>
                        <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                          Save your currently stored browser data into a file. You can select to back up just settings & playlists (very fast, extremely lightweight) or download a full media archive containing all cached offline songs.
                        </p>
                      </div>
                      
                      <div className="flex flex-col gap-2.5">
                        <button
                          onClick={() => handleExportBackup(false)}
                          disabled={isExporting || isImporting}
                          className="w-full bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
                        >
                          <Download size={14} /> Export Settings & Playlists Only
                        </button>
                        
                        <button
                          onClick={() => handleExportBackup(true)}
                          disabled={isExporting || isImporting}
                          className="w-full bg-green-500 hover:bg-green-400 text-black font-extrabold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md hover:scale-[1.01] active:scale-95 disabled:opacity-50"
                        >
                          <Download size={14} /> Export Full Backup (+ Cached Music)
                        </button>
                        
                        <div className="text-[10px] text-zinc-550 text-center mt-1">
                          {offlineSongs.length > 0 
                            ? `Full backup will compress ${offlineSongs.length} offline audio files (~${(offlineSongs.length * 4.2).toFixed(1)} MB)`
                            : 'No offline audio songs cached currently.'}
                        </div>
                      </div>
                    </div>

                    {/* IMPORT BACKUP */}
                    <div className="bg-black/35 p-5 rounded-2xl border border-zinc-800/60 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2">2. Import Backup Profile</h3>
                        <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                          Upload a previously exported backup file to synchronize this device instantly. Placing the backup profile here will overwrite your current settings, custom playlists, and sync all imported media files.
                        </p>
                      </div>
                      
                      <div>
                        <label className={`w-full border-2 border-dashed rounded-2xl py-6 px-4 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                          isImporting || isExporting
                            ? 'border-zinc-850 bg-transparent opacity-50 cursor-not-allowed'
                            : 'border-zinc-850 bg-black/20 hover:border-green-500/50 hover:bg-green-500/5 hover:scale-[1.005]'
                        }`}>
                          <input
                            type="file"
                            accept=".json,.zip"
                            onChange={handleImportBackup}
                            disabled={isExporting || isImporting}
                            className="hidden"
                          />
                          <Settings className="text-zinc-650 mb-2" size={24} />
                          <span className="text-xs font-bold text-zinc-300">Select Backup File (.zip or .json)</span>
                          <span className="text-[9px] text-zinc-550 mt-1">Drag and drop file here or click to browse</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* LOCAL STORAGE DATA & CONTENT CENTER - VIRTUAL DIRECTORY EXPLORER */}
                <div className="bg-zinc-900/40 backdrop-blur-md p-6 rounded-3xl border border-zinc-800/60 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                        <Folder className="text-green-400 animate-pulse" size={20} /> ADIFY Local Sandbox Folder Explorer
                      </h2>
                      <p className="text-xs text-zinc-400 mt-1">Explore, preview, play, or wipe files currently saved in your secure local sandbox storage.</p>
                    </div>
                    <button
                      onClick={() => setShowSandboxTree(!showSandboxTree)}
                      className="text-xs font-bold text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 px-3 py-1.5 rounded-xl transition"
                    >
                      {showSandboxTree ? 'Hide Directory Explorer' : 'Show Directory Explorer'}
                    </button>
                  </div>

                  {showSandboxTree && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 border border-zinc-800/50 bg-black/40 rounded-2xl p-5 min-h-[420px] mb-6">
                      
                      {/* Left Pane: Collapsible Directory Tree */}
                      <div className="md:col-span-5 border-r border-zinc-850/60 pr-4 overflow-y-auto max-h-[480px] custom-scrollbar text-xs">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => toggleFolder('root')}
                            className="flex items-center gap-2 w-full text-left p-1.5 rounded-lg hover:bg-white/5 text-white font-black group transition"
                          >
                            {openFolders.root ? <FolderOpen className="text-amber-500" size={16} /> : <Folder className="text-amber-500" size={16} />}
                            <span className="truncate">ADIFY_Sandbox_Memory</span>
                            <span className="text-[10px] text-zinc-500 ml-auto font-mono">
                              ({formatSize(
                                estimateJsonSize({ theme, activeLanguages, customLanguages }) +
                                estimateJsonSize(likedSongs) +
                                estimateJsonSize(playlists) +
                                estimateJsonSize(recentSongs) +
                                offlineSongs.reduce((acc, s) => acc + (s.audioBlob?.size || 0), 0)
                              )})
                            </span>
                          </button>

                          {openFolders.root && (
                            <div className="pl-4 flex flex-col gap-1 border-l border-zinc-850 ml-3 mt-0.5">
                              
                              {/* settings/ */}
                              <div className="flex flex-col">
                                <button
                                  onClick={() => toggleFolder('settings')}
                                  className="flex items-center gap-2 w-full text-left p-1.5 rounded-lg hover:bg-white/5 text-zinc-300 font-bold transition"
                                >
                                  {openFolders.settings ? <FolderOpen className="text-amber-500" size={14} /> : <Folder className="text-amber-500" size={14} />}
                                  <span>settings</span>
                                  <span className="text-[9px] text-zinc-550 ml-auto font-mono">
                                    ({formatSize(estimateJsonSize({ theme, activeLanguages, customLanguages }))})
                                  </span>
                                </button>
                                {openFolders.settings && (
                                  <div className="pl-4 flex flex-col gap-1 border-l border-zinc-850 ml-2.5 mt-0.5">
                                    <button
                                      onClick={() => setSelectedSandboxFile({
                                        name: 'app_config.json',
                                        path: 'ADIFY_Sandbox_Memory/settings/app_config.json',
                                        type: 'json',
                                        content: JSON.stringify({
                                          version: '1.0',
                                          exportedAt: Date.now(),
                                          theme,
                                          activeLanguages,
                                          customLanguages
                                        }, null, 2)
                                      })}
                                      className={`flex items-center gap-1.5 p-1 rounded-md text-left transition ${
                                        selectedSandboxFile?.name === 'app_config.json' ? 'bg-green-500/10 text-green-400 font-extrabold' : 'text-zinc-400 hover:text-zinc-200'
                                      }`}
                                    >
                                      <FileCode size={13} className="text-zinc-500" />
                                      <span className="truncate">app_config.json</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* liked_songs/ */}
                              <div className="flex flex-col">
                                <button
                                  onClick={() => toggleFolder('liked_songs')}
                                  className="flex items-center gap-2 w-full text-left p-1.5 rounded-lg hover:bg-white/5 text-zinc-300 font-bold transition"
                                >
                                  {openFolders.liked_songs ? <FolderOpen className="text-amber-500" size={14} /> : <Folder className="text-amber-500" size={14} />}
                                  <span>liked_songs</span>
                                  <span className="text-[9px] text-zinc-550 ml-auto font-mono">
                                    ({formatSize(estimateJsonSize(likedSongs))})
                                  </span>
                                </button>
                                {openFolders.liked_songs && (
                                  <div className="pl-4 flex flex-col gap-1 border-l border-zinc-850 ml-2.5 mt-0.5">
                                    <button
                                      onClick={() => setSelectedSandboxFile({
                                        name: 'liked_songs_list.json',
                                        path: 'ADIFY_Sandbox_Memory/liked_songs/liked_songs_list.json',
                                        type: 'json',
                                        content: JSON.stringify(likedSongs, null, 2)
                                      })}
                                      className={`flex items-center gap-1.5 p-1 rounded-md text-left transition ${
                                        selectedSandboxFile?.name === 'liked_songs_list.json' ? 'bg-green-500/10 text-green-400 font-extrabold' : 'text-zinc-400 hover:text-zinc-200'
                                      }`}
                                    >
                                      <FileCode size={13} className="text-zinc-500" />
                                      <span className="truncate">liked_songs_list.json</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* playlists/ */}
                              <div className="flex flex-col">
                                <button
                                  onClick={() => toggleFolder('playlists')}
                                  className="flex items-center gap-2 w-full text-left p-1.5 rounded-lg hover:bg-white/5 text-zinc-300 font-bold transition"
                                >
                                  {openFolders.playlists ? <FolderOpen className="text-amber-500" size={14} /> : <Folder className="text-amber-500" size={14} />}
                                  <span>playlists</span>
                                  <span className="text-[9px] text-zinc-550 ml-auto font-mono">
                                    ({formatSize(estimateJsonSize(playlists))})
                                  </span>
                                </button>
                                {openFolders.playlists && (
                                  <div className="pl-4 flex flex-col gap-1 border-l border-zinc-850 ml-2.5 mt-0.5">
                                    <button
                                      onClick={() => setSelectedSandboxFile({
                                        name: 'playlists.json',
                                        path: 'ADIFY_Sandbox_Memory/playlists/playlists.json',
                                        type: 'json',
                                        content: JSON.stringify(playlists, null, 2)
                                      })}
                                      className={`flex items-center gap-1.5 p-1 rounded-md text-left transition ${
                                        selectedSandboxFile?.name === 'playlists.json' ? 'bg-green-500/10 text-green-400 font-extrabold' : 'text-zinc-400 hover:text-zinc-200'
                                      }`}
                                    >
                                      <FileCode size={13} className="text-zinc-500" />
                                      <span className="truncate">playlists.json</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* play_history/ */}
                              <div className="flex flex-col">
                                <button
                                  onClick={() => toggleFolder('play_history')}
                                  className="flex items-center gap-2 w-full text-left p-1.5 rounded-lg hover:bg-white/5 text-zinc-300 font-bold transition"
                                >
                                  {openFolders.play_history ? <FolderOpen className="text-amber-500" size={14} /> : <Folder className="text-amber-500" size={14} />}
                                  <span>play_history</span>
                                  <span className="text-[9px] text-zinc-550 ml-auto font-mono">
                                    ({formatSize(estimateJsonSize(recentSongs))})
                                  </span>
                                </button>
                                {openFolders.play_history && (
                                  <div className="pl-4 flex flex-col gap-1 border-l border-zinc-850 ml-2.5 mt-0.5">
                                    <button
                                      onClick={() => setSelectedSandboxFile({
                                        name: 'history_list.json',
                                        path: 'ADIFY_Sandbox_Memory/play_history/history_list.json',
                                        type: 'json',
                                        content: JSON.stringify(recentSongs, null, 2)
                                      })}
                                      className={`flex items-center gap-1.5 p-1 rounded-md text-left transition ${
                                        selectedSandboxFile?.name === 'history_list.json' ? 'bg-green-500/10 text-green-400 font-extrabold' : 'text-zinc-400 hover:text-zinc-200'
                                      }`}
                                    >
                                      <FileCode size={13} className="text-zinc-500" />
                                      <span className="truncate">history_list.json</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* offline_music_cache/ */}
                              <div className="flex flex-col">
                                <button
                                  onClick={() => toggleFolder('offline_music_cache')}
                                  className="flex items-center gap-2 w-full text-left p-1.5 rounded-lg hover:bg-white/5 text-zinc-300 font-bold transition"
                                >
                                  {openFolders.offline_music_cache ? <FolderOpen className="text-amber-500" size={14} /> : <Folder className="text-amber-500" size={14} />}
                                  <span>offline_music_cache</span>
                                  <span className="text-[9px] text-zinc-555 ml-auto font-mono">
                                    ({formatSize(
                                      estimateJsonSize(offlineSongs.map(s => ({ id: s.id, downloadedAt: s.downloadedAt }))) +
                                      offlineSongs.reduce((acc, s) => acc + (s.audioBlob?.size || 0), 0)
                                    )})
                                  </span>
                                </button>
                                {openFolders.offline_music_cache && (
                                  <div className="pl-4 flex flex-col gap-1 border-l border-zinc-850 ml-2.5 mt-0.5">
                                    <button
                                      onClick={() => setSelectedSandboxFile({
                                        name: 'offline_songs_registry.json',
                                        path: 'ADIFY_Sandbox_Memory/offline_music_cache/offline_songs_registry.json',
                                        type: 'json',
                                        content: JSON.stringify(offlineSongs.map(t => ({
                                          id: t.id,
                                          songData: t.songData,
                                          downloadedAt: t.downloadedAt
                                        })), null, 2)
                                      })}
                                      className={`flex items-center gap-1.5 p-1 rounded-md text-left transition ${
                                        selectedSandboxFile?.name === 'offline_songs_registry.json' ? 'bg-green-500/10 text-green-400 font-extrabold' : 'text-zinc-400 hover:text-zinc-200'
                                      }`}
                                    >
                                      <FileCode size={13} className="text-zinc-500" />
                                      <span className="truncate">offline_songs_registry.json</span>
                                    </button>

                                    {offlineSongs.map((track) => {
                                      const cleanTitle = (track.songData?.title || 'Track').replace(/[/\\?%*:|"<>\s]+/g, '_');
                                      const cleanArtist = (track.songData?.artist || 'Unknown').replace(/[/\\?%*:|"<>\s]+/g, '_');
                                      const filename = `${cleanTitle}_-_${cleanArtist}.mp3`;
                                      
                                      return (
                                        <button
                                          key={track.id}
                                          onClick={() => setSelectedSandboxFile({
                                            name: filename,
                                            path: `ADIFY_Sandbox_Memory/offline_music_cache/${filename}`,
                                            type: 'audio',
                                            content: '',
                                            meta: track
                                          })}
                                          className={`flex items-center gap-1.5 p-1 rounded-md text-left transition ${
                                            selectedSandboxFile?.name === filename ? 'bg-green-500/10 text-green-400 font-extrabold' : 'text-zinc-400 hover:text-zinc-200'
                                          }`}
                                        >
                                          <FileAudio size={13} className="text-zinc-500" />
                                          <span className="truncate max-w-[120px] sm:max-w-none">{filename}</span>
                                          <span className="text-[8px] text-zinc-500 ml-auto font-mono shrink-0">
                                            ({formatSize(track.audioBlob?.size || 0)})
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Pane: Interactive Detail Preview Card */}
                      <div className="md:col-span-7 flex flex-col justify-between bg-black/30 border border-zinc-850/60 rounded-xl p-4 min-h-[320px]">
                        {selectedSandboxFile ? (
                          <div className="flex flex-col h-full justify-between gap-4">
                            <div className="min-h-0 overflow-hidden flex flex-col">
                              <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5 mb-3 shrink-0">
                                <div className="min-w-0">
                                  <h3 className="text-xs font-black text-white truncate max-w-[280px]">{selectedSandboxFile.name}</h3>
                                  <span className="text-[9px] text-zinc-500 font-mono tracking-tighter block truncate">{selectedSandboxFile.path}</span>
                                </div>
                                <span className="bg-zinc-800 text-zinc-350 font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded shrink-0">
                                  {selectedSandboxFile.type}
                                </span>
                              </div>

                              {/* Preview File Content Render */}
                              {selectedSandboxFile.type === 'json' ? (
                                <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-3 max-h-72 overflow-auto font-mono text-[10px] text-green-400 leading-normal custom-scrollbar whitespace-pre-wrap select-all shrink min-h-0">
                                  {selectedSandboxFile.content}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-4 bg-zinc-950 border border-zinc-900 rounded-xl p-4 shrink-0">
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-zinc-900 rounded-lg flex items-center justify-center border border-zinc-800 text-green-500 shadow-inner">
                                      <Music size={22} />
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="text-xs font-black text-white truncate">{selectedSandboxFile.meta?.songData?.title || 'Unknown Title'}</h4>
                                      <p className="text-[10px] text-zinc-400 truncate">by {selectedSandboxFile.meta?.songData?.artist || 'Unknown Artist'}</p>
                                      <p className="text-[8px] text-zinc-550 font-mono mt-0.5">ID: {selectedSandboxFile.meta?.id}</p>
                                    </div>
                                  </div>

                                  <div className="border-t border-zinc-900/60 pt-3 flex flex-col gap-2">
                                    <span className="text-[9px] uppercase font-black tracking-wider text-zinc-500">Live Offline Preview</span>
                                    {previewAudioUrl ? (
                                      <audio 
                                        src={previewAudioUrl} 
                                        controls 
                                        className="w-full h-8 rounded-lg bg-zinc-900" 
                                      />
                                    ) : (
                                      <div className="text-[10px] text-zinc-500 italic">Generating preview link...</div>
                                    )}
                                  </div>

                                  <div className="border-t border-zinc-900/60 pt-3 grid grid-cols-2 gap-3 text-[10px] leading-relaxed text-zinc-400">
                                    <div>
                                      <span className="text-zinc-500 font-bold uppercase block text-[8px]">Album</span>
                                      <span className="truncate block font-semibold text-zinc-300">{selectedSandboxFile.meta?.songData?.album || 'Single'}</span>
                                    </div>
                                    <div>
                                      <span className="text-zinc-500 font-bold uppercase block text-[8px]">Cached At</span>
                                      <span className="block font-semibold text-zinc-300">{new Date(selectedSandboxFile.meta?.downloadedAt).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="border-t border-zinc-850/60 pt-3.5 flex justify-between items-center mt-auto shrink-0">
                              <span className="text-[9px] text-zinc-500 font-mono">
                                Size: {selectedSandboxFile.type === 'json' 
                                  ? formatSize(new Blob([selectedSandboxFile.content]).size) 
                                  : formatSize(selectedSandboxFile.meta?.audioBlob?.size || 0)}
                              </span>
                              
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    const blob = selectedSandboxFile.type === 'json'
                                      ? new Blob([selectedSandboxFile.content], { type: 'application/json' })
                                      : selectedSandboxFile.meta?.audioBlob;
                                    if (!blob) return;
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = selectedSandboxFile.name;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                  }}
                                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-extrabold px-3 py-1.5 rounded-lg text-[10px] transition flex items-center gap-1.5"
                                >
                                  <Download size={11} /> Download File
                                </button>
                                
                                {selectedSandboxFile.type === 'audio' && (
                                  <button
                                    onClick={async () => {
                                      if (confirm(`Are you sure you want to delete ${selectedSandboxFile.name} from offline memory?`)) {
                                        await offlineDb.deleteOfflineSong(selectedSandboxFile.meta.id);
                                        await loadOfflineSongs();
                                        setSelectedSandboxFile(null);
                                        triggerToast('Track removed from offline memory! 🗑️');
                                      }
                                    }}
                                    className="bg-red-650/10 hover:bg-red-600 border border-red-500/20 text-red-500 hover:text-white font-extrabold px-3 py-1.5 rounded-lg text-[10px] transition flex items-center gap-1.5"
                                  >
                                    <Trash2 size={11} /> Wipe Track
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500 text-center m-auto">
                            <Library size={32} className="text-zinc-650 animate-pulse" />
                            <div>
                              <p className="text-xs font-bold text-zinc-400">No File Selected</p>
                              <p className="text-[10px] text-zinc-600 max-w-[240px] mt-1 mx-auto leading-relaxed">
                                Click on any `.json` configuration registry or `.mp3` media track in the folder tree to examine its details.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>

                {/* DANGER ZONE (Factory Reset / Wipe Memory) */}
                <div className="bg-red-950/20 border border-red-900/30 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-sm font-black text-red-400 flex items-center gap-1.5 uppercase tracking-wider mb-1">
                      <AlertTriangle size={15} /> Danger Zone: Factory Reset
                    </h3>
                    <p className="text-[11px] text-zinc-400 leading-relaxed max-w-xl">
                      Irreversibly delete your local history, visual skins, regional dialects checklist, custom playlists, and offline downloaded MP3 files from this browser's memory cache. Ensure you have exported a backup profile if you wish to retain this data.
                    </p>
                  </div>

                  <div>
                    {confirmWipeState === 'idle' && (
                      <button
                        onClick={() => setConfirmWipeState('confirm')}
                        className="bg-red-650/10 hover:bg-red-600 border border-red-500/20 hover:border-red-500 text-red-500 hover:text-white font-extrabold py-2 px-5 rounded-xl text-xs transition shadow-md whitespace-nowrap"
                      >
                        Wipe Device Memory
                      </button>
                    )}
                    
                    {confirmWipeState === 'confirm' && (
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black text-red-400 animate-pulse text-center">Are you 100% sure?</span>
                        <div className="flex gap-2">
                          <button
                            onClick={handleWipeAllData}
                            className="bg-red-600 hover:bg-red-500 text-white font-extrabold py-1.5 px-3 rounded-lg text-[10px] transition shadow-md"
                          >
                            Yes, Delete All
                          </button>
                          <button
                            onClick={() => setConfirmWipeState('idle')}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-1.5 px-3 rounded-lg text-[10px] transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Player Bar */}
      {currentSong && (
        <>
          <footer 
            onClick={() => {
              if (typeof window !== 'undefined' && window.innerWidth < 768) {
                setShowMobileDetails(true);
              }
            }}
            className="h-[72px] md:h-[95px] bg-zinc-950 border-t border-zinc-900 fixed bottom-0 w-full px-4 flex items-center justify-between z-50 shadow-2xl transition-all duration-300 cursor-pointer md:cursor-default select-none"
          >
            {/* Interactive progress bar for mobile */}
            <div className="absolute -top-[10px] left-0 right-0 h-[20px] flex items-center md:hidden z-30" onClick={(e) => e.stopPropagation()}>
              <input 
                type="range"
                min="0"
                max={duration || 100}
                step="0.1"
                value={isSeeking ? tempSeekTime : currentTime}
                onMouseDown={(e) => { e.stopPropagation(); handleSeekStart(); }}
                onTouchStart={(e) => { e.stopPropagation(); handleSeekStart(); }}
                onChange={(e) => { e.stopPropagation(); handleSeekChange(e); }}
                onMouseUp={(e) => { e.stopPropagation(); handleSeekEnd(); }}
                onTouchEnd={(e) => { e.stopPropagation(); handleSeekEnd(); }}
                className="w-full h-[6px] appearance-none bg-zinc-800/40 rounded-full cursor-pointer focus:outline-none z-30 opacity-90"
                style={{
                  background: `linear-gradient(to right, ${
                    theme === 'emerald' ? '#22c55e' : theme === 'sunset' ? '#f97316' : theme === 'cyberpunk' ? '#ec4899' : theme === 'ocean' ? '#06b6d4' : '#8b5cf6'
                  } ${( (isSeeking ? tempSeekTime : currentTime) / (duration || 100) ) * 100}%, rgba(39, 39, 42, 0.4) ${( (isSeeking ? tempSeekTime : currentTime) / (duration || 100) ) * 100}%)`
                }}
              />
            </div>

            {/* Left: Song Info */}
            <div 
              className="flex items-center gap-3 flex-1 md:flex-initial md:w-1/3 min-w-0"
              onClick={(e) => {
                // Let desktop do nothing, mobile can expand drawer
                if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                  e.stopPropagation();
                }
              }}
            >
              <div className="w-12 h-12 md:w-14 md:h-14 bg-zinc-800 rounded shadow-md overflow-hidden relative flex-shrink-0">
                {currentSong.image ? (
                  <img src={currentSong.image} alt={currentSong.title} decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="size-5 md:size-6 text-zinc-400" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs md:text-sm font-bold text-white hover:underline cursor-pointer truncate">{currentSong.title}</div>
                <div className="text-[10px] md:text-xs text-zinc-400 hover:underline cursor-pointer truncate">{currentSong.artist}</div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); toggleLike(currentSong); }} 
                className="text-zinc-400 hover:text-white transition flex-shrink-0 ml-2"
              >
                <Heart 
                  size={18} 
                  fill={likedSongs.some((s) => s.id === currentSong.id) ? (theme === 'emerald' ? '#22c55e' : theme === 'sunset' ? '#f97316' : theme === 'cyberpunk' ? '#ec4899' : theme === 'ocean' ? '#06b6d4' : '#8b5cf6') : 'none'} 
                  className={likedSongs.some((s) => s.id === currentSong.id) ? (theme === 'emerald' ? 'text-green-500' : theme === 'sunset' ? 'text-orange-500' : theme === 'cyberpunk' ? 'text-pink-500' : theme === 'ocean' ? 'text-cyan-500' : 'text-violet-500') : ''} 
                />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDownload(currentSong); }}
                className="text-zinc-400 hover:text-white transition ml-2 z-10"
                title="Download Song"
              >
                <Download size={18} />
              </button>
            </div>
            
            {/* Center: Controls & Slider (Desktop Only) */}
            <div className="hidden md:flex flex-col items-center w-1/3 max-w-[722px] px-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-5 mb-2">
                {/* Shuffle Button */}
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleShuffle(); }} 
                  className={`transition hover:scale-110 ${
                    shuffle 
                      ? theme === 'emerald' ? 'text-green-500' : theme === 'sunset' ? 'text-orange-500' : theme === 'cyberpunk' ? 'text-pink-500' : theme === 'ocean' ? 'text-cyan-500' : 'text-violet-500'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title={shuffle ? 'Shuffle: On' : 'Shuffle: Off'}
                >
                  <Shuffle size={16} />
                </button>

                <button onClick={(e) => { e.stopPropagation(); prev(); }} className="text-zinc-400 hover:text-white transition">
                  <SkipBack size={20} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); isPlaying ? pause() : play(); }}
                  className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition shadow-lg"
                >
                  {isBuffering ? (
                    <Loader2 size={18} className="animate-spin text-black" />
                  ) : isPlaying ? (
                    <Pause size={18} fill="currentColor" />
                  ) : (
                    <Play size={18} fill="currentColor" className="ml-1" />
                  )}
                </button>
                <button onClick={(e) => { e.stopPropagation(); next(); }} className="text-zinc-400 hover:text-white transition">
                  <SkipForward size={20} />
                </button>

                {/* Sleep Timer Button */}
                <div className="relative">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowTimerMenu(!showTimerMenu); }} 
                    className={`transition hover:scale-110 ${
                      sleepTimerEnd 
                        ? theme === 'emerald' ? 'text-green-500' : theme === 'sunset' ? 'text-orange-500' : theme === 'cyberpunk' ? 'text-pink-500' : theme === 'ocean' ? 'text-cyan-500' : 'text-violet-500'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Sleep Timer"
                  >
                    <Timer size={16} />
                  </button>

                  {/* Timer remaining badge */}
                  {sleepTimerEnd && timerRemaining && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-green-400 font-mono font-bold whitespace-nowrap bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                      {timerRemaining}
                    </span>
                  )}

                  {/* Timer dropdown */}
                  {showTimerMenu && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-3 w-44 z-[100]" onClick={(e) => e.stopPropagation()}>
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Sleep Timer</div>
                      {timerOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSleepTimer(opt.value);
                            setShowTimerMenu(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                            sleepTimerMinutes === opt.value
                              ? theme === 'emerald' ? 'bg-green-500/20 text-green-400' : theme === 'sunset' ? 'bg-orange-500/20 text-orange-400' : theme === 'cyberpunk' ? 'bg-pink-500/20 text-pink-400' : theme === 'ocean' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-violet-500/20 text-violet-400'
                              : 'text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                      {sleepTimerEnd && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSleepTimer(null);
                            setShowTimerMenu(false);
                          }}
                          className="w-full text-left px-3 py-1.5 rounded-lg text-sm font-semibold text-red-400 hover:bg-red-500/10 mt-1 flex items-center gap-2 transition"
                        >
                          <X size={12} /> Cancel Timer
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 w-full">
                <span className="text-[10px] text-zinc-500 font-mono w-8 text-right">
                  {formatTime(isSeeking ? tempSeekTime : currentTime)}
                </span>
                
                {/* Scrubbable Seek Bar */}
                <input 
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={isSeeking ? tempSeekTime : currentTime}
                  onMouseDown={handleSeekStart}
                  onTouchStart={handleSeekStart}
                  onChange={handleSeekChange}
                  onMouseUp={handleSeekEnd}
                  onTouchEnd={handleSeekEnd}
                  onClick={(e) => e.stopPropagation()}
                  className={`h-1 rounded-full flex-1 appearance-none cursor-pointer focus:outline-none bg-zinc-850 accent-${
                    theme === 'emerald' ? 'green' : theme === 'sunset' ? 'orange' : theme === 'cyberpunk' ? 'pink' : theme === 'ocean' ? 'cyan' : 'violet'
                  }-500 hover:accent-${
                    theme === 'emerald' ? 'green' : theme === 'sunset' ? 'orange' : theme === 'cyberpunk' ? 'pink' : theme === 'ocean' ? 'cyan' : 'violet'
                  }-400`}
                  style={{
                    background: `linear-gradient(to right, ${
                      theme === 'emerald' ? '#22c55e' : theme === 'sunset' ? '#f97316' : theme === 'cyberpunk' ? '#ec4899' : theme === 'ocean' ? '#06b6d4' : '#8b5cf6'
                    } ${( (isSeeking ? tempSeekTime : currentTime) / (duration || 100) ) * 100}%, #27272a ${( (isSeeking ? tempSeekTime : currentTime) / (duration || 100) ) * 100}%)`
                  }}
                />
                
                <span className="text-[10px] text-zinc-500 font-mono w-8 text-left">{formatTime(duration)}</span>
              </div>
            </div>
            
            {/* Right: Controls (Mobile) & Volume/Utilities (Desktop) */}
            <div className="flex items-center gap-1 md:gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {/* Mobile Playback Controls - visible only on phone layout */}
              <div className="flex items-center gap-1 md:hidden mr-1">
                <button onClick={(e) => { e.stopPropagation(); prev(); }} className="text-zinc-400 hover:text-white p-2 transition">
                  <SkipBack size={18} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); isPlaying ? pause() : play(); }}
                  className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 active:scale-95 transition shadow-md flex-shrink-0"
                >
                  {isBuffering ? (
                    <Loader2 size={16} className="animate-spin text-black" />
                  ) : isPlaying ? (
                    <Pause size={16} fill="currentColor" />
                  ) : (
                    <Play size={16} fill="currentColor" className="ml-0.5" />
                  )}
                </button>
                <button onClick={(e) => { e.stopPropagation(); next(); }} className="text-zinc-400 hover:text-white p-2 transition">
                  <SkipForward size={18} />
                </button>
              </div>

              {/* Lyrics Panel Toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowLyrics(true); }}
                className={`text-zinc-400 hover:text-white p-2 transition ${
                  showLyrics 
                    ? theme === 'emerald' ? 'text-green-500' : theme === 'sunset' ? 'text-orange-500' : theme === 'cyberpunk' ? 'text-pink-500' : theme === 'ocean' ? 'text-cyan-500' : 'text-violet-500'
                    : ''
                }`}
                title="Lyrics"
              >
                <Layers size={18} />
              </button>

              {/* Mobile Volume Mute Toggle */}
              <button 
                onClick={(e) => { e.stopPropagation(); setVolume(volume === 0 ? 0.8 : 0); }}
                className="text-zinc-400 hover:text-white p-2 transition md:hidden"
                title="Toggle Mute"
              >
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>

              {/* Desktop-only utilities & volume */}
              <button
                onClick={(e) => { e.stopPropagation(); handleShare(currentSong.title, `Listening to ${currentSong.title} by ${currentSong.artist} on ADIFY.`); }}
                className="text-zinc-400 hover:text-white p-2 transition hidden sm:block"
                title="Share Song"
              >
                <Share2 size={18} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); startVoiceAssistant(); }}
                className={`text-zinc-400 hover:text-white p-2 transition hidden sm:block ${isListeningVoice ? 'text-red-400 animate-pulse' : ''}`}
                title={isListeningVoice ? voiceCommandText : 'Voice Assistant'}
              >
                <Mic size={18} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setVolume(volume === 0 ? 0.8 : 0); }}
                className="text-zinc-400 hover:text-white p-2 transition hidden md:block"
              >
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input 
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className={`h-1 bg-zinc-800 rounded-full w-24 appearance-none cursor-pointer focus:outline-none accent-${
                  theme === 'emerald' ? 'green' : theme === 'sunset' ? 'orange' : theme === 'cyberpunk' ? 'pink' : theme === 'ocean' ? 'cyan' : 'violet'
                }-500 hover:accent-${
                  theme === 'emerald' ? 'green' : theme === 'sunset' ? 'orange' : theme === 'cyberpunk' ? 'pink' : theme === 'ocean' ? 'cyan' : 'violet'
                }-400 hidden md:block`}
              />
            </div>
          </footer>

          {/* Expanded Mobile Song Details Drawer Overlay */}
          {showMobileDetails && (
            <div className="fixed inset-0 bg-zinc-950/98 backdrop-blur-3xl z-[150] md:hidden flex flex-col justify-between p-6 transition-all duration-500 ease-in-out overflow-y-auto">
              {/* Animated Background Glowing Aura */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className={`absolute -top-40 -left-40 w-96 h-96 rounded-full blur-[120px] opacity-20 transition-all duration-1000 ${
                  theme === 'emerald' ? 'bg-green-500' :
                  theme === 'sunset' ? 'bg-orange-500' :
                  theme === 'cyberpunk' ? 'bg-pink-500' :
                  theme === 'ocean' ? 'bg-cyan-500' :
                  'bg-violet-500'
                }`} />
                <div className={`absolute -bottom-40 -right-40 w-96 h-96 rounded-full blur-[120px] opacity-15 transition-all duration-1000 ${
                  theme === 'emerald' ? 'bg-green-500' :
                  theme === 'sunset' ? 'bg-orange-500' :
                  theme === 'cyberpunk' ? 'bg-pink-500' :
                  theme === 'ocean' ? 'bg-cyan-500' :
                  'bg-violet-500'
                }`} />
              </div>

              <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <button 
                    onClick={() => {
                      setShowMobileDetails(false);
                      setShowMobileQueue(false);
                    }}
                    className="w-10 h-10 bg-zinc-900/60 border border-zinc-800/40 rounded-full flex items-center justify-center text-zinc-400 active:text-white transition active:scale-95"
                  >
                    <ChevronDown size={24} />
                  </button>
                  <div className="text-center min-w-0 flex-1 px-4">
                    <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block mb-0.5">NOW PLAYING</span>
                    <span className="text-xs font-bold text-zinc-300 truncate block">
                      {currentSong.source === 'youtube' ? 'YouTube Music' : 'JioSaavn Stream'}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleShare(currentSong.title, `Listening to ${currentSong.title} by ${currentSong.artist} on ADIFY.`)}
                    className="w-10 h-10 bg-zinc-900/60 border border-zinc-800/40 rounded-full flex items-center justify-center text-zinc-400 active:text-white transition active:scale-95"
                  >
                    <Share2 size={18} />
                  </button>
                </div>

                {/* Album Art Cover Area */}
                <div className="my-auto py-4 flex flex-col items-center">
                  <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden border border-zinc-800 transition duration-500">
                    {currentSong.image ? (
                      <img 
                        src={currentSong.image} 
                        alt={currentSong.title} 
                        className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                        <Music className="size-20 text-zinc-600" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Song Metadata Details */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl font-black text-white tracking-tight truncate">{currentSong.title}</h3>
                      <p className="text-xs font-bold text-zinc-400 truncate hover:text-white transition cursor-pointer">{currentSong.artist}</p>
                    </div>
                    <button 
                      onClick={() => toggleLike(currentSong)} 
                      className="w-11 h-11 bg-zinc-900/40 hover:bg-zinc-900/80 rounded-full flex items-center justify-center border border-zinc-800/50 transition active:scale-90 flex-shrink-0"
                    >
                      <Heart 
                        size={20} 
                        fill={likedSongs.some((s) => s.id === currentSong.id) ? (theme === 'emerald' ? '#22c55e' : theme === 'sunset' ? '#f97316' : theme === 'cyberpunk' ? '#ec4899' : theme === 'ocean' ? '#06b6d4' : '#8b5cf6') : 'none'} 
                        className={likedSongs.some((s) => s.id === currentSong.id) ? (theme === 'emerald' ? 'text-green-500' : theme === 'sunset' ? 'text-orange-500' : theme === 'cyberpunk' ? 'text-pink-500' : theme === 'ocean' ? 'text-cyan-500' : 'text-violet-500') : 'text-zinc-400'} 
                      />
                    </button>
                  </div>

                  {/* Seek Bar / Slider Control */}
                  <div className="space-y-1">
                    <div className="flex items-center h-[20px] w-full">
                      <input 
                        type="range"
                        min="0"
                        max={duration || 100}
                        step="0.1"
                        value={isSeeking ? tempSeekTime : currentTime}
                        onMouseDown={handleSeekStart}
                        onTouchStart={handleSeekStart}
                        onChange={handleSeekChange}
                        onMouseUp={handleSeekEnd}
                        onTouchEnd={handleSeekEnd}
                        className={`h-[6px] rounded-full w-full appearance-none cursor-pointer focus:outline-none bg-zinc-850 accent-${
                          theme === 'emerald' ? 'green' : theme === 'sunset' ? 'orange' : theme === 'cyberpunk' ? 'pink' : theme === 'ocean' ? 'cyan' : 'violet'
                        }-500`}
                        style={{ background: `linear-gradient(to right, ${theme === 'emerald' ? '#22c55e' : theme === 'sunset' ? '#f97316' : theme === 'cyberpunk' ? '#ec4899' : theme === 'ocean' ? '#06b6d4' : '#8b5cf6'} ${((isSeeking ? tempSeekTime : currentTime) / (duration || 100)) * 100}%, #27272a ${((isSeeking ? tempSeekTime : currentTime) / (duration || 100)) * 100}%)` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-zinc-500 font-bold">
                      <span>{formatTime(isSeeking ? tempSeekTime : currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Main Playback Control Panel */}
                  <div className="flex items-center justify-between px-2">
                    {/* Shuffle Toggle */}
                    <button 
                      onClick={toggleShuffle} 
                      className={`w-10 h-10 flex items-center justify-center rounded-full transition active:scale-95 ${
                        shuffle 
                          ? theme === 'emerald' ? 'text-green-500 bg-green-500/10' :
                            theme === 'sunset' ? 'text-orange-500 bg-orange-500/10' :
                            theme === 'cyberpunk' ? 'text-pink-500 bg-pink-500/10' :
                            theme === 'ocean' ? 'text-cyan-500 bg-cyan-500/10' :
                            'text-violet-500 bg-violet-500/10'
                          : 'text-zinc-400'
                      }`}
                      title="Shuffle"
                    >
                      <Shuffle size={20} />
                    </button>

                    {/* Skip Prev */}
                    <button 
                      onClick={prev} 
                      className="w-12 h-12 flex items-center justify-center rounded-full text-zinc-200 active:text-white transition active:scale-90"
                    >
                      <SkipBack size={26} fill="currentColor" />
                    </button>

                    {/* Big Circular Play/Pause Button */}
                    <button 
                      onClick={isPlaying ? pause : play}
                      className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-2xl"
                    >
                      {isBuffering ? (
                        <Loader2 size={24} className="animate-spin text-black" />
                      ) : isPlaying ? (
                        <Pause size={24} fill="currentColor" />
                      ) : (
                        <Play size={24} fill="currentColor" className="ml-0.5" />
                      )}
                    </button>

                    {/* Skip Next */}
                    <button 
                      onClick={next} 
                      className="w-12 h-12 flex items-center justify-center rounded-full text-zinc-200 active:text-white transition active:scale-90"
                    >
                      <SkipForward size={26} fill="currentColor" />
                    </button>

                    {/* Sleep Timer button */}
                    <div className="relative">
                      <button 
                        onClick={() => setShowTimerMenu(!showTimerMenu)} 
                        className={`w-10 h-10 flex items-center justify-center rounded-full transition active:scale-95 ${
                          sleepTimerEnd 
                            ? theme === 'emerald' ? 'text-green-500 bg-green-500/10' :
                              theme === 'sunset' ? 'text-orange-500 bg-orange-500/10' :
                              theme === 'cyberpunk' ? 'text-pink-500 bg-pink-500/10' :
                              theme === 'ocean' ? 'text-cyan-500 bg-cyan-500/10' :
                              'text-violet-500 bg-violet-500/10'
                            : 'text-zinc-400'
                        }`}
                      >
                        <Timer size={20} />
                      </button>

                      {/* Sleep timer remaining label overlay */}
                      {sleepTimerEnd && timerRemaining && (
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] text-green-400 font-mono font-bold whitespace-nowrap bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded">
                          {timerRemaining}
                        </span>
                      )}

                      {/* Timer dropdown relative overlay */}
                      {showTimerMenu && (
                        <div className="absolute bottom-12 right-0 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-2 w-36 z-[160]">
                          <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest px-2 py-1">Sleep Timer</div>
                          {timerOptions.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => {
                                setSleepTimer(opt.value);
                                setShowTimerMenu(false);
                              }}
                              className={`w-full text-left px-2 py-1 text-xs font-semibold rounded transition ${
                                sleepTimerMinutes === opt.value
                                  ? theme === 'emerald' ? 'bg-green-500/20 text-green-400' : theme === 'sunset' ? 'bg-orange-500/20 text-orange-400' : theme === 'cyberpunk' ? 'bg-pink-500/20 text-pink-400' : theme === 'ocean' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-violet-500/20 text-violet-400'
                                  : 'text-zinc-300 hover:bg-zinc-800'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                          {sleepTimerEnd && (
                            <button
                              onClick={() => {
                                setSleepTimer(null);
                                setShowTimerMenu(false);
                              }}
                              className="w-full text-left px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/10 mt-1 flex items-center gap-1 transition"
                            >
                              <X size={10} /> Cancel Timer
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Volume Slider Panel */}
                  <div className="bg-zinc-900/40 border border-zinc-900/60 rounded-xl p-3 flex items-center gap-3">
                    <button 
                      onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
                      className="text-zinc-400 active:text-white transition flex-shrink-0"
                    >
                      {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <input 
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      className={`h-1.5 rounded-full flex-1 appearance-none cursor-pointer focus:outline-none bg-zinc-800 accent-${
                        theme === 'emerald' ? 'green' : theme === 'sunset' ? 'orange' : theme === 'cyberpunk' ? 'pink' : theme === 'ocean' ? 'cyan' : 'violet'
                      }-500`}
                    />
                    <span className="text-[10px] font-mono text-zinc-500 font-bold w-6 text-right">
                      {Math.round(volume * 100)}%
                    </span>
                  </div>

                  {/* Collapsible Mobile Queue Section (Shifting songs anywhere) */}
                  <div className="border border-zinc-900 bg-zinc-950/40 rounded-xl overflow-hidden">
                    <style dangerouslySetInnerHTML={{__html: `
                      @keyframes eqBounce {
                        0%, 100% { transform: scaleY(0.3); }
                        50% { transform: scaleY(1); }
                      }
                      .animate-eq-bar-1 { animation: eqBounce 0.8s ease-in-out infinite; transform-origin: bottom; }
                      .animate-eq-bar-2 { animation: eqBounce 1.2s ease-in-out infinite; transform-origin: bottom; }
                      .animate-eq-bar-3 { animation: eqBounce 0.9s ease-in-out infinite; transform-origin: bottom; }
                    `}} />
                    
                    <button
                      onClick={() => setShowMobileQueue(!showMobileQueue)}
                      className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-zinc-400 border-b border-zinc-900 bg-zinc-950/60 active:bg-zinc-900 transition"
                    >
                      <span className="flex items-center gap-2">
                        <ListMusic size={16} />
                        <span>Music Queue ({queue.length} songs)</span>
                      </span>
                      <span className="text-[10px] uppercase text-zinc-500 tracking-wider">
                        {showMobileQueue ? 'Hide Queue' : 'Tap to View'}
                      </span>
                    </button>

                    {showMobileQueue && (
                      <div className="max-h-60 overflow-y-auto divide-y divide-zinc-900/60 p-2 space-y-1 bg-zinc-950/80">
                        {queue.map((song, idx) => {
                          const isCurrent = idx === currentIndex;
                          
                          // Determine border color matching the theme
                          const activeBorderClass = isCurrent
                            ? theme === 'emerald' ? 'border-2 border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.3)] bg-green-500/5' :
                              theme === 'sunset' ? 'border-2 border-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.3)] bg-orange-500/5' :
                              theme === 'cyberpunk' ? 'border-2 border-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.3)] bg-pink-500/5' :
                              theme === 'ocean' ? 'border-2 border-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.3)] bg-cyan-500/5' :
                              'border-2 border-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.3)] bg-violet-500/5'
                            : 'border border-zinc-900 bg-zinc-900/10';

                          return (
                            <div
                              key={`${song.id}-mobile-queue-${idx}`}
                              draggable
                              onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(idx)); }}
                              onDragOver={(e) => { e.preventDefault(); }}
                              onDrop={(e) => {
                                const fromIndex = Number(e.dataTransfer.getData('text/plain'));
                                if (!isNaN(fromIndex) && fromIndex !== idx) {
                                  moveQueueSong(fromIndex, idx);
                                  triggerToast('↕️ Queue reordered');
                                }
                              }}
                              onClick={() => {
                                if (!isCurrent) {
                                  setSong(song, queue);
                                  triggerToast(`🎵 Playing "${song.title}"`);
                                }
                              }}
                              className={`flex items-center gap-2 p-2 rounded-lg transition min-w-0 ${activeBorderClass} ${isCurrent ? 'cursor-default' : 'cursor-pointer hover:bg-zinc-900/40 active:bg-zinc-900/70'}`}
                            >
                              {/* Grip handle */}
                              <GripVertical size={14} className="text-zinc-500 cursor-grab flex-shrink-0" />

                              {/* Album thumbnail */}
                              <div className="w-10 h-10 rounded bg-zinc-800 flex-shrink-0 overflow-hidden relative flex items-center justify-center border border-zinc-700/30">
                                {song.image ? (
                                  <img src={song.image} alt={song.title} className="w-full h-full object-cover" />
                                ) : (
                                  <Music size={14} className="text-zinc-500" />
                                )}

                                {/* Equalizer Overlay for currently playing song */}
                                {isCurrent && (
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-[2px]">
                                    <span className={`w-[3px] bg-white rounded-full ${isPlaying ? 'h-4 animate-eq-bar-1' : 'h-2'}`} />
                                    <span className={`w-[3px] bg-white rounded-full ${isPlaying ? 'h-4 animate-eq-bar-2' : 'h-3'}`} />
                                    <span className={`w-[3px] bg-white rounded-full ${isPlaying ? 'h-4 animate-eq-bar-3' : 'h-1.5'}`} />
                                  </div>
                                )}
                              </div>

                              {/* Song Details */}
                              <div className="min-w-0 flex-1">
                                <div className={`text-xs font-bold truncate ${isCurrent ? 'text-white' : 'text-zinc-200'}`}>
                                  {song.title}
                                </div>
                                <div className="text-[10px] text-zinc-400 truncate mt-0.5">{song.artist}</div>
                              </div>

                              {/* Reordering and Shifting Action Buttons */}
                              <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                {/* Move to Position */}
                                <button
                                  onClick={() => {
                                    const targetPosStr = prompt(`Move "${song.title}" to position (1 to ${queue.length}):`, String(idx + 1));
                                    if (targetPosStr === null) return;
                                    const targetPos = parseInt(targetPosStr, 10);
                                    if (isNaN(targetPos) || targetPos < 1 || targetPos > queue.length) {
                                      triggerToast("❌ Invalid position");
                                      return;
                                    }
                                    moveQueueSong(idx, targetPos - 1);
                                    triggerToast(`↕️ Shifted "${song.title}" to position ${targetPos}`);
                                  }}
                                  className="w-7 h-7 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 active:text-white transition active:scale-90"
                                  title="Move to Position"
                                >
                                  <ChevronsUpDown size={12} />
                                </button>

                                {/* Move Up */}
                                {idx > 0 && (
                                  <button
                                    onClick={() => {
                                      moveQueueSong(idx, idx - 1);
                                      triggerToast(`🔼 Moved "${song.title}" up`);
                                    }}
                                    className="w-7 h-7 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 active:text-white transition active:scale-90"
                                    title="Move Up"
                                  >
                                    <ChevronUp size={14} />
                                  </button>
                                )}
                                
                                {/* Move Down */}
                                {idx < queue.length - 1 && (
                                  <button
                                    onClick={() => {
                                      moveQueueSong(idx, idx + 1);
                                      triggerToast(`🔽 Moved "${song.title}" down`);
                                    }}
                                    className="w-7 h-7 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 active:text-white transition active:scale-90"
                                    title="Move Down"
                                  >
                                    <ChevronDown size={14} />
                                  </button>
                                )}

                                {/* Play Next (Zap) - only show for upcoming items further in queue */}
                                {idx > currentIndex + 1 && (
                                  <button
                                    onClick={() => {
                                      moveQueueSong(idx, currentIndex + 1);
                                      triggerToast(`⚡ "${song.title}" is up next!`);
                                    }}
                                    className="w-7 h-7 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-yellow-400 active:scale-90 transition"
                                    title="Play Next"
                                  >
                                    <Zap size={12} className="text-yellow-500 fill-current" />
                                  </button>
                                )}

                                {/* Remove Track */}
                                <button
                                  onClick={() => {
                                    removeQueueSong(idx);
                                    triggerToast(`🗑️ Removed "${song.title}"`);
                                  }}
                                  className="w-7 h-7 bg-red-950/20 border border-red-900/30 text-red-400 rounded-full flex items-center justify-center hover:bg-red-950/50 active:scale-90 transition"
                                  title="Remove from Queue"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {queue.length === 0 && (
                          <div className="py-8 text-center text-xs text-zinc-500 font-medium">
                            Queue is empty. Add songs to play!
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Toolbar Options: Offline Downloads, Synced Lyrics Drawer, Speech Assistant */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        handleDownload(currentSong);
                      }}
                      className="bg-zinc-900/60 border border-zinc-800/40 rounded-xl py-2.5 flex flex-col items-center justify-center gap-1 text-[10px] font-bold text-zinc-400 active:text-white transition active:scale-95"
                    >
                      <Download size={16} />
                      <span>Download</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowLyrics(true);
                      }}
                      className={`bg-zinc-900/60 border border-zinc-800/40 rounded-xl py-2.5 flex flex-col items-center justify-center gap-1 text-[10px] font-bold active:text-white transition active:scale-95 ${
                        showLyrics 
                          ? theme === 'emerald' ? 'text-green-500 border-green-500/20' :
                            theme === 'sunset' ? 'text-orange-500 border-orange-500/20' :
                            theme === 'cyberpunk' ? 'text-pink-500 border-pink-500/20' :
                            theme === 'ocean' ? 'text-cyan-500 border-cyan-500/20' :
                            'text-violet-500 border-violet-500/20'
                          : 'text-zinc-400'
                      }`}
                    >
                      <Layers size={16} />
                      <span>Lyrics</span>
                    </button>

                    <button
                      onClick={startVoiceAssistant}
                      className={`bg-zinc-900/60 border border-zinc-800/40 rounded-xl py-2.5 flex flex-col items-center justify-center gap-1 text-[10px] font-bold active:text-white transition active:scale-95 ${
                        isListeningVoice ? 'text-red-400 animate-pulse border-red-500/20' : 'text-zinc-400'
                      }`}
                    >
                      <Mic size={16} />
                      <span>{isListeningVoice ? 'Listening...' : 'Voice AI'}</span>
                    </button>
                  </div>

                  {/* Premium Warning Note explaining lockscreen restrictions */}
                  <div className="bg-zinc-900/20 border border-zinc-900/40 rounded-xl p-3 text-[9px] text-zinc-500 font-semibold leading-normal text-center">
                    ℹ️ OS notification drawer widgets only support standard Play/Pause/Next/Prev buttons. Custom buttons (like Like/Heart) cannot be injected into native mobile notifications, but are fully synced here inside the app!
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
