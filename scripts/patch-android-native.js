import fs from 'fs';
import path from 'path';

console.log('[ShowVerse Native Optimizer] Starting 120 FPS Native Android Patch...');

const androidDir = path.resolve('android');
if (!fs.existsSync(androidDir)) {
  console.log('[ShowVerse Native Optimizer] Android directory not found, skipping patch.');
  process.exit(0);
}

// 1. Patch MainActivity.java with 120Hz Display Mode & Hardware Rasterization
const mainActivityPath = path.join(androidDir, 'app', 'src', 'main', 'java', 'com', 'showverse', 'app', 'MainActivity.java');

const highPerformanceMainActivity = `package com.showverse.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 1. Enable 120Hz / High Refresh Rate Display Mode
        enable120FpsHighRefreshRate();

        // 2. Hardware Acceleration & Native WebView Rendering Boost
        optimizeNativeWebView();

        // 3. Immersive Edge-to-Edge Dark Visuals
        setupEdgeToEdge();
    }

    private void enable120FpsHighRefreshRate() {
        try {
            Window window = getWindow();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Display display = getDisplay();
                if (display != null) {
                    Display.Mode[] modes = display.getSupportedModes();
                    Display.Mode bestMode = null;
                    float maxRate = 60.0f;
                    for (Display.Mode mode : modes) {
                        if (mode.getRefreshRate() > maxRate) {
                            maxRate = mode.getRefreshRate();
                            bestMode = mode;
                        }
                    }
                    if (bestMode != null) {
                        WindowManager.LayoutParams params = window.getAttributes();
                        params.preferredDisplayModeId = bestMode.getModeId();
                        window.setAttributes(params);
                    }
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Display display = getWindowManager().getDefaultDisplay();
                Display.Mode[] modes = display.getSupportedModes();
                Display.Mode bestMode = null;
                float maxRate = 60.0f;
                for (Display.Mode mode : modes) {
                    if (mode.getRefreshRate() > maxRate) {
                        maxRate = mode.getRefreshRate();
                        bestMode = mode;
                    }
                }
                if (bestMode != null) {
                    WindowManager.LayoutParams params = window.getAttributes();
                    params.preferredDisplayModeId = bestMode.getModeId();
                    window.setAttributes(params);
                }
            }
        } catch (Exception ignored) {}
    }

    private void optimizeNativeWebView() {
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                // 120 FPS GPU Rasterization & Rendering Priority
                settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setOffscreenPreRaster(true);
                settings.setMediaPlaybackRequiresUserGesture(false);

                // Enable Hardware Layer Acceleration
                webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);
                webView.setBackgroundColor(Color.parseColor("#060913"));
            }
        } catch (Exception ignored) {}
    }

    private void setupEdgeToEdge() {
        try {
            Window window = getWindow();
            window.setStatusBarColor(Color.parseColor("#060913"));
            window.setNavigationBarColor(Color.parseColor("#060913"));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                window.getAttributes().layoutInDisplayCutoutMode = 
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            }
        } catch (Exception ignored) {}
    }
}
`;

if (fs.existsSync(path.dirname(mainActivityPath))) {
  fs.writeFileSync(mainActivityPath, highPerformanceMainActivity, 'utf8');
  console.log('[ShowVerse Native Optimizer] Patched MainActivity.java with 120 FPS & GPU Acceleration.');
}

// 2. Patch AndroidManifest.xml with hardwareAccelerated, largeHeap
const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  if (!manifest.includes('android:hardwareAccelerated')) {
    manifest = manifest.replace(
      '<application',
      '<application\n        android:hardwareAccelerated="true"\n        android:largeHeap="true"'
    );
    fs.writeFileSync(manifestPath, manifest, 'utf8');
    console.log('[ShowVerse Native Optimizer] Patched AndroidManifest.xml with hardwareAccelerated="true" and largeHeap="true".');
  }
}

console.log('[ShowVerse Native Optimizer] 120 FPS Native Android Optimization Complete.');
