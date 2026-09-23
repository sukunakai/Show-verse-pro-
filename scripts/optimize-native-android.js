import fs from 'fs';
import path from 'path';

console.log('[Native Optimization] Starting native 120 FPS Android optimization...');

const androidDir = path.resolve('android');
if (!fs.existsSync(androidDir)) {
  console.log('[Native Optimization] android directory not found. Skipping.');
  process.exit(0);
}

// 1. Optimize AndroidManifest.xml
const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');

  // Add VIBRATE permission for native haptic feedback
  if (!manifest.includes('android.permission.VIBRATE')) {
    manifest = manifest.replace(
      '</manifest>',
      '    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>'
    );
  }

  // Ensure application has hardwareAccelerated and largeHeap
  if (!manifest.includes('android:hardwareAccelerated="true"')) {
    manifest = manifest.replace(
      '<application',
      '<application\n        android:hardwareAccelerated="true"\n        android:largeHeap="true"'
    );
  } else if (!manifest.includes('android:largeHeap="true"')) {
    manifest = manifest.replace(
      'android:hardwareAccelerated="true"',
      'android:hardwareAccelerated="true" android:largeHeap="true"'
    );
  }

  fs.writeFileSync(manifestPath, manifest, 'utf8');
  console.log('[Native Optimization] Updated AndroidManifest.xml for 120 FPS Hardware Acceleration & Large Heap');
}

// 2. Locate and Upgrade MainActivity.java for 120Hz Display & Hardware WebView
const javaDir = path.join(androidDir, 'app', 'src', 'main', 'java');
function findMainActivity(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      const found = findMainActivity(full);
      if (found) return found;
    } else if (f.name === 'MainActivity.java') {
      return full;
    }
  }
  return null;
}

const mainActivityPath = findMainActivity(javaDir);
if (mainActivityPath && fs.existsSync(mainActivityPath)) {
  console.log('[Native Optimization] Patching MainActivity at:', mainActivityPath);

  const nativeMainActivity = `package com.showverse.app;

import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Force High Refresh Rate (90Hz / 120Hz / 144Hz) for Silky Smooth Animation
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Display display = getWindowManager().getDefaultDisplay();
                Display.Mode[] modes = display.getSupportedModes();
                Display.Mode maxRefreshMode = null;
                float highestRate = 60.0f;
                for (Display.Mode mode : modes) {
                    if (mode.getRefreshRate() > highestRate) {
                        highestRate = mode.getRefreshRate();
                        maxRefreshMode = mode;
                    }
                }
                if (maxRefreshMode != null) {
                    WindowManager.LayoutParams params = getWindow().getAttributes();
                    params.preferredDisplayModeId = maxRefreshMode.getModeId();
                    getWindow().setAttributes(params);
                }
            }
        } catch (Exception e) {
            // Ignore if display mode switching not supported on device
        }

        // 2. Native Navigation Bar and Status Bar immersive styling
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                getWindow().setNavigationBarColor(0xFF060913);
                getWindow().setStatusBarColor(0xFF060913);
            }
        } catch (Exception e) {}

        // 3. Hardware Acceleration & WebView Tuning for 120 FPS
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                // Hardware layer rendering
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
                
                WebSettings settings = webView.getSettings();
                settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setAllowFileAccess(true);
                settings.setOffscreenPreRaster(true);
            }
        } catch (Exception e) {
            // Safe fallback
        }
    }
}
`;

  fs.writeFileSync(mainActivityPath, nativeMainActivity, 'utf8');
  console.log('[Native Optimization] MainActivity.java upgraded with 120Hz display locking & hardware rasterization');
}

// 3. Update styles.xml for pure dark native theme
const stylesPath = path.join(androidDir, 'app', 'src', 'main', 'res', 'values', 'styles.xml');
if (fs.existsSync(stylesPath)) {
  let styles = fs.readFileSync(stylesPath, 'utf8');
  if (!styles.includes('navigationBarColor')) {
    styles = styles.replace(
      '</style>',
      '        <item name="android:navigationBarColor">#060913</item>\n        <item name="android:statusBarColor">#060913</item>\n        <item name="android:windowBackground">#060913</item>\n    </style>'
    );
    fs.writeFileSync(stylesPath, styles, 'utf8');
    console.log('[Native Optimization] Updated styles.xml with native dark colors');
  }
}

console.log('[Native Optimization] All Native 120 FPS Android optimizations completed.');
