package com.adify.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MediaPlaybackService extends Service {
    public static final String ACTION_PLAY = "action_play";
    public static final String ACTION_PAUSE = "action_pause";
    public static final String ACTION_NEXT = "action_next";
    public static final String ACTION_PREV = "action_prev";

    private MediaSessionCompat mediaSession;
    private static final String CHANNEL_ID = "adify_media_channel";
    private static final int NOTIFICATION_ID = 101;

    private boolean isPlaying = false;
    private String currentTitle = "No Song";
    private String currentArtist = "Adify";
    private Bitmap currentCover = null;
    private long currentPositionMs = 0;
    private long durationMs = 0;

    // A static reference to MainActivity to send JS callbacks. In a production app, use BroadcastReceiver or bound service.
    public static MainActivity mainActivityInstance = null;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        mediaSession = new MediaSessionCompat(this, "AdifyMediaSession");
        
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                handleAction(ACTION_PLAY);
            }

            @Override
            public void onPause() {
                handleAction(ACTION_PAUSE);
            }

            @Override
            public void onSkipToNext() {
                handleAction(ACTION_NEXT);
            }

            @Override
            public void onSkipToPrevious() {
                handleAction(ACTION_PREV);
            }

            @Override
            public void onSeekTo(long pos) {
                if (mainActivityInstance != null) {
                    mainActivityInstance.seekTo(pos);
                }
            }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.getAction() != null) {
            String action = intent.getAction();
            
            if (action.equals("UPDATE_METADATA")) {
                currentTitle = intent.getStringExtra("title");
                currentArtist = intent.getStringExtra("artist");
                String coverUrl = intent.getStringExtra("cover");
                isPlaying = intent.getBooleanExtra("isPlaying", false);
                
                new Thread(() -> {
                    Bitmap bmp = getBitmapFromURL(coverUrl);
                    currentCover = bmp;
                    updateNotificationAndSession();
                }).start();
                
            } else if (action.equals("UPDATE_PLAYBACK_STATE")) {
                isPlaying = intent.getBooleanExtra("isPlaying", false);
                currentPositionMs = intent.getLongExtra("currentTimeMs", 0);
                durationMs = intent.getLongExtra("durationMs", 0);
                updateNotificationAndSession();
            } else {
                handleAction(action);
            }
        }
        
        return START_NOT_STICKY;
    }

    private void handleAction(String action) {
        if (mainActivityInstance != null) {
            switch (action) {
                case ACTION_PLAY:
                case ACTION_PAUSE:
                    mainActivityInstance.togglePlayPause();
                    break;
                case ACTION_NEXT:
                    mainActivityInstance.nextTrack();
                    break;
                case ACTION_PREV:
                    mainActivityInstance.prevTrack();
                    break;
            }
        }
    }

    private void updateNotificationAndSession() {
        // Update Session State
        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        float playbackSpeed = isPlaying ? 1.0f : 0.0f;
        mediaSession.setPlaybackState(new PlaybackStateCompat.Builder()
                .setState(state, currentPositionMs, playbackSpeed)
                .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | 
                            PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                            PlaybackStateCompat.ACTION_SEEK_TO)
                .build());

        // Update Metadata
        MediaMetadataCompat.Builder metadataBuilder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs);
        if (currentCover != null) {
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentCover);
        }
        mediaSession.setMetadata(metadataBuilder.build());

        // Build Notification
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification() {
        Intent playPauseIntent = new Intent(this, MediaPlaybackService.class);
        playPauseIntent.setAction(isPlaying ? ACTION_PAUSE : ACTION_PLAY);
        PendingIntent playPausePendingIntent = PendingIntent.getService(this, 0, playPauseIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent nextIntent = new Intent(this, MediaPlaybackService.class);
        nextIntent.setAction(ACTION_NEXT);
        PendingIntent nextPendingIntent = PendingIntent.getService(this, 1, nextIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent prevIntent = new Intent(this, MediaPlaybackService.class);
        prevIntent.setAction(ACTION_PREV);
        PendingIntent prevPendingIntent = PendingIntent.getService(this, 2, prevIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent appIntent = new Intent(this, MainActivity.class);
        appIntent.setAction(Intent.ACTION_MAIN);
        appIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        PendingIntent appPendingIntent = PendingIntent.getActivity(this, 0, appIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setLargeIcon(currentCover)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(appPendingIntent)
                .addAction(android.R.drawable.ic_media_previous, "Previous", prevPendingIntent)
                .addAction(isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, "Play/Pause", playPausePendingIntent)
                .addAction(android.R.drawable.ic_media_next, "Next", nextPendingIntent)
                .setStyle(new MediaStyle()
                        .setMediaSession(mediaSession.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2));

        return builder.build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Media Playback",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Bitmap getBitmapFromURL(String src) {
        if (src == null || src.isEmpty()) return null;
        try {
            URL url = new URL(src);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setDoInput(true);
            connection.connect();
            InputStream input = connection.getInputStream();
            return BitmapFactory.decodeStream(input);
        } catch (Exception e) {
            return null;
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        mediaSession.release();
    }
}
