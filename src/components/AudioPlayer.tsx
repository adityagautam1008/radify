'use client';

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import * as offlineDb from '@/lib/db';

// Single global HTMLAudioElement to ensure it can be synchronously "blessed" (unlocked)
// within the user interaction (click) tick on mobile browsers (iOS Safari, Chrome Mobile).
let globalAudio: HTMLAudioElement | null = null;
if (typeof window !== 'undefined') {
  globalAudio = new Audio();
  globalAudio.preload = 'auto';

  // Synchronously play a silent audio snippet on the exact user-click thread.
  // This satisfies strict mobile webkit/blink autoplay user-gesture policies,
  // allowing the same audio instance to later load and play external streams asynchronously.
  (window as any).__adifyBlessAudio = () => {
    if (globalAudio) {
      if (!globalAudio.src) {
        globalAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA";
      }
      globalAudio.play().catch(() => {});
    }
  };
}

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
    currentTime,
    setIsBuffering
  } = usePlayerStore();

  // Initialize Audio element once
  useEffect(() => {
    const audio = globalAudio;
    if (!audio) return;
    audioRef.current = audio;

    let fallbackTimer: NodeJS.Timeout | null = null;

    const handlePlay = () => play();
    const handlePause = () => {
      pause();
      setIsBuffering(false);
    };
    const handleEnded = () => {
      // Safely ensure the track actually played through to the end before triggering next()
      const hasEndedProperly = audio.duration && audio.currentTime > 0 && Math.abs(audio.duration - audio.currentTime) < 2.5;
      if (hasEndedProperly) {
        next();
      } else {
        console.warn('[AudioPlayer] Suppressed false ended event. CurrentTime:', audio.currentTime, 'Duration:', audio.duration);
      }
    };
    const handleError = () => {
      const err = audio.error;
      console.error('[AudioPlayer] Audio element error event occurred:', err);
      setIsBuffering(false);

      // Ignore if there's no actual error object (false alarm) or it's a simple aborted load
      if (!err || err.code === 1) {
        console.log('[AudioPlayer] Ignoring false error or MEDIA_ERR_ABORTED.');
        return;
      }
      
      const currentSrc = audio.src || '';
      if (!currentSrc || currentSrc.startsWith('data:') || currentSrc === window.location.href || currentSrc === window.location.href + '/') {
        console.log('[AudioPlayer] Ignoring error for empty/silent/document source:', currentSrc);
        return;
      }

      const state = usePlayerStore.getState();
      if (!state.currentSong) {
        console.log('[AudioPlayer] Ignoring error since no currentSong is active.');
        return;
      }

      console.error('[AudioPlayer] Legitimate stream error. Pausing playback.');
      pause();
      
      if (typeof window !== 'undefined' && (window as any).__adifyTriggerToast) {
        (window as any).__adifyTriggerToast("Stream unavailable. Click play to retry.");
      }
    };
    
    const handleTimeUpdate = () => {
      if (!seekLockRef.current) {
        setTime(audio.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    // canplaythrough fires when browser estimates smooth playback
    const handleCanPlayThrough = () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      setIsBuffering(false);
      const state = usePlayerStore.getState();
      if (state.isPlaying) {
        audio.play().catch(() => {});
      }
    };

    // canplay fires when enough data is buffered to start
    const handleCanPlay = () => {
      const state = usePlayerStore.getState();
      if (state.isPlaying) {
        // If it's a cached offline song, play immediately
        if (audio.src.startsWith('blob:')) {
          audio.play().catch(() => {});
          setIsBuffering(false);
          return;
        }

        // Wait up to 1.2 seconds for canplaythrough to estimate smooth streaming.
        // Fall back to playing anyway to prevent hanging on slow/irregular connections.
        if (fallbackTimer) clearTimeout(fallbackTimer);
        fallbackTimer = setTimeout(() => {
          const activeState = usePlayerStore.getState();
          if (activeState.isPlaying) {
            audio.play().catch(() => {});
            setIsBuffering(false);
          }
        }, 1200);
      }
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handlePlaying = () => {
      setIsBuffering(false);
    };

    const handleSeeking = () => {
      setIsBuffering(true);
    };

    const handleSeeked = () => {
      setIsBuffering(false);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('seeking', handleSeeking);
    audio.addEventListener('seeked', handleSeeked);
    audio.addEventListener('error', handleError);

    return () => {
      if (skipAfterErrorRef.current) {
        window.clearTimeout(skipAfterErrorRef.current);
      }
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
      audio.pause();
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('seeking', handleSeeking);
      audio.removeEventListener('seeked', handleSeeked);
      audio.removeEventListener('error', handleError);
    };
  }, [play, pause, next, setTime, setDuration, setIsBuffering]);

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
    // Set src to silent WAV base64 instead of removeAttribute('src') to prevent error events on mobile
    audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA";
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
          console.error('[AudioPlayer] Stream URL is empty or invalid.');
          pause();
          setIsBuffering(false);
          if (typeof window !== 'undefined' && (window as any).__adifyTriggerToast) {
            (window as any).__adifyTriggerToast("Stream URL is unavailable.");
          }
          return;
        }

        setIsBuffering(true);
        audio.src = streamUrl;
        audio.load();

        // Update Media Session metadata for background/lock screen controls
        if ('mediaSession' in navigator) {
          const artworkUrl = currentSong.image || '';
          navigator.mediaSession.metadata = new MediaMetadata({
            title: currentSong.title,
            artist: currentSong.artist,
            album: currentSong.album || 'ADIFY',
            artwork: artworkUrl
              ? [
                  { src: artworkUrl, sizes: '96x96', type: 'image/jpeg' },
                  { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' },
                  { src: artworkUrl, sizes: '192x192', type: 'image/jpeg' },
                  { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
                  { src: artworkUrl, sizes: '384x384', type: 'image/jpeg' },
                  { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' },
                ]
              : [],
          });
        }
      } else {
        audio.src = '';
        pause();
        setIsBuffering(false);
      }
    };

    playSongAsync();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [currentSong, pause, setIsBuffering]);

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

    const actionHandlers: [string, ((details: any) => void) | (() => void)][] = [
      ['play', () => play()],
      ['pause', () => pause()],
      ['previoustrack', () => prev()],
      ['nexttrack', () => next()],
      ['seekto', (details: any) => {
        const audio = audioRef.current;
        if (audio && details.seekTime != null) {
          audio.currentTime = details.seekTime;
          setTime(details.seekTime);
        }
      }],
      ['seekbackward', (details: any) => {
        const audio = audioRef.current;
        if (audio) {
          const offset = details.seekOffset || 10;
          audio.currentTime = Math.max(0, audio.currentTime - offset);
          setTime(audio.currentTime);
        }
      }],
      ['seekforward', (details: any) => {
        const audio = audioRef.current;
        if (audio) {
          const offset = details.seekOffset || 10;
          audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + offset);
          setTime(audio.currentTime);
        }
      }],
      ['like', () => {
        const state = usePlayerStore.getState();
        if (state.currentSong) {
          state.toggleLike(state.currentSong);
        }
      }],
      ['dislike', () => {
        const state = usePlayerStore.getState();
        if (state.queue.length > 1) {
          state.next();
        }
      }]
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action as any, handler as any);
      } catch (err) {
        console.warn(`[MediaSession] Action "${action}" is not supported:`, err);
      }
    }

    return () => {
      for (const [action] of actionHandlers) {
        try {
          navigator.mediaSession.setActionHandler(action as any, null);
        } catch {}
      }
    };
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
