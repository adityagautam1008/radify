'use client';

import { useEffect, useRef } from 'react';
import { getOfflineAudio } from '@/lib/offlineLibrary';
import { usePlayerStore } from '@/store/playerStore';

export default function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const {
    currentSong,
    isPlaying,
    volume,
    currentTime,
    duration,
    pause,
    next,
    setTime,
    setDuration,
  } = usePlayerStore();
  const currentSongId = currentSong?.id;
  const currentSongDuration = currentSong?.duration || 0;
  const currentSongStreamUrl = currentSong?.streamUrl;
  const currentSongPreviewUrl = currentSong?.previewUrl;

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
        if (audioRef.current) {
          const newTime = ms / 1000;
          audioRef.current.currentTime = newTime;
          usePlayerStore.getState().setTime(newTime);
          if ((window as any).Android) {
            (window as any).Android.onPlaybackStateChanged(usePlayerStore.getState().isPlaying, newTime, usePlayerStore.getState().duration);
          }
        }
      };
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setTime(audio.currentTime);
    const handleDuration = () => {
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
    const handleEnded = () => next();
    const handleError = () => pause();

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
  }, [currentSong?.duration, next, pause, setDuration, setTime]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => usePlayerStore.getState().play());
    navigator.mediaSession.setActionHandler('pause', () => usePlayerStore.getState().pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => usePlayerStore.getState().prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => usePlayerStore.getState().next());

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, []);

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
      // Some mobile browsers reject transient position updates while metadata is loading.
    }
  }, [currentTime, duration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !(currentSongStreamUrl || currentSongPreviewUrl)) return;
    if (Number.isNaN(currentTime) || Math.abs(audio.currentTime - currentTime) < 0.75) return;
    audio.currentTime = Math.max(0, currentTime);
  }, [currentSongId, currentSongPreviewUrl, currentSongStreamUrl, currentTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSongId) return;
    let objectUrl = '';
    let cancelled = false;

    const playableUrl = currentSongStreamUrl || currentSongPreviewUrl;

    const loadSong = async () => {
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
    };
  }, [currentSongDuration, currentSongId, currentSongPreviewUrl, currentSongStreamUrl, pause, setDuration, setTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !(currentSong?.streamUrl || currentSong?.previewUrl)) return;

    if (isPlaying) {
      audio.play().catch(() => pause());
    } else {
      audio.pause();
    }
  }, [currentSong, isPlaying, pause]);

  return <audio ref={audioRef} preload="metadata" playsInline hidden />;
}
