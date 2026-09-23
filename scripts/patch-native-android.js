import fs from 'fs';
import path from 'path';

// Script to patch Android Native files for 120 FPS high refresh rate,
// GPU hardware acceleration, and edge-to-edge native UI experience.

const mainActivityPath = path.resolve('android', 'app', 'src', 'main', 'java', 'com', 'showverse', 'app', 'MainActivity.java');
const manifestPath = path.resolve('android', 'app', 'src', 'main', 'AndroidManifest.xml');

// 1. Patch MainActivity.java
if (fs.existsSync(mainActivityPath)) {
  const nativeMainActivity = `package com.showverse.app;

import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Unlock 120 FPS / High Refresh Rate for Ultra-Smooth Motion
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Display display = getDisplay();
                if (display != null) {
                    Display.Mode[] modes = display.getSupportedModes();
                    Display.Mode maxMode = null;
                    for (Display.Mode mode : modes) {
                        if (maxMode == null || mode.getRefreshRate() > maxMode.getRefreshRate()) {
                            maxMode = mode;
                        }
                    }
                    if (maxMode != null) {
                        WindowManager.LayoutParams params = getWindow().getAttributes();
                        params.preferredDisplayModeId = maxMode.getModeId();
                        getWindow().setAttributes(params);
                    }
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                WindowManager.LayoutParams params = getWindow().getAttributes();
                params.preferredRefreshRate = 120f;
                getWindow().setAttributes(params);
            }
        } catch (Exception ignored) {}

        // 2. Hardware Acceleration & Native Edge-to-Edge System Bar Colors
        Window window = getWindow();
        window.setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );
        window.setNavigationBarColor(0xFF060913);
        window.setStatusBarColor(0xFF060913);

        // 3. Optimize Native WebView Layer for 120 FPS Rendering
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
                WebSettings settings = webView.getSettings();
                settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
            }
        } catch (Exception ignored) {}
    }
}
`;
  fs.writeFileSync(mainActivityPath, nativeMainActivity, 'utf8');
  console.log('✓ Successfully patched MainActivity.java for 120 FPS native performance!');
} else {
  console.log('MainActivity.java not found yet (will be patched during CI build).');
}

// 2. Patch AndroidManifest.xml for Hardware Acceleration & High Performance
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  if (!manifest.includes('android:hardwareAccelerated="true"')) {
    manifest = manifest.replace('<application', '<application\n        android:hardwareAccelerated="true"\n        android:largeHeap="true"');
    fs.writeFileSync(manifestPath, manifest, 'utf8');
    console.log('✓ Patched AndroidManifest.xml with hardwareAccelerated=true and largeHeap=true!');
  }
}
