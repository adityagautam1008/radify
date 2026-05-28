'use client';

import { useEffect, useRef, useState } from 'react';
import { getOfflineAudio } from '@/lib/offlineLibrary';
import { usePlayerStore } from '@/store/playerStore';

// Advanced visibility bypass hack: Tricks the YouTube player into thinking the page is always visible
if (typeof window !== 'undefined') {
  try {
    Object.defineProperty(document, 'hidden', { value: false, writable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
    
    const originalAddEventListener = document.addEventListener;
    document.addEventListener = function(type: string, listener: any, options?: any) {
      if (type === 'visibilitychange' || type === 'webkitvisibilitychange') {
        // Block YouTube player script from detecting that screen is locked or app went to background
        return;
      }
      return originalAddEventListener.apply(this, [type, listener, options]);
    };
  } catch (e) {
    console.warn('Failed to apply background playback visibility bypass', e);
  }
}

export default function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const [ytReady, setYtReady] = useState(false);
  const progressInterval = useRef<any>(null);

  const {
    currentSong,
    isPlaying,
    volume,
    currentTime,
    duration,
    pause,
    play,
    next,
    setTime,
    setDuration,
  } = usePlayerStore();

  const currentSongId = currentSong?.id;
  const currentSongDuration = currentSong?.duration || 0;
  const currentSongStreamUrl = currentSong?.streamUrl;
  const currentSongPreviewUrl = currentSong?.previewUrl;
  const isYouTube = currentSong?.source === 'youtube';

  // 1. Initialize global window hooks for Android play/pause/seek bridges
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).togglePlay = () => {
        const state = usePlayerStore.getState();
        if (state.isPlaying) state.pause();
        else state.play();
      };
      (window as any).nextTrack = () => usePlayerStore.getState().next();
      (window as any).prevTrack = () => usePlayerStore.getState().prev();
      (window as any).seekToMs = (ms: number) => {
        const newTime = ms / 1000;
        const state = usePlayerStore.getState();
        if (state.currentSong?.source === 'youtube' && ytPlayerRef.current) {
          ytPlayerRef.current.seekTo(newTime, true);
        } else if (audioRef.current) {
          audioRef.current.currentTime = newTime;
        }
        state.setTime(newTime);
        if ((window as any).Android) {
          (window as any).Android.onPlaybackStateChanged(state.isPlaying, newTime, state.duration);
        }
      };
    }
  }, []);

  // 2. Load YouTube Iframe API dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      
      (window as any).onYouTubeIframeAPIReady = () => {
        initializeYTPlayer();
      };
    } else {
      initializeYTPlayer();
    }

    function initializeYTPlayer() {
      try {
        ytPlayerRef.current = new (window as any).YT.Player('youtube-player-iframe', {
          height: '0',
          width: '0',
          playerVars: {
            playsinline: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: () => setYtReady(true),
            onStateChange: (event: any) => {
              // state 0 means video ended
              if (event.data === 0) {
                next();
              }
            },
            onError: () => {
              console.error('YouTube player error, pausing');
              pause();
            }
          }
        });
      } catch (e) {
        console.error('Failed to initialize YouTube Iframe player', e);
      }
    }
  }, [next, pause]);

  // 3. Set up standard HTML5 audio element listeners (for Saavn streams)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isYouTube) setTime(audio.currentTime);
    };
    
    const handleDuration = () => {
      if (isYouTube) return;
      const seekableEnd = audio.seekable.length ? audio.seekable.end(audio.seekable.length - 1) : 0;
      const nextDuration = Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : seekableEnd;
      const finalDuration = Number.isFinite(nextDuration) ? nextDuration : currentSong?.duration || 0;
      setDuration(finalDuration);
      
      if (typeof window !== 'undefined' && (window as any).Android) {
        (window as any).Android.onPlaybackStateChanged(usePlayerStore.getState().isPlaying, audio.currentTime, finalDuration);
      }
    };
    const handleEnded = () => {
      if (!isYouTube) next();
    };
    const handleError = () => {
      if (!isYouTube) pause();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleDuration);
    audio.addEventListener('durationchange', handleDuration);
    audio.addEventListener('canplay', handleDuration);
    audio.addEventListener('progress', handleDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleDuration);
      audio.removeEventListener('durationchange', handleDuration);
      audio.removeEventListener('canplay', handleDuration);
      audio.removeEventListener('progress', handleDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [currentSong?.duration, isYouTube, next, pause, setDuration, setTime]);

  // 4. Synchronize volume levels
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (ytPlayerRef.current && ytReady) {
      try {
        ytPlayerRef.current.setVolume(volume * 100);
      } catch (e) {}
    }
  }, [volume, ytReady]);

  // 5. Synchronize manual seeking/timeline progress
  useEffect(() => {
    if (isYouTube) {
      if (ytPlayerRef.current && ytReady && Number.isFinite(currentTime)) {
        try {
          const ytTime = ytPlayerRef.current.getCurrentTime() || 0;
          if (Math.abs(ytTime - currentTime) > 1.5) {
            ytPlayerRef.current.seekTo(currentTime, true);
          }
        } catch (e) {}
      }
    } else {
      const audio = audioRef.current;
      if (!audio || !(currentSongStreamUrl || currentSongPreviewUrl)) return;
      if (Number.isNaN(currentTime) || Math.abs(audio.currentTime - currentTime) < 0.75) return;
      audio.currentTime = Math.max(0, currentTime);
    }
  }, [currentSongId, currentSongPreviewUrl, currentSongStreamUrl, currentTime, isYouTube, ytReady]);

  // 6. Handle loading/switching new songs
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSongId) return;

    let objectUrl = '';
    let cancelled = false;
    const playableUrl = currentSongStreamUrl || currentSongPreviewUrl;

    const loadSong = async () => {
      // Clear progress polling interval
      if (progressInterval.current) clearInterval(progressInterval.current);

      // If it is a YouTube song, load in YouTube player and stop native audio
      if (isYouTube) {
        audio.pause();
        audio.removeAttribute('src');
        
        if (ytPlayerRef.current && ytReady) {
          const cleanYtId = currentSongId.replace('youtube-', '');
          try {
            ytPlayerRef.current.cueVideoById(cleanYtId);
            setDuration(currentSongDuration || 0);
            setTime(0);

            if (isPlaying) {
              ytPlayerRef.current.playVideo();
            }

            // Start polling progress intervals for YouTube player
            progressInterval.current = setInterval(() => {
              if (ytPlayerRef.current && ytReady && usePlayerStore.getState().isPlaying) {
                try {
                  const curr = ytPlayerRef.current.getCurrentTime() || 0;
                  const dur = ytPlayerRef.current.getDuration() || currentSongDuration || 0;
                  setTime(curr);
                  setDuration(dur);
                  if (typeof window !== 'undefined' && (window as any).Android) {
                    (window as any).Android.onPlaybackStateChanged(true, curr, dur);
                  }
                } catch (e) {}
              }
            }, 500);

          } catch (e) {
            console.error('Failed to trigger YouTube play', e);
          }
        }
        return;
      }

      // If it is a Saavn song, stop YouTube player and play standard audio
      if (ytPlayerRef.current && ytReady) {
        try {
          ytPlayerRef.current.stopVideo();
        } catch (e) {}
      }

      const offlineBlob = await getOfflineAudio(currentSongId).catch(() => undefined);
      const nextUrl = offlineBlob ? URL.createObjectURL(offlineBlob) : playableUrl;
      if (offlineBlob) objectUrl = nextUrl || '';

      if (cancelled || !nextUrl) {
        audio.pause();
        audio.removeAttribute('src');
        setTime(0);
        setDuration(currentSongDuration);
        return;
      }

      audio.src = nextUrl;
      audio.load();
      if (usePlayerStore.getState().isPlaying) {
        audio.play().catch(() => pause());
      }
    };

    loadSong();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [currentSongDuration, currentSongId, currentSongPreviewUrl, currentSongStreamUrl, isYouTube, ytReady, setDuration, setTime]);

  // 7. Handle global play/pause actions
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isYouTube) {
      if (ytPlayerRef.current && ytReady) {
        try {
          if (isPlaying) {
            ytPlayerRef.current.playVideo();
          } else {
            ytPlayerRef.current.pauseVideo();
          }
        } catch (e) {}
      }
    } else {
      if (!(currentSong?.streamUrl || currentSong?.previewUrl)) return;
      if (isPlaying) {
        audio.play().catch(() => pause());
      } else {
        audio.pause();
      }
    }
  }, [currentSong, isPlaying, isYouTube, ytReady, pause]);

  // 8. Integrate with standard browser MediaSession controls
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist,
      album: currentSong.album,
      artwork: currentSong.image
        ? [
            { src: currentSong.image, sizes: '96x96', type: 'image/jpeg' },
            { src: currentSong.image, sizes: '512x512', type: 'image/jpeg' },
          ]
        : [],
    });
  }, [currentSong]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!duration || !Number.isFinite(duration)) return;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(currentTime, duration),
      });
    } catch {
      // Ignore transient load states
    }
  }, [currentTime, duration]);

  // 9. Register MediaSession action handlers for lock screen / headset / notification controls
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => usePlayerStore.getState().play()],
      ['pause', () => usePlayerStore.getState().pause()],
      ['previoustrack', () => usePlayerStore.getState().prev()],
      ['nexttrack', () => usePlayerStore.getState().next()],
      ['seekto', (details) => {
        if (details.seekTime != null) {
          const state = usePlayerStore.getState();
          if (state.currentSong?.source === 'youtube' && ytPlayerRef.current) {
            ytPlayerRef.current.seekTo(details.seekTime, true);
          } else if (audioRef.current) {
            audioRef.current.currentTime = details.seekTime;
          }
          state.setTime(details.seekTime);
        }
      }],
    ];

    for (const [action, handler] of actions) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported action */ }
    }

    return () => {
      for (const [action] of actions) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch { /* ignore */ }
      }
    };
  }, []);

  return (
    <>
      {/* Native HTML5 Audio element for Saavn streaming */}
      <audio ref={audioRef} preload="metadata" playsInline hidden />
      
      {/* Hidden YouTube Iframe Player container */}
      <div id="youtube-player-container" style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}>
        <div id="youtube-player-iframe"></div>
      </div>
    </>
  );
}
