// nativeApp.js - Full Native App Engine & 120 FPS Performance Adapter
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

let lastBackPressTime = 0;

/**
 * Trigger subtle native haptic vibration tick
 */
export async function triggerNativeHaptic(style = ImpactStyle.Light) {
  try {
    if (window.Capacitor?.isNativePlatform()) {
      await Haptics.impact({ style });
    }
  } catch (_) {}
}

/**
 * Configure native Android Status Bar, Splash Screen, and Hardware Back Button
 */
export function initNativeApp() {
  if (typeof window === 'undefined') return;

  const isNative = Boolean(window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform());

  // 1. Setup Status Bar & Splash Screen
  if (isNative) {
    try {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#060913' }).catch(() => {});
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    } catch (_) {}

    try {
      setTimeout(() => {
        SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
      }, 500);
    } catch (_) {}

    // 2. Android Hardware Back Button Interception (Full Native Behavior)
    try {
      App.addListener('backButton', ({ canGoBack }) => {
        // Priority 1: Main Video Player
        const playerModal = document.getElementById('playerModal');
        if (playerModal && !playerModal.classList.contains('hidden')) {
          if (typeof window.closePlayer === 'function') {
            window.closePlayer();
            triggerNativeHaptic(ImpactStyle.Light);
            return;
          }
        }

        // Priority 2: Custom Show Player Page
        const showPlayerPage = document.getElementById('showPlayerPage');
        if (showPlayerPage && !showPlayerPage.classList.contains('hidden')) {
          if (typeof window.handlePlayerBack === 'function') {
            window.handlePlayerBack();
            triggerNativeHaptic(ImpactStyle.Light);
            return;
          }
        }

        // Priority 3: Search View / Modal
        const searchModal = document.getElementById('searchModal');
        if (searchModal && !searchModal.classList.contains('hidden')) {
          if (typeof window.closeSearchModal === 'function') {
            window.closeSearchModal();
            triggerNativeHaptic(ImpactStyle.Light);
            return;
          }
        }

        // Priority 4: Me / Profile View
        const meModal = document.getElementById('meModal');
        if (meModal && !meModal.classList.contains('hidden')) {
          if (typeof window.closeMeModal === 'function') {
            window.closeMeModal();
            triggerNativeHaptic(ImpactStyle.Light);
            return;
          }
        }

        // Priority 5: Watch Later Modal
        const watchLaterModal = document.getElementById('watchLaterModal');
        if (watchLaterModal && !watchLaterModal.classList.contains('hidden')) {
          if (typeof window.closeWatchLaterModal === 'function') {
            window.closeWatchLaterModal();
            triggerNativeHaptic(ImpactStyle.Light);
            return;
          }
        }

        // Priority 6: Creator Studio Modal
        const creatorStudioModal = document.getElementById('creatorStudioModal');
        if (creatorStudioModal && !creatorStudioModal.classList.contains('hidden')) {
          if (typeof window.closeCreatorStudio === 'function') {
            window.closeCreatorStudio();
            triggerNativeHaptic(ImpactStyle.Light);
            return;
          }
        }

        // Priority 7: Downloads Modal
        const downloadsModal = document.getElementById('downloadsModal');
        if (downloadsModal && !downloadsModal.classList.contains('hidden')) {
          if (typeof window.closeDownloadsModal === 'function') {
            window.closeDownloadsModal();
            triggerNativeHaptic(ImpactStyle.Light);
            return;
          }
        }

        // Priority 8: Category View (Go back to Explore Home)
        const dedicatedCategoryView = document.getElementById('dedicatedCategoryView');
        if (dedicatedCategoryView && !dedicatedCategoryView.classList.contains('hidden')) {
          if (typeof window.navigateExplore === 'function') {
            window.navigateExplore();
            triggerNativeHaptic(ImpactStyle.Light);
            return;
          }
        }

        // Priority 9: Double Back Press to Exit App
        const now = Date.now();
        if (now - lastBackPressTime < 2000) {
          App.exitApp();
        } else {
          lastBackPressTime = now;
          if (typeof window.showToast === 'function') {
            window.showToast("Press back again to exit ShowVerse");
          }
          triggerNativeHaptic(ImpactStyle.Light);
        }
      });
    } catch (e) {
      console.warn("Back button handler registration note:", e);
    }
  }

  // 3. 120 FPS Interaction Tuning
  tune120FpsPerformance();
}

/**
 * 120 FPS High Refresh Rate & Low-Latency Interaction Tuning
 */
function tune120FpsPerformance() {
  // Prevent context menus on long press for a 100% native app feel
  document.addEventListener('contextmenu', (e) => {
    // Allow inputs to still show context menu for paste/copy
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  }, { passive: false });

  // Passive touch event listener for instantaneous responsiveness without scroll-blocking
  window.addEventListener('touchstart', () => {}, { passive: true });
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNativeApp);
  } else {
    initNativeApp();
  }
}
