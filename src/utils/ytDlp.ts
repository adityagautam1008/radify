import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
// Path to the bundled yt-dlp binary. Adjust if you place it elsewhere.
const YTDLP_PATH = path.join(process.cwd(), 'bin', 'yt-dlp');

/**
 * Resolve a direct YouTube audio stream URL using the yt-dlp binary.
 * Returns the URL for itag 140 (m4a audio‑only) or null on failure.
 */
export async function getAudioUrl(videoId: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(YTDLP_PATH, [
      `https://www.youtube.com/watch?v=${videoId}`,
      '-f', '140',               // m4a audio‑only format
      '--no-playlist',
      '--skip-download',
      '--print', 'url',
      '--quiet',
    ]);
    const url = stdout.trim();
    return url || null;
  } catch (err) {
    console.warn('[yt‑dlp] failed to fetch audio URL for', videoId, err);
    return null;
  }
}
