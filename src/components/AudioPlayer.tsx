'use client';

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import * as offlineDb from '@/lib/db';

export default function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seekLockRef = useRef(false);
  const skipAfterErrorRef = useRef<number | null>(null);
  const songLoadTokenRef = useRef(0);
  
  const {
    currentSong,
    isPlaying,
    volume,
    play,
    pause,
    next,
    prev,
    setTime,
    setDuration,
    currentTime
  } = usePlayerStore();

  // Initialize Audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const handlePlay = () => play();
    const handlePause = () => pause();
    const handleEnded = () => next();
    const handleError = () => {
      pause();
      if (skipAfterErrorRef.current) {
        window.clearTimeout(skipAfterErrorRef.current);
      }
      skipAfterErrorRef.current = window.setTimeout(() => {
        const state = usePlayerStore.getState();
        if (state.queue.length > 1) {
          state.next();
        }
      }, 450);
    };
    
    const handleTimeUpdate = () => {
      if (!seekLockRef.current) {
        setTime(audio.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    // canplay fires when enough data is buffered to start — auto-play immediately
    const handleCanPlay = () => {
      const state = usePlayerStore.getState();
      if (state.isPlaying) {
        audio.play().catch(() => {});
      }
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      if (skipAfterErrorRef.current) {
        window.clearTimeout(skipAfterErrorRef.current);
      }
      audio.pause();
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, [play, pause, next, setTime, setDuration]);

  const getBestStreamUrl = () => {
    if (!currentSong) return '';
    return currentSong.streamUrl_high || currentSong.streamUrl || currentSong.streamUrl_med || currentSong.streamUrl_low || '';
  };

  const verifyInternalStream = async (url: string) => {
    // Return true immediately. Browser HTML5 audio tags follow redirects and load streams natively.
    // Performing a client-side fetch() to `/api/play-yt` triggers cross-origin CORS checks when
    // redirected to an external Invidious instance, which causes playback to fail prematurely.
    return true;
  };

  // Handle Song Change
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let active = true;
    let objectUrl: string | null = null;
    const loadToken = ++songLoadTokenRef.current;

    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    setDuration(0);

    const playSongAsync = async () => {
      if (currentSong) {
        let streamUrl = getBestStreamUrl();
        
        try {
          const cached = await offlineDb.getOfflineSong(currentSong.id);
          if (cached && cached.audioBlob) {
            objectUrl = URL.createObjectURL(cached.audioBlob);
            streamUrl = objectUrl;
            console.log(`[AudioPlayer] Playing offline cached Blob URL for: ${currentSong.title}`);
          }
        } catch (e) {
          console.error('[AudioPlayer] Offline resolution check failed:', e);
        }

        if (!active || loadToken !== songLoadTokenRef.current) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          return;
        }

        const canPlayStream = streamUrl && await verifyInternalStream(streamUrl);
        if (!active || loadToken !== songLoadTokenRef.current) return;

        if (!canPlayStream) {
          pause();
          if (usePlayerStore.getState().queue.length > 1) {
            setTimeout(() => usePlayerStore.getState().next(), 300);
          }
          return;
        }

        audio.src = streamUrl;
        audio.load();
        audio.play().catch(() => {});

        // Update Media Session metadata for background/lock screen controls
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: currentSong.title,
            artist: currentSong.artist,
            album: currentSong.album || 'ADIFY',
            artwork: currentSong.image
              ? [
                  { src: currentSong.image, sizes: '512x512', type: 'image/jpeg' },
                ]
              : [],
          });
        }
      } else {
        audio.src = '';
        pause();
      }
    };

    playSongAsync();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [currentSong, pause]);

  // Handle Play/Pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    if (isPlaying) {
      audio.play().catch(() => {
        pause();
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, pause]);

  // Handle Volume Change
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  // Sync seek when user commits a seek from the UI
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (Math.abs(audio.currentTime - currentTime) > 1.5) {
      seekLockRef.current = true;
      audio.currentTime = currentTime;
      setTimeout(() => { seekLockRef.current = false; }, 300);
    }
  }, [currentTime]);

  // Expose seek lock control to page.tsx
  useEffect(() => {
    (window as any).__adifySeekLock = (lock: boolean) => {
      seekLockRef.current = lock;
    };
  }, []);

  // Register Media Session action handlers for background playback controls
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => play());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      const audio = audioRef.current;
      if (audio && details.seekTime != null) {
        audio.currentTime = details.seekTime;
        setTime(details.seekTime);
      }
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const audio = audioRef.current;
      if (audio) {
        const offset = details.seekOffset || 10;
        audio.currentTime = Math.max(0, audio.currentTime - offset);
        setTime(audio.currentTime);
      }
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const audio = audioRef.current;
      if (audio) {
        const offset = details.seekOffset || 10;
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + offset);
        setTime(audio.currentTime);
      }
    });
  }, [play, pause, prev, next, setTime]);

  // Update Media Session playback state
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // Update Media Session position state periodically
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const audio = audioRef.current;
    if (!audio || !audio.duration || isNaN(audio.duration)) return;

    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate,
        position: Math.min(audio.currentTime, audio.duration),
      });
    } catch {
      // setPositionState can throw if values are invalid
    }
  }, [currentTime]);

  return null;
}
