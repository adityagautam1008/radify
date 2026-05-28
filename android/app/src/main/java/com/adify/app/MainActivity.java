package com.adify.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.webkit.ValueCallback;

public class MainActivity extends Activity {
    private WebView webView;
    public static final int FILE_CHOOSER_RESULT_CODE = 10000;
    private ValueCallback<Uri[]> mUploadMessage;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        WebView.setWebContentsDebuggingEnabled(true);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage consoleMessage) {
                android.util.Log.e("WebViewError", consoleMessage.message() + " -- From line "
                        + consoleMessage.lineNumber() + " of " + consoleMessage.sourceId());
                return super.onConsoleMessage(consoleMessage);
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (mUploadMessage != null) {
                    mUploadMessage.onReceiveValue(null);
                }
                mUploadMessage = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_RESULT_CODE);
                } catch (Exception e) {
                    mUploadMessage = null;
                    return false;
                }
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                view.loadUrl(request.getUrl().toString());
                return true;
            }
        });

        webView.addJavascriptInterface(new WebAppInterface(this), "Android");
        MediaPlaybackService.mainActivityInstance = this;

        setContentView(webView);
        webView.loadUrl(getString(R.string.adify_server_url));
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_RESULT_CODE) {
            if (mUploadMessage == null) return;
            Uri[] result = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) {
                    result = new Uri[]{Uri.parse(dataString)};
                }
            }
            mUploadMessage.onReceiveValue(result);
            mUploadMessage = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            // Call JavaScript to handle in-app tab navigation instead of webView.goBack(),
            // which would reload the SPA and kill the audio player.
            webView.evaluateJavascript(
                "(function(){ if(window.handleBackButton) return window.handleBackButton(); return false; })()",
                result -> {
                    // If JS returned "true", the back was handled in-app (tab switched).
                    // If "false" or null, the user is already on home — minimize app to keep music playing.
                    if (!"true".equals(result)) {
                        runOnUiThread(() -> moveTaskToBack(true));
                    }
                }
            );
            return;
        }
        moveTaskToBack(true);
    }

    @Override
    protected void onDestroy() {
        if (MediaPlaybackService.mainActivityInstance == this) {
            MediaPlaybackService.mainActivityInstance = null;
        }
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    public void togglePlayPause() {
        runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript("if(window.togglePlay) window.togglePlay();", null);
            }
        });
    }

    public void nextTrack() {
        runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript("if(window.nextTrack) window.nextTrack();", null);
            }
        });
    }

    public void prevTrack() {
        runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript("if(window.prevTrack) window.prevTrack();", null);
            }
        });
    }

    public void seekTo(long positionMs) {
        runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript("if(window.seekToMs) window.seekToMs(" + positionMs + ");", null);
            }
        });
    }
}
