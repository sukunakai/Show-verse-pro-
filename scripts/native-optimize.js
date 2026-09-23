import fs from 'fs';
import path from 'path';

console.log('--- Applying Full Native 120 FPS Android Optimizations ---');

const androidDir = path.resolve('android');
if (!fs.existsSync(androidDir)) {
  console.log('No android directory found yet. Skipping.');
  process.exit(0);
}

// 1. Optimize MainActivity.java for 120 FPS & Hardware Acceleration
const mainActivityPath = path.resolve('android/app/src/main/java/com/showverse/app/MainActivity.java');
if (fs.existsSync(mainActivityPath)) {
  const optimizedMainActivity = `package com.showverse.app;

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
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Force Highest Screen Refresh Rate (120 Hz / 90 Hz / 144 Hz)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Display display = getWindowManager().getDefaultDisplay();
                Display.Mode[] modes = display.getSupportedModes();
                Display.Mode maxMode = null;
                float maxRefreshRate = 60.0f;
                for (Display.Mode mode : modes) {
                    if (mode.getRefreshRate() > maxRefreshRate) {
                        maxRefreshRate = mode.getRefreshRate();
                        maxMode = mode;
                    }
                }
                if (maxMode != null) {
                    WindowManager.LayoutParams params = getWindow().getAttributes();
                    params.preferredDisplayModeId = maxMode.getModeId();
                    getWindow().setAttributes(params);
                }
            } catch (Exception ignored) {}
        }

        // 2. Enable Window Hardware Acceleration & Keep GPU Rasterization Active
        try {
            getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
            );
        } catch (Exception ignored) {}

        // 3. Configure Native WebView for 120 FPS Fluid Scrolling & Zero Latency
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
            webView.setVerticalScrollBarEnabled(false);
            webView.setHorizontalScrollBarEnabled(false);
            
            WebSettings settings = webView.getSettings();
            try {
                settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
            } catch (Exception ignored) {}
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
        }
    }
}
`;
  fs.writeFileSync(mainActivityPath, optimizedMainActivity, 'utf8');
  console.log('✓ Injected 120 FPS High Refresh Rate & GPU acceleration into MainActivity.java');
}

// 2. Optimize AndroidManifest.xml
const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  if (!manifest.includes('android:largeHeap="true"')) {
    manifest = manifest.replace(
      '<application',
      '<application\n        android:largeHeap="true"\n        android:hardwareAccelerated="true"\n        android:usesCleartextTraffic="true"'
    );
    fs.writeFileSync(manifestPath, manifest, 'utf8');
    console.log('✓ Enabled largeHeap, hardwareAccelerated, and cleartext in AndroidManifest.xml');
  }
}

// 3. Optimize styles.xml for seamless native splash and edge-to-edge colors
const stylesPaths = [
  path.resolve('android/app/src/main/res/values/styles.xml'),
  path.resolve('android/app/src/main/res/values-night/styles.xml')
];

stylesPaths.forEach(sp => {
  if (fs.existsSync(sp)) {
    let styles = fs.readFileSync(sp, 'utf8');
    if (!styles.includes('android:windowBackground')) {
      styles = styles.replace(
        '</style>',
        `    <item name="android:windowBackground">@color/ic_launcher_background</item>
        <item name="android:navigationBarColor">#060913</item>
        <item name="android:statusBarColor">#060913</item>
    </style>`
      );
      fs.writeFileSync(sp, styles, 'utf8');
      console.log('✓ Configured dark native window theme in', path.basename(path.dirname(sp)) + '/' + path.basename(sp));
    }
  }
});

console.log('--- Native 120 FPS Android Optimization Complete ---');
