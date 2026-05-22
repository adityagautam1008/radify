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
  const ignorePauseRef = useRef(false);
  const skipAfterErrorRef = useRef<number | null>(null);
  const songLoadTokenRef = useRef(0);
  const retryCountRef = useRef(0);
  const restoreTimeRef = useRef<number | null>(null);
  
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
      setIsBuffering(false);
      if (ignorePauseRef.current) {
        console.log('[AudioPlayer] Ignoring pause event during stream swap');
        return;
      }
      // Only sync state if it isn't the dummy silent WAV pausing itself
      if (!audio.src.startsWith('data:')) {
        pause();
      }
    };
    const handleEnded = () => {
      if (audio.src.startsWith('data:')) {
        console.log('[AudioPlayer] Suppressed ended event on silent transition WAV');
        return;
      }
      // If the duration is valid and the track ended naturally...
      if (audio.duration && audio.duration > 0 && Math.abs(audio.duration - audio.currentTime) > 5) {
        console.log(`[AudioPlayer] Suppressed ended event. Duration: ${audio.duration}, Current: ${audio.currentTime}`);
        return;
      }
      console.log('[AudioPlayer] Track ended naturally, proceeding to next song');
      next();
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

      // Failover and recovery for YouTube songs
      if (state.currentSong.source === 'youtube' && retryCountRef.current < 2) {
        retryCountRef.current++;
        const savedTime = audio.currentTime;
        restoreTimeRef.current = savedTime;
        console.log(`[AudioPlayer] Recovering YouTube stream. Attempt: ${retryCountRef.current}. Saved position: ${savedTime}`);
        
        const currentSongId = state.currentSong.id;
        const videoId = currentSongId.replace('youtube-', '');
        const freshUrl = `/api/play-yt?id=${videoId}&nocache=true&ts=${Date.now()}`;
        
        setIsBuffering(true);
        ignorePauseRef.current = true;
        
        // Simple fallback to our powerful Cobalt backend route
        const currentState = usePlayerStore.getState();
        if (currentState.currentSong?.id === currentSongId) {
          audio.src = freshUrl;
          audio.load();
          if (currentState.isPlaying) {
            audio.play().catch(() => {});
          }
        }
        
        setTimeout(() => { ignorePauseRef.current = false; }, 1000);
        
        if (typeof window !== 'undefined' && (window as any).__adifyTriggerToast) {
          (window as any).__adifyTriggerToast("Reconnecting stream...");
        }
        return;
      }

      // Failover and recovery for Saavn songs (mostly token expiry)
      if (state.currentSong.source === 'saavn' && retryCountRef.current < 2) {
        retryCountRef.current++;
        const savedTime = audio.currentTime;
        restoreTimeRef.current = savedTime;
        console.log(`[AudioPlayer] Recovering Saavn stream. Attempt: ${retryCountRef.current}. Saved position: ${savedTime}`);
        
        setIsBuffering(true);
        const currentSongId = state.currentSong.id;
        ignorePauseRef.current = true;
        
        fetch(`/api/search?id=${encodeURIComponent(currentSongId)}`)
          .then(res => res.json())
          .then(data => {
            const currentState = usePlayerStore.getState();
            if (currentState.currentSong?.id === currentSongId && data.song) {
              const freshSong = data.song;
              const freshUrl = freshSong.streamUrl_high || freshSong.streamUrl || freshSong.streamUrl_med;
              if (freshUrl) {
                console.log('[AudioPlayer] Fetched fresh Saavn URL:', freshUrl.substring(0, 50));
                audio.src = freshUrl;
                audio.load();
                if (currentState.isPlaying) {
                  audio.play().catch(() => {});
                }
              }
            }
          })
          .catch(e => {
            console.error('[AudioPlayer] Failed to recover Saavn stream:', e);
            pause();
            if (typeof window !== 'undefined' && (window as any).__adifyTriggerToast) {
              (window as any).__adifyTriggerToast("Stream expired. Please try again.");
            }
          })
          .finally(() => {
             setTimeout(() => { ignorePauseRef.current = false; }, 1000);
          });
        return;
      }

      console.error('[AudioPlayer] Legitimate stream error. Pausing playback.');
      pause();
      
      if (typeof window !== 'undefined' && (window as any).__adifyTriggerToast) {
        (window as any).__adifyTriggerToast("Stream unavailable. Click play to retry.");
      }
    };
    
    const handleTimeUpdate = () => {
      if (!seekLockRef.current && !audio.seeking) {
        setTime(audio.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      if (restoreTimeRef.current !== null && !isNaN(restoreTimeRef.current)) {
        try {
          audio.currentTime = restoreTimeRef.current;
          restoreTimeRef.current = null;
        } catch (e) {
          console.warn('[AudioPlayer] Error restoring time in metadata:', e);
        }
      }
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
      seekLockRef.current = true;
    };

    const handleSeeked = () => {
      setIsBuffering(false);
      seekLockRef.current = false;
      // Force a time update once seek completes
      setTime(audio.currentTime);
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
    let url = currentSong.streamUrl_high || currentSong.streamUrl || currentSong.streamUrl_med || currentSong.streamUrl_low || '';
    if (url.startsWith('/api/play-yt')) {
      try {
        const parsedUrl = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        if (!parsedUrl.searchParams.has('title')) {
          parsedUrl.searchParams.set('title', currentSong.title);
        }
        if (!parsedUrl.searchParams.has('artist')) {
          parsedUrl.searchParams.set('artist', currentSong.artist);
        }
        url = parsedUrl.pathname + parsedUrl.search;
      } catch (e) {
        console.warn('[AudioPlayer] Error parsing play-yt URL in getBestStreamUrl:', e);
      }
    }
    return url;
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

    retryCountRef.current = 0;
    restoreTimeRef.current = null;

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

        if (!streamUrl) {
          console.error('[AudioPlayer] Stream URL is empty or invalid.');
          pause();
          setIsBuffering(false);
          if (typeof window !== 'undefined' && (window as any).__adifyTriggerToast) {
            (window as any).__adifyTriggerToast("Stream URL is unavailable.");
          }
          return;
        }

        if (!active || loadToken !== songLoadTokenRef.current) return;

        setIsBuffering(true);
        ignorePauseRef.current = true;
        audio.src = streamUrl;
        audio.load();
        setTimeout(() => { ignorePauseRef.current = false; }, 1000);

        // Trigger play as soon as canplay fires (handled in handleCanPlay/handleCanPlayThrough),
        // but also attempt it immediately — the browser will queue it once data is ready.
        if (usePlayerStore.getState().isPlaying) {
          audio.play().catch(() => {
            // Will be retried by canplay/canplaythrough handlers
          });
        }

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
    if (!audio) return;
    
    // We MUST call play() here even if the src is the silent data: WAV.
    // This is a crucial trick for iOS/Safari: by starting playback of silence synchronously
    // in response to the user click (which triggered isPlaying=true), we retain the 
    // user gesture token. When the async stream fetch finishes, we can swap the src and play without being blocked.
    if (!audio.src || audio.src === window.location.href) return;

    if (isPlaying) {
      audio.play().catch((e) => {
        console.warn('[AudioPlayer] Play effect blocked:', e);
        // Only pause if it's not the silent placeholder (which sometimes fails harmlessly)
        if (!audio.src.startsWith('data:')) {
          pause();
        }
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
    
    // Only seek if the difference is significant to avoid rounding loops
    if (Math.abs(audio.currentTime - currentTime) > 1.5) {
      // seekLockRef is now correctly managed by the native 'seeking' and 'seeked' events!
      audio.currentTime = currentTime;
    }
  }, [currentTime]);

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
          const updatedState = usePlayerStore.getState();
          const isLikedNow = updatedState.likedSongs.some(s => s.id === state.currentSong?.id);
          if (typeof window !== 'undefined' && (window as any).__adifyTriggerToast) {
            (window as any).__adifyTriggerToast(isLikedNow ? "Added to Liked Songs ❤️" : "Removed from Liked Songs");
          }
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
