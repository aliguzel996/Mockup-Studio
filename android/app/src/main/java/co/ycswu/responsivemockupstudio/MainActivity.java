package co.ycswu.responsivemockupstudio;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.ValueCallback;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 6013;
    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";
    private WebView webView;
    private ValueCallback<Uri[]> pendingFileCallback;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private long lastBackPressedAt;

    @Override
    protected void onCreate(@Nullable Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(8, 8, 8));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(8, 8, 8));
        webView = new WebView(this);
        webView.setBackgroundColor(android.graphics.Color.rgb(8, 8, 8));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " RMS-Android/" + BuildConfig.VERSION_NAME);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame() || isAppUrl(request.getUrl())) return false;
                Toast.makeText(MainActivity.this, "Bağlantı uygulama önizlemesinin dışına çıkamaz", Toast.LENGTH_SHORT).show();
                return true;
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                ViewGroup parent = (ViewGroup) view.getParent();
                if (parent != null) parent.removeView(view);
                view.destroy();
                webView = null;
                Toast.makeText(MainActivity.this, "Görüntü motoru yenileniyor", Toast.LENGTH_SHORT).show();
                getWindow().getDecorView().post(MainActivity.this::recreate);
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
                pendingFileCallback = callback;
                Intent intent;
                try {
                    intent = params.createIntent();
                } catch (Exception error) {
                    pendingFileCallback = null;
                    Toast.makeText(MainActivity.this, "Dosya seçici açılamadı", Toast.LENGTH_SHORT).show();
                    return false;
                }
                startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                return true;
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                fullscreenView = view;
                fullscreenCallback = callback;
                addContentView(view, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT));
                webView.setVisibility(View.GONE);
            }

            @Override
            public void onHideCustomView() {
                hideFullscreenView();
            }
        });

        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "RMSAndroid", Collections.singleton(APP_ORIGIN),
                    (view, message, sourceOrigin, isMainFrame, replyProxy) -> {
                        if (!isMainFrame || !APP_ORIGIN.equals(sourceOrigin.toString())) return;
                        handleBridgeMessage(message.getData());
                    });
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(0, () -> {
                if (!handleBack()) finish();
            });
        }

        webView.loadUrl(APP_ORIGIN + "/index.html");
    }

    private boolean isAppUrl(@Nullable Uri uri) {
        return uri != null
                && "https".equalsIgnoreCase(uri.getScheme())
                && "appassets.androidplatform.net".equalsIgnoreCase(uri.getHost());
    }

    private void handleBridgeMessage(@Nullable String json) {
        if (json == null || json.length() > 90_000_000) return;
        new Thread(() -> {
            try {
                JSONObject request = new JSONObject(json);
                String type = request.optString("type", "");
                String name = sanitizeName(request.optString("name", "responsive-mockup"));
                String mime;
                byte[] bytes;
                if ("save-data-url".equals(type)) {
                    String dataUrl = request.getString("dataUrl");
                    int comma = dataUrl.indexOf(',');
                    if (comma < 0 || !dataUrl.substring(0, comma).contains(";base64")) throw new IllegalArgumentException("Invalid data URL");
                    mime = dataUrl.substring(5, dataUrl.indexOf(';'));
                    bytes = Base64.getDecoder().decode(dataUrl.substring(comma + 1));
                } else if ("save-text".equals(type)) {
                    mime = request.optString("mime", "text/plain");
                    bytes = request.getString("text").getBytes(StandardCharsets.UTF_8);
                } else {
                    return;
                }
                if (bytes.length > 64 * 1024 * 1024) throw new IllegalArgumentException("Export is larger than 64 MB");
                Uri saved = saveToDownloads(name, mime, bytes);
                runOnUiThread(() -> Toast.makeText(this, "Kaydedildi: " + name, Toast.LENGTH_LONG).show());
            } catch (Exception error) {
                runOnUiThread(() -> Toast.makeText(this, "Dışa aktarma başarısız: " + error.getMessage(), Toast.LENGTH_LONG).show());
            }
        }, "rms-export").start();
    }

    private Uri saveToDownloads(String name, String mime, byte[] bytes) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, name);
            values.put(MediaStore.Downloads.MIME_TYPE, mime);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Responsive Mockup Studio");
            values.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("Download location unavailable");
            try (OutputStream stream = getContentResolver().openOutputStream(uri)) {
                if (stream == null) throw new IllegalStateException("Output stream unavailable");
                stream.write(bytes);
            }
            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            getContentResolver().update(uri, values, null, null);
            return uri;
        }
        File directory = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "Responsive Mockup Studio");
        if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Download directory unavailable");
        File file = new File(directory, name);
        try (FileOutputStream stream = new FileOutputStream(file)) { stream.write(bytes); }
        return Uri.fromFile(file);
    }

    private String sanitizeName(String raw) {
        String clean = raw.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "-").replaceAll("\\s+", " ").trim();
        if (clean.isEmpty()) clean = "responsive-mockup";
        return clean.length() > 120 ? clean.substring(0, 120) : clean;
    }

    private void hideFullscreenView() {
        if (fullscreenView == null) return;
        ViewGroup parent = (ViewGroup) fullscreenView.getParent();
        if (parent != null) parent.removeView(fullscreenView);
        fullscreenView = null;
        if (webView != null) webView.setVisibility(View.VISIBLE);
        if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
        fullscreenCallback = null;
    }

    private boolean handleBack() {
        if (fullscreenView != null) {
            hideFullscreenView();
            return true;
        }
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        long now = android.os.SystemClock.elapsedRealtime();
        if (now - lastBackPressedAt <= 2000) return false;
        lastBackPressedAt = now;
        Toast.makeText(this, "Çıkmak için geri tuşuna tekrar basın", Toast.LENGTH_SHORT).show();
        return true;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || pendingFileCallback == null) return;
        Uri[] result = resultCode == RESULT_OK ? WebChromeClient.FileChooserParams.parseResult(resultCode, data) : null;
        pendingFileCallback.onReceiveValue(result);
        pendingFileCallback = null;
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU && handleBack()) return;
        super.onBackPressed();
    }

    @Override
    protected void onPause() { if (webView != null) webView.onPause(); super.onPause(); }

    @Override
    protected void onResume() { super.onResume(); if (webView != null) webView.onResume(); }

    @Override
    protected void onDestroy() {
        if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
        hideFullscreenView();
        if (webView != null) { webView.stopLoading(); webView.destroy(); }
        super.onDestroy();
    }
}
