package com.adify.app;

import android.content.Context;
import android.content.Intent;
import android.webkit.JavascriptInterface;

public class WebAppInterface {
    Context mContext;

    WebAppInterface(Context c) {
        mContext = c;
    }

    @JavascriptInterface
    public void onTrackChanged(String title, String artist, String coverUrl) {
        try {
            Intent serviceIntent = new Intent(mContext, MediaPlaybackService.class);
            serviceIntent.setAction("UPDATE_METADATA");
            serviceIntent.putExtra("title", title != null ? title : "Unknown Title");
            serviceIntent.putExtra("artist", artist != null ? artist : "Unknown Artist");
            serviceIntent.putExtra("cover", coverUrl);
            mContext.startForegroundService(serviceIntent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public void onPlaybackStateChanged(boolean isPlaying, double currentTimeSec, double durationSec) {
        try {
            Intent serviceIntent = new Intent(mContext, MediaPlaybackService.class);
            serviceIntent.setAction("UPDATE_PLAYBACK_STATE");
            serviceIntent.putExtra("isPlaying", isPlaying);
            serviceIntent.putExtra("currentTimeMs", (long)(currentTimeSec * 1000));
            serviceIntent.putExtra("durationMs", (long)(durationSec * 1000));
            mContext.startForegroundService(serviceIntent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public void saveFile(String filename, String base64Data) {
        try {
            byte[] fileBytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
            java.io.File path = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS);
            java.io.File file = new java.io.File(path, filename);
            java.io.FileOutputStream os = new java.io.FileOutputStream(file, false);
            os.write(fileBytes);
            os.flush();
            os.close();
            android.widget.Toast.makeText(mContext, "Saved to Downloads: " + filename, android.widget.Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            e.printStackTrace();
            android.widget.Toast.makeText(mContext, "Failed to save file", android.widget.Toast.LENGTH_SHORT).show();
        }
    }
}
