// nativeApp.js - Full Native Android Controller for ShowVerse
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

let lastBackPressedTime = 0;
let isNativePlatform = false;

export function triggerNativeHaptic(style = ImpactStyle.Light) {
  try {
    if (isNativePlatform) {
      Haptics.impact({ style });
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
  } catch (e) {}
}

export function initNativeAndroidEngine() {
  if (typeof window === 'undefined') return;

  isNativePlatform = Boolean(window.Capacitor && window.Capacitor.isNativePlatform());

  // 1. Suppress all web browser behaviors (Zero Web App feel)
  window.addEventListener('contextmenu', (e) => {
    // Only allow context menu inside text inputs
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      return;
    }
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('dragstart', (e) => {
    e.preventDefault();
  }, { passive: false });

  // 2. Configure Native Android Status Bar & Splash Screen
  if (isNativePlatform) {
    try {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#060913' }).catch(() => {});
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    } catch (e) {}

    // Hide splash screen smoothly after app is ready
    setTimeout(() => {
      try {
        SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
      } catch (e) {}
    }, 400);

    // 3. Native Android Hardware / Gesture Back Button Interceptor
    App.addListener('backButton', ({ canGoBack }) => {
      triggerNativeHaptic(ImpactStyle.Light);

      // Check if Player Modal is open
      const playerModal = document.getElementById('playerModal');
      if (playerModal && !playerModal.classList.contains('hidden')) {
        if (typeof window.closePlayer === 'function') {
          window.closePlayer();
          return;
        }
      }

      // Check if Dedicated Player Page is open
      const showPlayerPage = document.getElementById('showPlayerPage');
      if (showPlayerPage && !showPlayerPage.classList.contains('hidden')) {
        if (typeof window.handlePlayerBack === 'function') {
          window.handlePlayerBack();
          return;
        }
      }

      // Check Search Modal
      const searchModal = document.getElementById('searchModal');
      if (searchModal && !searchModal.classList.contains('hidden')) {
        if (typeof window.closeSearchModal === 'function') {
          window.closeSearchModal();
          return;
        }
      }

      // Check Me (Profile) Modal
      const meModal = document.getElementById('meModal');
      if (meModal && !meModal.classList.contains('hidden')) {
        if (typeof window.closeMeModal === 'function') {
          window.closeMeModal();
          return;
        }
      }

      // Check Watch Later Modal
      const watchLaterModal = document.getElementById('watchLaterModal');
      if (watchLaterModal && !watchLaterModal.classList.contains('hidden')) {
        if (typeof window.closeWatchLaterModal === 'function') {
          window.closeWatchLaterModal();
          return;
        }
      }

      // Check Downloads Modal
      const downloadsModal = document.getElementById('downloadsModal');
      if (downloadsModal && !downloadsModal.classList.contains('hidden')) {
        if (typeof window.closeDownloadsModal === 'function') {
          window.closeDownloadsModal();
          return;
        }
      }

      // Check Creator Studio Modal
      const creatorStudioModal = document.getElementById('creatorStudioModal');
      if (creatorStudioModal && !creatorStudioModal.classList.contains('hidden')) {
        if (typeof window.closeCreatorStudio === 'function') {
          window.closeCreatorStudio();
          return;
        }
      }

      // Check Dedicated Category View
      const dedicatedCategoryView = document.getElementById('dedicatedCategoryView');
      if (dedicatedCategoryView && !dedicatedCategoryView.classList.contains('hidden')) {
        if (typeof window.navigateExplore === 'function') {
          window.navigateExplore();
          return;
        }
      }

      // At Root / Home screen: Double-tap back button to exit
      const currentTime = Date.now();
      if (currentTime - lastBackPressedTime < 2000) {
        App.exitApp();
      } else {
        lastBackPressedTime = currentTime;
        if (typeof window.showToast === 'function') {
          window.showToast("Press back again to exit");
        }
      }
    });
  }

  // 4. Attach native haptics to all interactive elements
  document.addEventListener('click', (e) => {
    const target = e.target.closest('button, a, [role="button"], .cursor-pointer, .nav-tab');
    if (target) {
      triggerNativeHaptic(ImpactStyle.Light);
    }
  }, { passive: true });
}

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
  window.triggerNativeHaptic = triggerNativeHaptic;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNativeAndroidEngine);
  } else {
    initNativeAndroidEngine();
  }
}
