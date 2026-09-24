package co.ycswu.responsivemockupstudio;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.view.PixelCopy;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.ValueCallback;
import android.webkit.CookieManager;
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

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 6013;
    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";
    private FrameLayout rootLayout;
    private WebView webView;
    private FrameLayout previewContainer;
    private WebView previewWebView;
    private String previewUrl = "";
    private String previewCss = "";
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
        rootLayout = new FrameLayout(this);
        webView = new WebView(this);
        webView.setBackgroundColor(android.graphics.Color.rgb(8, 8, 8));
        rootLayout.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        createPreviewSurface();
        setContentView(rootLayout);

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
        WebChromeClient sharedChromeClient = new WebChromeClient() {
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
        };
        webView.setWebChromeClient(sharedChromeClient);
        previewWebView.setWebChromeClient(sharedChromeClient);

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

    private void createPreviewSurface() {
        previewContainer = new FrameLayout(this);
        previewContainer.setClipChildren(true);
        previewContainer.setClipToPadding(true);
        previewContainer.setVisibility(View.GONE);
        previewContainer.setBackgroundColor(android.graphics.Color.BLACK);

        previewWebView = new WebView(this);
        previewWebView.setBackgroundColor(android.graphics.Color.BLACK);
        WebSettings previewSettings = previewWebView.getSettings();
        previewSettings.setJavaScriptEnabled(true);
        previewSettings.setDomStorageEnabled(true);
        previewSettings.setDatabaseEnabled(true);
        previewSettings.setAllowFileAccess(false);
        previewSettings.setAllowContentAccess(true);
        previewSettings.setMediaPlaybackRequiresUserGesture(true);
        previewSettings.setBuiltInZoomControls(false);
        previewSettings.setDisplayZoomControls(false);
        previewSettings.setSupportZoom(false);
        previewSettings.setSupportMultipleWindows(false);
        previewSettings.setJavaScriptCanOpenWindowsAutomatically(false);
        previewSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        previewSettings.setUseWideViewPort(true);
        previewSettings.setLoadWithOverviewMode(false);
        previewSettings.setUserAgentString(previewSettings.getUserAgentString() + " RMS-Preview/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(previewWebView, true);
        previewWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                emitPreviewEvent("start", url, null);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                previewUrl = url == null ? previewUrl : url;
                applyPreviewCss();
                emitPreviewEvent("finish", previewUrl, null);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) emitPreviewEvent("error", request.getUrl().toString(), String.valueOf(error.getDescription()));
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String scheme = request.getUrl().getScheme();
                return !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme));
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                previewContainer.setVisibility(View.GONE);
                ViewGroup parent = (ViewGroup) view.getParent();
                if (parent != null) parent.removeView(view);
                view.destroy();
                previewWebView = null;
                Toast.makeText(MainActivity.this, "Website görüntüsü yenileniyor", Toast.LENGTH_SHORT).show();
                getWindow().getDecorView().post(MainActivity.this::recreate);
                return true;
            }
        });
        previewContainer.addView(previewWebView, new FrameLayout.LayoutParams(1, 1));
        rootLayout.addView(previewContainer, new FrameLayout.LayoutParams(1, 1));
    }

    private void handleBridgeMessage(@Nullable String json) {
        if (json == null || json.length() > 90_000_000) return;
        final JSONObject request;
        try {
            request = new JSONObject(json);
        } catch (Exception error) {
            Toast.makeText(this, "Geçersiz uygulama isteği", Toast.LENGTH_SHORT).show();
            return;
        }
        String type = request.optString("type", "");
        if ("sync-native-preview".equals(type)) {
            runOnUiThread(() -> syncNativePreview(request));
            return;
        }
        if ("native-preview-command".equals(type)) {
            runOnUiThread(() -> handlePreviewCommand(request.optString("command", "")));
            return;
        }
        if ("capture-rendered-region".equals(type)) {
            runOnUiThread(() -> captureRenderedRegion(request));
            return;
        }
        new Thread(() -> {
            try {
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

    private void syncNativePreview(@NonNull JSONObject request) {
        if (previewContainer == null || previewWebView == null || rootLayout == null || webView == null) return;
        if (!request.optBoolean("visible", false)) {
            previewContainer.setVisibility(View.GONE);
            return;
        }
        try {
            JSONObject rectJson = request.getJSONObject("rect");
            JSONObject viewportJson = request.getJSONObject("cssViewport");
            JSONObject virtualJson = request.getJSONObject("virtualViewport");
            String url = request.optString("url", "");
            Uri uri = Uri.parse(url);
            String scheme = uri.getScheme();
            if (!("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))) {
                previewContainer.setVisibility(View.GONE);
                return;
            }

            double cssWidth = Math.max(1d, viewportJson.optDouble("width", webView.getWidth()));
            double cssHeight = Math.max(1d, viewportJson.optDouble("height", webView.getHeight()));
            double scaleX = webView.getWidth() / cssWidth;
            double scaleY = webView.getHeight() / cssHeight;
            int[] webLocation = new int[2];
            int[] rootLocation = new int[2];
            webView.getLocationInWindow(webLocation);
            rootLayout.getLocationInWindow(rootLocation);

            int left = webLocation[0] - rootLocation[0] + (int) Math.round(rectJson.optDouble("x", 0d) * scaleX);
            int top = webLocation[1] - rootLocation[1] + (int) Math.round(rectJson.optDouble("y", 0d) * scaleY);
            int right = left + (int) Math.round(rectJson.optDouble("width", 0d) * scaleX);
            int bottom = top + (int) Math.round(rectJson.optDouble("height", 0d) * scaleY);
            left = Math.max(0, Math.min(left, rootLayout.getWidth()));
            top = Math.max(0, Math.min(top, rootLayout.getHeight()));
            right = Math.max(left, Math.min(right, rootLayout.getWidth()));
            bottom = Math.max(top, Math.min(bottom, rootLayout.getHeight()));
            int surfaceWidth = right - left;
            int surfaceHeight = bottom - top;
            if (surfaceWidth < 2 || surfaceHeight < 2) {
                previewContainer.setVisibility(View.GONE);
                return;
            }

            FrameLayout.LayoutParams containerParams = new FrameLayout.LayoutParams(surfaceWidth, surfaceHeight);
            containerParams.leftMargin = left;
            containerParams.topMargin = top;
            previewContainer.setLayoutParams(containerParams);

            double density = Math.max(1d, getResources().getDisplayMetrics().density);
            double virtualWidth = Math.max(1d, virtualJson.optDouble("width", surfaceWidth / density));
            double virtualHeight = Math.max(1d, virtualJson.optDouble("height", surfaceHeight / density));
            double contentWidth = virtualWidth * density;
            double contentHeight = virtualHeight * density;
            double textureReduction = Math.min(1d, 4096d / Math.max(contentWidth, contentHeight));
            int layoutWidth = Math.max(1, (int) Math.round(contentWidth * textureReduction));
            int layoutHeight = Math.max(1, (int) Math.round(contentHeight * textureReduction));
            FrameLayout.LayoutParams previewParams = new FrameLayout.LayoutParams(layoutWidth, layoutHeight);
            previewWebView.setLayoutParams(previewParams);
            previewWebView.setPivotX(0f);
            previewWebView.setPivotY(0f);
            previewWebView.setScaleX(surfaceWidth / (float) layoutWidth);
            previewWebView.setScaleY(surfaceHeight / (float) layoutHeight);
            previewWebView.setTranslationX(0f);
            previewWebView.setTranslationY(0f);

            String css = request.optString("css", "");
            boolean cssChanged = !css.equals(previewCss);
            previewCss = css;
            previewContainer.setVisibility(View.VISIBLE);
            previewContainer.bringToFront();
            previewContainer.requestLayout();
            previewWebView.requestLayout();

            if (!url.equals(previewUrl)) {
                previewUrl = url;
                previewWebView.loadUrl(url);
            } else if (cssChanged) {
                applyPreviewCss();
            }
        } catch (Exception error) {
            previewContainer.setVisibility(View.GONE);
            emitPreviewEvent("error", previewUrl, error.getMessage());
        }
    }

    private void handlePreviewCommand(@Nullable String command) {
        if (previewWebView == null || command == null) return;
        switch (command) {
            case "back":
                if (previewWebView.canGoBack()) previewWebView.goBack();
                break;
            case "forward":
                if (previewWebView.canGoForward()) previewWebView.goForward();
                break;
            case "reload":
                previewWebView.reload();
                break;
            default:
                break;
        }
    }

    private void applyPreviewCss() {
        if (previewWebView == null) return;
        String script = "(()=>{let style=document.getElementById('__rms_native_presentation');"
                + "if(!style){style=document.createElement('style');style.id='__rms_native_presentation';"
                + "(document.head||document.documentElement).appendChild(style);}"
                + "style.textContent=" + JSONObject.quote(previewCss) + ";return true;})()";
        previewWebView.evaluateJavascript(script, null);
    }

    private void emitPreviewEvent(@NonNull String type, @Nullable String url, @Nullable String error) {
        if (webView == null) return;
        try {
            JSONObject payload = new JSONObject();
            payload.put("type", type);
            if (url != null) payload.put("url", url);
            if (error != null) payload.put("error", error);
            String script = "window.__rmsAndroidPreviewEvent&&window.__rmsAndroidPreviewEvent(" + payload + ")";
            webView.evaluateJavascript(script, null);
        } catch (Exception ignored) {
            // The preview event is advisory; the app shell remains usable without it.
        }
    }

    private void captureRenderedRegion(@NonNull JSONObject request) {
        String requestId = request.optString("requestId", "");
        if (requestId.isEmpty() || webView == null || webView.getWidth() <= 0 || webView.getHeight() <= 0) {
            resolveRenderedCapture(requestId, null, "Android preview surface is unavailable.");
            return;
        }
        try {
            JSONObject rectJson = request.getJSONObject("rect");
            JSONObject viewportJson = request.getJSONObject("cssViewport");
            JSONObject targetJson = request.getJSONObject("target");
            double cssWidth = Math.max(1d, viewportJson.optDouble("width", webView.getWidth()));
            double cssHeight = Math.max(1d, viewportJson.optDouble("height", webView.getHeight()));
            double scaleX = webView.getWidth() / cssWidth;
            double scaleY = webView.getHeight() / cssHeight;
            int[] location = new int[2];
            webView.getLocationInWindow(location);
            int left = location[0] + (int) Math.round(rectJson.optDouble("x", 0d) * scaleX);
            int top = location[1] + (int) Math.round(rectJson.optDouble("y", 0d) * scaleY);
            int right = left + (int) Math.round(rectJson.optDouble("width", 0d) * scaleX);
            int bottom = top + (int) Math.round(rectJson.optDouble("height", 0d) * scaleY);
            View decor = getWindow().getDecorView();
            left = Math.max(0, Math.min(left, decor.getWidth()));
            top = Math.max(0, Math.min(top, decor.getHeight()));
            right = Math.max(left, Math.min(right, decor.getWidth()));
            bottom = Math.max(top, Math.min(bottom, decor.getHeight()));
            if (right <= left || bottom <= top) throw new IllegalArgumentException("Preview region is empty.");

            double requestedWidth = Math.max(1d, targetJson.optDouble("width", right - left));
            double requestedHeight = Math.max(1d, targetJson.optDouble("height", bottom - top));
            double reduction = Math.min(1d, 2560d / Math.max(requestedWidth, requestedHeight));
            reduction = Math.min(reduction, Math.sqrt(6_553_600d / (requestedWidth * requestedHeight)));
            int targetWidth = Math.max(1, (int) Math.round(requestedWidth * reduction));
            int targetHeight = Math.max(1, (int) Math.round(requestedHeight * reduction));
            Bitmap bitmap = Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888);
            Rect source = new Rect(left, top, right, bottom);
            PixelCopy.request(getWindow(), source, bitmap, result -> {
                if (result != PixelCopy.SUCCESS) {
                    bitmap.recycle();
                    resolveRenderedCapture(requestId, null, "Android rendered capture failed (" + result + ").");
                    return;
                }
                try (ByteArrayOutputStream stream = new ByteArrayOutputStream()) {
                    if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)) {
                        throw new IllegalStateException("PNG encoding failed.");
                    }
                    String dataUrl = "data:image/png;base64," + Base64.getEncoder().encodeToString(stream.toByteArray());
                    resolveRenderedCapture(requestId, dataUrl, null);
                } catch (Exception error) {
                    resolveRenderedCapture(requestId, null, error.getMessage());
                } finally {
                    bitmap.recycle();
                }
            }, new Handler(Looper.getMainLooper()));
        } catch (Exception error) {
            resolveRenderedCapture(requestId, null, error.getMessage());
        }
    }

    private void resolveRenderedCapture(@Nullable String requestId, @Nullable String dataUrl, @Nullable String error) {
        if (webView == null || requestId == null || requestId.isEmpty()) return;
        String script = "window.__rmsResolveAndroidCapture&&window.__rmsResolveAndroidCapture("
                + JSONObject.quote(requestId) + ","
                + (dataUrl == null ? "undefined" : JSONObject.quote(dataUrl)) + ","
                + (error == null ? "undefined" : JSONObject.quote(error)) + ")";
        webView.evaluateJavascript(script, null);
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
        if (previewWebView != null && previewContainer != null
                && previewContainer.getVisibility() == View.VISIBLE && previewWebView.canGoBack()) {
            previewWebView.goBack();
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
    protected void onPause() {
        if (previewWebView != null) previewWebView.onPause();
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        if (previewWebView != null) previewWebView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
        hideFullscreenView();
        if (previewWebView != null) {
            previewWebView.stopLoading();
            previewWebView.loadUrl("about:blank");
            previewWebView.destroy();
            previewWebView = null;
        }
        if (webView != null) { webView.stopLoading(); webView.destroy(); }
        super.onDestroy();
    }
}
