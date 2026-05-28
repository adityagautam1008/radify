import JSZip from 'jszip';
import { Playlist, Song, ThemeMood } from '@/store/playerStore';

const DB_NAME = 'adify_offline_library';
const DB_VERSION = 1;
const AUDIO_STORE = 'audio';

type AudioRecord = {
  id: string;
  blob: Blob;
};

type BackupPayload = {
  version: 1;
  exportedAt: string;
  likedSongs: Song[];
  playlists: Playlist[];
  recentSongs: Song[];
  downloadedSongs: Song[];
  theme: ThemeMood;
};

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(AUDIO_STORE)) {
      db.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
    }
  };

  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const withStore = async <T,>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void
) => {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE, mode);
    const store = transaction.objectStore(AUDIO_STORE);
    const request = action(store);

    if (request) {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } else {
      transaction.oncomplete = () => resolve(undefined);
    }

    transaction.onerror = () => reject(transaction.error);
  }).finally(() => db.close());
};

export const saveOfflineAudio = async (songId: string, blob: Blob) => {
  await withStore('readwrite', (store) => store.put({ id: songId, blob }));
};

export const getOfflineAudio = async (songId: string) => {
  const record = await withStore<AudioRecord | undefined>('readonly', (store) => store.get(songId));
  return record?.blob;
};

export const removeOfflineAudio = async (songId: string) => {
  await withStore('readwrite', (store) => {
    store.delete(songId);
  });
};

export const exportAdifyBackup = async (payload: BackupPayload) => {
  const zip = new JSZip();
  zip.file('adify-library.json', JSON.stringify(payload, null, 2));

  const audioFolder = zip.folder('downloaded-audio');
  await Promise.all(payload.downloadedSongs.map(async (song) => {
    const blob = await getOfflineAudio(song.id);
    if (blob) audioFolder?.file(`${encodeURIComponent(song.id)}.bin`, blob);
  }));

  return zip.generateAsync({ type: 'blob' });
};

export const importAdifyBackup = async (file: File) => {
  const zip = await JSZip.loadAsync(file);
  const libraryFile = zip.file('adify-library.json');
  if (!libraryFile) throw new Error('This is not an ADIFY backup file.');

  const payload = JSON.parse(await libraryFile.async('string')) as BackupPayload;

  await Promise.all((payload.downloadedSongs || []).map(async (song) => {
    const audioFile = zip.file(`downloaded-audio/${encodeURIComponent(song.id)}.bin`);
    if (!audioFile) return;
    const blob = await audioFile.async('blob');
    await saveOfflineAudio(song.id, blob);
  }));

  return payload;
};

export const downloadBlobFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
