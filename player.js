// ========================================================
// SHOW VERSE - MASTER VIDEO PLAYER MODULE (PLYR & HLS.JS)
// Robust Episode Switching, Direct video.src Updating,
// Comprehensive Error Listeners & Autoplay Catch Handling
// ========================================================

let currentHls = null;
let activePlyr = null;
let isAmbientGlowActive = true;
let currentPlyrOptions = null;

// ========================================================
// AUTOPLAY STATE MANAGEMENT & PERSISTENCE
// ========================================================
const AUTOPLAY_STORAGE_KEY = 'showverse_autoplay_enabled';

export function isAutoplayEnabled() {
  try {
    const val = localStorage.getItem(AUTOPLAY_STORAGE_KEY);
    if (val === null) return true; // Default: ON (Standard streaming experience)
    return val === 'true';
  } catch (_) {
    return true;
  }
}

export function setAutoplay(enabled) {
  try {
    localStorage.setItem(AUTOPLAY_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch (_) {}
  updateAutoplayUI();
}

export function toggleAutoplay() {
  const current = isAutoplayEnabled();
  const next = !current;
  setAutoplay(next);
  if (!next && typeof window.cancelUpNext === 'function') {
    window.cancelUpNext();
  }
  if (window.showToast) {
    window.showToast(next ? "Autoplay Next Episode: ON" : "Autoplay Next Episode: OFF");
  }
  return next;
}

export function updateAutoplayUI() {
  const enabled = isAutoplayEnabled();

  // 1. YouTube Player Page Header Toggle Button
  const thumb = document.getElementById('ytAutoplayThumb');
  const track = document.getElementById('ytAutoplayTrack');
  const text = document.getElementById('ytAutoplayText');
  const toggleBtn = document.getElementById('ytAutoplayToggleBtn');

  if (thumb && track && text) {
    if (enabled) {
      track.className = "w-7 h-4 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 p-0.5 transition-colors flex items-center";
      thumb.className = "w-3 h-3 rounded-full bg-brand-cyan shadow-neon-cyan transition-transform translate-x-3";
      text.innerText = "ON";
      text.className = "text-[10px] font-mono text-brand-cyan uppercase font-bold";
      if (toggleBtn) toggleBtn.setAttribute('aria-checked', 'true');
    } else {
      track.className = "w-7 h-4 rounded-full bg-white/10 border border-white/20 p-0.5 transition-colors flex items-center";
      thumb.className = "w-3 h-3 rounded-full bg-slate-400 transition-transform translate-x-0";
      text.innerText = "OFF";
      text.className = "text-[10px] font-mono text-slate-400 uppercase font-bold";
      if (toggleBtn) toggleBtn.setAttribute('aria-checked', 'false');
    }
  }

  // 2. Metadata Card Quick Badge Button
  const metaStatus = document.getElementById('metaAutoplayStatus');
  const metaBtn = document.getElementById('metaAutoplayBadgeBtn');
  if (metaStatus && metaBtn) {
    metaStatus.innerText = enabled ? "ON" : "OFF";
    if (enabled) {
      metaBtn.className = "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-bold transition cursor-pointer bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan";
    } else {
      metaBtn.className = "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-bold transition cursor-pointer bg-white/5 border-white/15 text-slate-400 hover:text-slate-200";
    }
  }

  // 3. Modal Player Autoplay Toggle Button (if present)
  const modalThumb = document.getElementById('modalAutoplayThumb');
  const modalTrack = document.getElementById('modalAutoplayTrack');
  const modalText = document.getElementById('modalAutoplayText');
  const modalBtn = document.getElementById('modalAutoplayToggleBtn');

  if (modalThumb && modalTrack && modalText) {
    if (enabled) {
      modalTrack.className = "w-7 h-4 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 p-0.5 transition-colors flex items-center";
      modalThumb.className = "w-3 h-3 rounded-full bg-brand-cyan shadow-neon-cyan transition-transform translate-x-3";
      modalText.innerText = "ON";
      modalText.className = "text-[10px] font-mono text-brand-cyan uppercase font-bold";
      if (modalBtn) modalBtn.setAttribute('aria-checked', 'true');
    } else {
      modalTrack.className = "w-7 h-4 rounded-full bg-white/10 border border-white/20 p-0.5 transition-colors flex items-center";
      modalThumb.className = "w-3 h-3 rounded-full bg-slate-400 transition-transform translate-x-0";
      modalText.innerText = "OFF";
      modalText.className = "text-[10px] font-mono text-slate-400 uppercase font-bold";
      if (modalBtn) modalBtn.setAttribute('aria-checked', 'false');
    }
  }
}

// ========================================================
// VIDEO ASPECT RATIO / STRETCH & CROP CONTROLS
// Modes:
// - 'fit': Native aspect ratio with letterbox/pillarbox bars
// - 'stretch': Stretches video to fill 100% of stage without bars
// - 'crop': Zooms and crops video to fill stage edge-to-edge without distortion
// - 'cinema': 21:9 Ultrawide cinematic crop
// ========================================================
const ASPECT_STORAGE_KEY = 'showverse_stretch_crop_mode';
export const AspectModes = {
  FIT: 'fit',
  STRETCH: 'stretch',
  CROP: 'crop',
  CINEMA: 'cinema'
};

const ASPECT_CYCLE = ['fit', 'stretch', 'crop', 'cinema'];

const ASPECT_CONFIG = {
  fit: {
    label: 'Fit (Original)',
    short: 'Fit',
    icon: 'maximize-2',
    hudText: 'Aspect: FIT (Original)',
    toast: 'Video Mode: Fit (Original Aspect)'
  },
  stretch: {
    label: 'Stretch (Fill)',
    short: 'Stretch',
    icon: 'expand',
    hudText: 'Aspect: STRETCH (Fill 100%)',
    toast: 'Video Mode: Stretch (100% Fill Screen)'
  },
  crop: {
    label: 'Crop (Zoom)',
    short: 'Crop',
    icon: 'crop',
    hudText: 'Aspect: CROP (Zoom to Fill)',
    toast: 'Video Mode: Crop (Zoom to Fill)'
  },
  cinema: {
    label: 'Cinema (21:9)',
    short: 'Cinema',
    icon: 'film',
    hudText: 'Aspect: CINEMA (21:9 Ultrawide)',
    toast: 'Video Mode: Cinema (21:9 Ultrawide)'
  }
};

let aspectHudTimer = null;
let stageAspectHideTimer = null;

/**
 * Show on-stage Crop / Aspect button and restart 3-second auto-hide countdown
 */
export function showStageAspectBtn() {
  const btn = document.getElementById('ytStageAspectBtn');
  if (btn) {
    btn.classList.remove('is-hidden');
  }
  const floatBtns = document.querySelectorAll('.plyr__floating-aspect-btn');
  floatBtns.forEach(fb => {
    fb.classList.remove('is-hidden');
  });

  resetStageAspectAutoHide(3000);
}

/**
 * Hide on-stage Crop / Aspect button smoothly
 */
export function hideStageAspectBtn() {
  const btn = document.getElementById('ytStageAspectBtn');
  if (btn) {
    btn.classList.add('is-hidden');
  }
  const floatBtns = document.querySelectorAll('.plyr__floating-aspect-btn');
  floatBtns.forEach(fb => {
    fb.classList.add('is-hidden');
  });
}

/**
 * Resets 3-second auto-hide countdown for on-stage Crop / Aspect button
 */
export function resetStageAspectAutoHide(delayMs = 3000) {
  if (stageAspectHideTimer) {
    clearTimeout(stageAspectHideTimer);
    stageAspectHideTimer = null;
  }

  stageAspectHideTimer = setTimeout(() => {
    hideStageAspectBtn();
  }, delayMs);
}

/**
 * Initializes screen touch, mousemove, and tap listeners on player stage to reveal Crop button on touch and auto-hide after 3s
 */
export function initStageAspectAutoHide() {
  const stage = document.getElementById('ytPlayerStage');
  if (stage && !stage._aspectAutoHideBound) {
    stage._aspectAutoHideBound = true;

    const handleInteraction = () => {
      showStageAspectBtn();
    };

    ['pointerdown', 'touchstart', 'touchmove', 'mousemove', 'click'].forEach(evt => {
      stage.addEventListener(evt, handleInteraction, { passive: true });
    });
  }

  // Initial display for 3 seconds then auto-hide
  showStageAspectBtn();
}

export function getVideoAspectMode() {
  try {
    const val = localStorage.getItem(ASPECT_STORAGE_KEY);
    if (val && ASPECT_CONFIG[val]) return val;
    return 'fit';
  } catch (_) {
    return 'fit';
  }
}

export function applyVideoAspectToElement(el, mode) {
  if (!el || !el.classList) return;
  el.classList.remove('video-scale-fit', 'video-scale-stretch', 'video-scale-crop', 'video-scale-cinema');
  el.classList.add(`video-scale-${mode}`);
}

export function applyCurrentAspectMode() {
  const mode = getVideoAspectMode();

  // Stages
  const ytStage = document.getElementById('ytPlayerStage');
  const modalStage = document.getElementById('playerStage');
  applyVideoAspectToElement(ytStage, mode);
  applyVideoAspectToElement(modalStage, mode);

  // All video elements
  const videos = document.querySelectorAll('video');
  videos.forEach(v => applyVideoAspectToElement(v, mode));

  // All Plyr wrappers
  const plyrs = document.querySelectorAll('.plyr');
  plyrs.forEach(p => applyVideoAspectToElement(p, mode));

  updateAspectUI();
}

export function setVideoAspectMode(mode, showFeedback = true) {
  const validMode = ASPECT_CONFIG[mode] ? mode : 'fit';
  try {
    localStorage.setItem(ASPECT_STORAGE_KEY, validMode);
  } catch (_) {}

  applyCurrentAspectMode();

  if (showFeedback) {
    showAspectHUD(validMode);
    if (window.showToast) {
      window.showToast(ASPECT_CONFIG[validMode].toast);
    }
  }

  closeAspectMenu();
}

export function cycleVideoAspectMode(event) {
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
  const current = getVideoAspectMode();
  const currentIdx = ASPECT_CYCLE.indexOf(current);
  const nextIdx = (currentIdx + 1) % ASPECT_CYCLE.length;
  const nextMode = ASPECT_CYCLE[nextIdx];
  setVideoAspectMode(nextMode, true);
  showStageAspectBtn();
  return nextMode;
}

export function showAspectHUD(mode) {
  const config = ASPECT_CONFIG[mode] || ASPECT_CONFIG.fit;
  const huds = document.querySelectorAll('.video-aspect-hud');

  huds.forEach(hud => {
    if (!hud) return;
    const textEl = hud.querySelector('.plyr-hud-text') || hud.querySelector('span') || hud.querySelector('#ytAspectHUDText') || hud.querySelector('#modalAspectHUDText');
    const iconEl = hud.querySelector('i') || hud.querySelector('.plyr-hud-icon');
    if (textEl) textEl.textContent = config.hudText;
    if (iconEl && iconEl.tagName.toLowerCase() === 'i') {
      iconEl.setAttribute('data-lucide', config.icon);
    }

    hud.classList.remove('is-visible');
    void hud.offsetWidth; // Force CSS reflow to re-trigger transition
    hud.classList.add('is-visible');
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  if (aspectHudTimer) clearTimeout(aspectHudTimer);
  aspectHudTimer = setTimeout(() => {
    huds.forEach(hud => {
      if (hud) hud.classList.remove('is-visible');
    });
  }, 1400);
}

export function updateAspectUI() {
  const mode = getVideoAspectMode();
  const config = ASPECT_CONFIG[mode] || ASPECT_CONFIG.fit;

  // 1. YouTube Player Top Bar button label
  const labelEl = document.getElementById('ytAspectModeLabel');
  if (labelEl) labelEl.textContent = config.short;

  const iconEl = document.getElementById('ytAspectIcon');
  if (iconEl) iconEl.setAttribute('data-lucide', config.icon);

  // 2. On-Stage Quick Button text
  const stageBtnText = document.getElementById('ytStageAspectText');
  if (stageBtnText) stageBtnText.textContent = config.short;

  // 3. Modal Player button text
  const modalText = document.getElementById('modalAspectText');
  if (modalText) modalText.textContent = config.short.toUpperCase();

  // 4. Plyr Control Bar custom aspect badge (for standard & fullscreen landscape)
  const plyrBadges = document.querySelectorAll('.plyr__aspect-badge, #plyrAspectBadge');
  plyrBadges.forEach(b => {
    b.textContent = config.short.toUpperCase();
  });

  // 5. Plyr On-Stage Floating aspect button text (visible in landscape & fullscreen)
  const floatBadges = document.querySelectorAll('.plyr__floating-aspect-text, #plyrFloatingAspectText');
  floatBadges.forEach(b => {
    b.textContent = config.short;
  });

  // 6. Dropdown checkmarks & active item styling
  ASPECT_CYCLE.forEach(m => {
    const checkEl = document.querySelector(`.aspect-check-${m}`);
    const itemEl = document.querySelector(`.aspect-item-${m}`);
    if (checkEl) {
      if (m === mode) {
        checkEl.classList.remove('hidden');
      } else {
        checkEl.classList.add('hidden');
      }
    }
    if (itemEl) {
      if (m === mode) {
        itemEl.classList.add('bg-brand-cyan/15', 'text-brand-cyan');
        itemEl.classList.remove('text-white');
      } else {
        itemEl.classList.remove('bg-brand-cyan/15', 'text-brand-cyan');
        itemEl.classList.add('text-white');
      }
    }
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

export function isLandscapeMode() {
  if (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) {
    return true;
  }
  if (window.screen && window.screen.orientation && window.screen.orientation.type) {
    return window.screen.orientation.type.includes('landscape');
  }
  return window.innerWidth > window.innerHeight;
}

/**
 * Injects custom Aspect Ratio controls directly into Plyr container and controls bar.
 * This guarantees the Stretch & Crop controls remain visible and functional in Fullscreen and Landscape modes!
 */
export function injectPlyrAspectControls(plyr) {
  if (!plyr || !plyr.elements) return;

  const container = plyr.elements.container;
  const controls = plyr.elements.controls;
  const curMode = getVideoAspectMode();
  const config = ASPECT_CONFIG[curMode] || ASPECT_CONFIG.fit;

  // 1. Inject Control Bar Aspect Button into Plyr bottom controls
  if (controls && !controls.querySelector('.plyr__control--aspect-toggle')) {
    const aspectBtn = document.createElement('button');
    aspectBtn.type = 'button';
    aspectBtn.className = 'plyr__control plyr__control--aspect-toggle';
    aspectBtn.setAttribute('data-plyr', 'aspect-toggle');
    aspectBtn.setAttribute('aria-label', 'Toggle Video Aspect (Fit, Stretch, Crop, Cinema)');
    aspectBtn.setAttribute('title', 'Aspect Ratio: Fit / Stretch / Crop / Cinema (Shortcut: C)');
    
    aspectBtn.innerHTML = `
      <svg class="w-4 h-4 text-brand-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 15px; height: 15px; display: inline-block;">
        <path d="M6 2v14a2 2 0 0 0 2 2h14"></path>
        <path d="M18 22V8a2 2 0 0 0-2-2H2"></path>
      </svg>
      <span class="plyr__aspect-badge" id="plyrAspectBadge">${config.short.toUpperCase()}</span>
    `;

    aspectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleVideoAspectMode(e);
    });

    const fullscreenBtn = controls.querySelector('[data-plyr="fullscreen"]');
    const pipBtn = controls.querySelector('[data-plyr="pip"]');
    const settingsBtn = controls.querySelector('[data-plyr="settings"]');

    if (fullscreenBtn) {
      controls.insertBefore(aspectBtn, fullscreenBtn);
    } else if (pipBtn) {
      controls.insertBefore(aspectBtn, pipBtn);
    } else if (settingsBtn) {
      controls.insertBefore(aspectBtn, settingsBtn);
    } else {
      controls.appendChild(aspectBtn);
    }
  }

  // 2. Inject On-Stage Floating Aspect Button into Plyr container (Visible in Fullscreen & Landscape!)
  if (container && !container.querySelector('.plyr__floating-aspect-btn')) {
    const floatBtn = document.createElement('button');
    floatBtn.type = 'button';
    floatBtn.className = 'plyr__floating-aspect-btn';
    floatBtn.setAttribute('title', 'Cycle Stretch & Crop (Fit, Stretch, Crop, Cinema) - Shortcut C');
    floatBtn.innerHTML = `
      <svg class="w-3.5 h-3.5 text-brand-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
        <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path>
        <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path>
      </svg>
      <span class="plyr__floating-aspect-text font-mono text-[10px] uppercase font-bold text-white tracking-wide" id="plyrFloatingAspectText">${config.short}</span>
    `;

    floatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleVideoAspectMode(e);
    });

    container.appendChild(floatBtn);
  }

  // 3. Inject Video Aspect HUD inside plyr container (so HUD flashes in Fullscreen & Landscape!)
  if (container && !container.querySelector('.plyr__aspect-hud')) {
    const hud = document.createElement('div');
    hud.className = 'video-aspect-hud plyr__aspect-hud';
    hud.innerHTML = `
      <div class="px-4 py-2 rounded-2xl bg-black/85 backdrop-blur-md border border-brand-cyan/60 text-white shadow-neon-cyan flex items-center gap-2.5">
        <svg class="w-4 h-4 text-brand-cyan plyr-hud-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>
        <span class="text-xs font-black tracking-wider uppercase plyr-hud-text">${config.hudText}</span>
      </div>
    `;

    container.appendChild(hud);
  }
}

export function toggleAspectMenu(event) {
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
  const menu = document.getElementById('ytAspectMenu');
  if (menu) {
    menu.classList.toggle('hidden');
    if (!menu.classList.contains('hidden')) {
      updateAspectUI();
    }
  }
}

export function closeAspectMenu() {
  const menu = document.getElementById('ytAspectMenu');
  if (menu) {
    menu.classList.add('hidden');
  }
}

/**
 * Standard Plyr control list
 */
const defaultPlyrControls = [
  'play-large',
  'restart',
  'rewind',
  'play',
  'fast-forward',
  'progress',
  'current-time',
  'duration',
  'mute',
  'volume',
  'captions',
  'settings',
  'pip',
  'fullscreen'
];

/**
 * Show visible error overlay on the player screen
 */
export function showPlayerError(videoTarget, title = "Error loading video", desc = "The video could not be loaded or network error occurred.") {
  console.error(`[ShowVerse Player] showPlayerError called: "${title}" - "${desc}"`);
  const targetEl = typeof videoTarget === 'string' ? document.getElementById(videoTarget) : videoTarget;
  const stage = (targetEl && targetEl.closest) ? 
    (targetEl.closest('#ytPlayerStage') || targetEl.closest('#playerStage') || targetEl.closest('.plyr')) : null;
  
  const overlays = stage ? 
    stage.querySelectorAll('.player-error-overlay') : 
    document.querySelectorAll('.player-error-overlay');

  overlays.forEach(overlay => {
    overlay.classList.remove('is-hidden');
    overlay.style.display = 'flex';
    const titleEl = overlay.querySelector('h3') || overlay.querySelector('#ytPlayerErrorTitle') || overlay.querySelector('#modalPlayerErrorTitle');
    const descEl = overlay.querySelector('p') || overlay.querySelector('#ytPlayerErrorText') || overlay.querySelector('#modalPlayerErrorText');
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;
  });

  const ytErr = document.getElementById('ytPlayerErrorOverlay');
  if (ytErr) {
    ytErr.classList.remove('is-hidden');
    ytErr.style.display = 'flex';
    const t = document.getElementById('ytPlayerErrorTitle');
    const d = document.getElementById('ytPlayerErrorText');
    if (t) t.textContent = title;
    if (d) d.textContent = desc;
  }

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Hide visible error overlay on the player screen
 */
export function hidePlayerError(videoTarget) {
  const targetEl = typeof videoTarget === 'string' ? document.getElementById(videoTarget) : videoTarget;
  const stage = (targetEl && targetEl.closest) ? 
    (targetEl.closest('#ytPlayerStage') || targetEl.closest('#playerStage') || targetEl.closest('.plyr')) : null;

  const overlays = stage ? 
    stage.querySelectorAll('.player-error-overlay') : 
    document.querySelectorAll('.player-error-overlay');

  overlays.forEach(overlay => {
    overlay.classList.add('is-hidden');
    overlay.style.display = 'none';
  });

  const ytErr = document.getElementById('ytPlayerErrorOverlay');
  if (ytErr) {
    ytErr.classList.add('is-hidden');
    ytErr.style.display = 'none';
  }
  const modalErr = document.getElementById('modalPlayerErrorOverlay');
  if (modalErr) {
    modalErr.classList.add('is-hidden');
    modalErr.style.display = 'none';
  }
}

/**
 * Show dedicated loading & buffering spinner on the video player stage
 */
export function showVideoSpinner(videoTarget, customText = 'Buffering Stream...') {
  const targetEl = typeof videoTarget === 'string' ? document.getElementById(videoTarget) : videoTarget;
  const stage = (targetEl && targetEl.closest) ? 
    (targetEl.closest('#ytPlayerStage') || targetEl.closest('#playerStage') || targetEl.closest('.plyr')) : null;

  const spinners = stage ? 
    stage.querySelectorAll('.video-spinner-overlay') : 
    document.querySelectorAll('.video-spinner-overlay');

  spinners.forEach(spinner => {
    spinner.style.display = 'flex';
    spinner.classList.remove('is-hidden');
    if (customText) {
      const textEl = spinner.querySelector('#ytLoadingText') || spinner.querySelector('span:last-child');
      if (textEl) textEl.textContent = customText;
    }
  });

  // Safety fallback: auto-hide spinner after 6 seconds so user is never stuck
  if (window._spinnerSafetyTimer) clearTimeout(window._spinnerSafetyTimer);
  window._spinnerSafetyTimer = setTimeout(() => {
    hideVideoSpinner(videoTarget);
  }, 6000);
}

/**
 * Hide loading & buffering spinner on the video player stage
 */
export function hideVideoSpinner(videoTarget) {
  if (window._spinnerSafetyTimer) {
    clearTimeout(window._spinnerSafetyTimer);
    window._spinnerSafetyTimer = null;
  }
  const targetEl = typeof videoTarget === 'string' ? document.getElementById(videoTarget) : videoTarget;
  const stage = (targetEl && targetEl.closest) ? 
    (targetEl.closest('#ytPlayerStage') || targetEl.closest('#playerStage') || targetEl.closest('.plyr')) : null;

  const spinners = stage ? 
    stage.querySelectorAll('.video-spinner-overlay') : 
    document.querySelectorAll('.video-spinner-overlay');

  spinners.forEach(spinner => {
    spinner.classList.add('is-hidden');
    spinner.style.display = 'none';
  });

  const ytSpinner = document.getElementById('ytLoadingSpinner');
  if (ytSpinner) {
    ytSpinner.classList.add('is-hidden');
    ytSpinner.style.display = 'none';
  }
  const modalSpinner = document.getElementById('modalLoadingSpinner');
  if (modalSpinner) {
    modalSpinner.classList.add('is-hidden');
    modalSpinner.style.display = 'none';
  }
}

/**
 * Destroys any existing Plyr and HLS.js instances cleanly (used when closing player)
 */
export function destroyCurrentPlayer() {
  console.log("[ShowVerse Player] destroyCurrentPlayer invoked.");
  if (currentHls) {
    try {
      currentHls.destroy();
    } catch (e) {
      console.warn("HLS destroy notice:", e);
    }
    currentHls = null;
    window.currentHls = null;
    window.activeHls = null;
    window.mainHls = null;
    window.hls = null;
  }

  if (activePlyr) {
    try {
      activePlyr.destroy();
    } catch (e) {
      console.warn("Plyr destroy notice:", e);
    }
    activePlyr = null;
    window.activePlyr = null;
  }
}

/**
 * Format seconds to MM:SS string
 */
export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Helper to dynamically get the active video element
 */
export function getActiveVideo() {
  return document.querySelector('#ytPlayerStage video') || 
         document.querySelector('#playerModal video') || 
         document.querySelector('video');
}

/**
 * Retry current episode playback if an error occurred
 */
export function retryCurrentEpisode() {
  console.log("[ShowVerse Player] User clicked Retry Episode.");
  hidePlayerError();
  if (typeof window.switchYtEpisode === 'function' && typeof window.currentSelectedEpisodeIndex === 'number') {
    window.switchYtEpisode(window.currentSelectedEpisodeIndex);
  } else if (typeof window.loadActiveYtEpisode === 'function') {
    window.loadActiveYtEpisode(0);
  } else {
    const vid = getActiveVideo();
    if (vid) {
      vid.load();
      vid.play().catch(e => console.warn("[ShowVerse Player] Retry play catch:", e));
    }
  }
}

/**
 * Setup and attach Plyr instance to a video element if not already attached
 */
function ensurePlyrAttached(videoElement, resumeTime = 0, options = {}) {
  // If activePlyr is already present and attached to this videoElement, reuse it!
  if (activePlyr && activePlyr.media === videoElement) {
    console.log("[ShowVerse Player] Existing Plyr instance detected and reused.");
    return activePlyr;
  }

  // If a stale Plyr instance exists for another element, destroy it first
  if (activePlyr) {
    try {
      activePlyr.destroy();
    } catch (e) {}
    activePlyr = null;
  }

  if (!window.Plyr) {
    console.warn("[ShowVerse Player] Plyr library not found on window.");
    return null;
  }

  console.log("[ShowVerse Player] Initializing fresh Plyr instance on video element.");
  const plyr = new window.Plyr(videoElement, {
    controls: defaultPlyrControls,
    seekTime: 10,
    keyboard: { focused: true, global: false },
    tooltips: { controls: true, seek: true },
    captions: { active: true, update: true, language: 'en' },
    invertTime: false,
    toggleInvert: false
  });

  activePlyr = plyr;
  window.activePlyr = plyr;

  // Continue watching & history tracking
  let lastSavedSec = 0;
  plyr.on('timeupdate', () => {
    const cur = plyr.currentTime;
    const dur = plyr.duration;
    if (Math.abs(cur - lastSavedSec) >= 3) {
      lastSavedSec = cur;
      if (typeof window.saveContinueWatchingProgress === 'function') {
        window.saveContinueWatchingProgress(cur, dur);
      }
    }
  });

  plyr.on('pause', () => {
    const cur = plyr.currentTime;
    const dur = plyr.duration;
    if (typeof window.saveContinueWatchingProgress === 'function') {
      window.saveContinueWatchingProgress(cur, dur);
    }
  });

  plyr.on('ended', () => {
    console.log("[ShowVerse Player] Plyr 'ended' event fired.");
    const cur = plyr.currentTime;
    const dur = plyr.duration;
    if (typeof window.saveContinueWatchingProgress === 'function') {
      window.saveContinueWatchingProgress(cur, dur);
    }
    if (currentPlyrOptions && typeof currentPlyrOptions.onEnded === 'function') {
      currentPlyrOptions.onEnded();
    } else if (typeof options.onEnded === 'function') {
      options.onEnded();
    }
  });

  plyr.on('waiting', () => showVideoSpinner(videoElement, 'Buffering Stream...'));
  plyr.on('seeking', () => showVideoSpinner(videoElement, 'Buffering Stream...'));
  plyr.on('playing', () => {
    hideVideoSpinner(videoElement);
    hidePlayerError(videoElement);
    applyCurrentAspectMode();
  });
  plyr.on('canplay', () => {
    hideVideoSpinner(videoElement);
    hidePlayerError(videoElement);
    applyCurrentAspectMode();
  });

  plyr.on('ready', () => {
    injectPlyrAspectControls(plyr);
    applyCurrentAspectMode();
    updateAspectUI();
  });

  plyr.on('enterfullscreen', () => {
    applyCurrentAspectMode();
    updateAspectUI();
    injectPlyrAspectControls(plyr);
  });

  plyr.on('exitfullscreen', () => {
    applyCurrentAspectMode();
    updateAspectUI();
  });

  plyr.on('controlsshown', () => {
    showStageAspectBtn();
  });

  plyr.on('controlshidden', () => {
    hideStageAspectBtn();
  });

  plyr.on('play', () => {
    resetStageAspectAutoHide(3000);
  });

  plyr.on('pause', () => {
    showStageAspectBtn();
  });

  // Re-check controls after short delay in case controls DOM rendered asynchronously
  setTimeout(() => {
    injectPlyrAspectControls(plyr);
    applyCurrentAspectMode();
    updateAspectUI();
  }, 120);

  return plyr;
}

/**
 * PRIMARY VIDEO LOADER
 * Updates video.src correctly, calls video.load(), executes video.play() with catch(err),
 * binds comprehensive error listeners, and ensures the player never freezes on black screen.
 */
export function loadVideoWithPlyr(videoTarget, targetUrl, resumeTime = 0, options = {}) {
  currentPlyrOptions = options;
  console.log(`[ShowVerse Player] ========================================`);
  console.log(`[ShowVerse Player] loadVideoWithPlyr called!`);
  console.log(`[ShowVerse Player] Target URL: "${targetUrl}"`);
  console.log(`[ShowVerse Player] Resume Time: ${resumeTime}`);
  console.log(`[ShowVerse Player] Options:`, options);

  // 1. Resolve target video element
  let videoElement = typeof videoTarget === 'string' ? document.getElementById(videoTarget) : videoTarget;
  if (!videoElement) {
    videoElement = document.getElementById('main-video') || document.querySelector('#ytPlayerStage video') || document.querySelector('video');
  }

  if (!videoElement) {
    console.error("[ShowVerse Player] Error: Target video element not found in DOM!", videoTarget);
    return null;
  }

  console.log("[ShowVerse Player] Target video element confirmed:", videoElement);
  applyCurrentAspectMode();
  initStageAspectAutoHide();

  // 2. Hide any previous error overlays and show loading spinner immediately
  hidePlayerError(videoElement);
  showVideoSpinner(videoElement, options.loadingText || 'Loading Episode...');

  // 3. Ensure no poster image displays and background is black
  videoElement.removeAttribute('poster');
  videoElement.poster = '';
  videoElement.autoplay = true;

  // 4. Validate URL
  const streamUrl = typeof targetUrl === 'string' ? targetUrl.trim() : '';
  if (!streamUrl) {
    console.error("[ShowVerse Player] Error: Provided stream URL is empty!");
    hideVideoSpinner(videoElement);
    showPlayerError(videoElement, "Error loading video", "No valid stream URL was found for this episode.");
    return null;
  }

  // 5. Clean up any previous Hls.js instance so it doesn't conflict
  if (currentHls) {
    try {
      console.log("[ShowVerse Player] Destroying previous Hls instance...");
      currentHls.destroy();
    } catch (e) {
      console.warn("[ShowVerse Player] Error during Hls destroy:", e);
    }
    currentHls = null;
    window.currentHls = null;
    window.activeHls = null;
    window.mainHls = null;
    window.hls = null;
  }

  // 6. Comprehensive Error Listeners on the video element (`error`, `stalled`, `abort`)
  const handleVideoFailure = (event) => {
    const type = event ? event.type : 'error';
    const err = videoElement.error;
    console.error(`[ShowVerse Player] Video element failure event: "${type}" on URL: "${streamUrl}"`, err);

    // Hide the spinner immediately so it never spins infinitely
    hideVideoSpinner(videoElement);

    let errorHeading = "Error loading video";
    let errorDetail = "The video stream could not be loaded or the format is not supported.";
    if (err) {
      switch (err.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorDetail = "The video playback was aborted by the user or browser.";
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorDetail = "A network error occurred while downloading the video stream.";
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorDetail = "Playback was aborted due to stream corruption or unsupported codec.";
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorDetail = "The video format or server source is not supported by your browser.";
          break;
        default:
          if (err.message) errorDetail = err.message;
          break;
      }
    }

    // Display visible error message on the player screen so it doesn't stay a blank black box
    showPlayerError(videoElement, errorHeading, errorDetail);
  };

  // Attach error and abort handlers
  videoElement.onerror = handleVideoFailure;
  videoElement.onabort = handleVideoFailure;

  // Stalled handler: logs warning, and if source is unavailable, displays visible error
  videoElement.onstalled = (e) => {
    console.warn(`[ShowVerse Player] Video stream stalled on URL: "${streamUrl}"`, e);
    if (videoElement.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
      handleVideoFailure(e);
    }
  };

  // Remove stale child <source> elements if any were present
  while (videoElement.firstChild) {
    if (videoElement.firstChild.nodeName === 'SOURCE') {
      videoElement.removeChild(videoElement.firstChild);
    } else {
      break;
    }
  }

  // 7. Autoplay Promise Function with robust catch(err) handling
  let isPlayTriggered = false;
  const triggerSafePlay = () => {
    if (isPlayTriggered) return;
    isPlayTriggered = true;
    console.log(`[ShowVerse Player] triggerSafePlay executing for: "${streamUrl}"`);
    hideVideoSpinner(videoElement);
    hidePlayerError(videoElement);

    // Apply resume timestamp if requested
    if (resumeTime > 0) {
      try {
        videoElement.currentTime = Number(resumeTime);
        console.log(`[ShowVerse Player] Resumed at timestamp: ${resumeTime}s`);
      } catch (err) {
        console.warn("[ShowVerse Player] Resume timestamp notice:", err);
      }
    }

    // Call video.play() and handle promise catch
    const playPromise = videoElement.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        console.log("[ShowVerse Player] video.play() started successfully!");
        hideVideoSpinner(videoElement);
        hidePlayerError(videoElement);
      }).catch(err => {
        // Autoplay policy prevented playback without user gesture
        console.log("[ShowVerse Player] video.play() caught autoplay rejection (gesture required):", err);
        // Hide spinner immediately so the big Play overlay or controls are clickable
        hideVideoSpinner(videoElement);
      });
    }
  };

  // Attach standard playback state listeners
  videoElement.onended = () => {
    console.log("[ShowVerse Player] HTML5 video 'ended' event fired.");
    if (typeof window.saveContinueWatchingProgress === 'function') {
      window.saveContinueWatchingProgress(videoElement.currentTime, videoElement.duration);
    }
    if (currentPlyrOptions && typeof currentPlyrOptions.onEnded === 'function') {
      currentPlyrOptions.onEnded();
    }
  };
  videoElement.oncanplay = () => {
    console.log("[ShowVerse Player] video element 'canplay' event fired.");
    triggerSafePlay();
  };
  videoElement.onplaying = () => {
    hideVideoSpinner(videoElement);
    hidePlayerError(videoElement);
  };
  videoElement.onwaiting = () => showVideoSpinner(videoElement, 'Buffering Stream...');
  videoElement.onseeking = () => showVideoSpinner(videoElement, 'Buffering Stream...');
  videoElement.onseeked = () => hideVideoSpinner(videoElement);

  // 8. Stream Format Check: Is this strictly an HLS adaptive stream (.m3u8)?
  const isHls = /\.m3u8(\?.*)?$/i.test(streamUrl) || 
                streamUrl.includes('.m3u8') || 
                streamUrl.includes('application/x-mpegURL');
  const isHlsSupported = !!(window.Hls && window.Hls.isSupported());

  if (isHls && isHlsSupported) {
    console.log("[ShowVerse Player] Initializing Hls.js engine for adaptive stream:", streamUrl);
    const hls = new window.Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      startFragPrefetch: true,
      enableWorker: true
    });
    currentHls = hls;
    window.currentHls = hls;
    window.activeHls = hls;
    window.mainHls = hls;
    window.hls = hls;
    hls.loadSource(streamUrl);
    hls.attachMedia(videoElement);
    hls.once(window.Hls.Events.MANIFEST_PARSED, () => {
      console.log("[ShowVerse Player] HLS Manifest parsed successfully.");
      triggerSafePlay();
    });
    hls.on(window.Hls.Events.ERROR, (event, data) => {
      console.warn("[ShowVerse Player] Hls event error:", data);
      if (data.fatal) {
        switch (data.type) {
          case window.Hls.ErrorTypes.NETWORK_ERROR:
            console.warn("[ShowVerse Player] Fatal HLS network error, attempting startLoad()...");
            hls.startLoad();
            break;
          case window.Hls.ErrorTypes.MEDIA_ERROR:
            console.warn("[ShowVerse Player] Fatal HLS media error, attempting recoverMediaError()...");
            hls.recoverMediaError();
            break;
          default:
            console.error("[ShowVerse Player] Unrecoverable HLS fatal error. Falling back directly to video.src:", data);
            try { hls.destroy(); } catch (_) {}
            currentHls = null;
            // Fallback to standard HTML5 video.src, video.load(), video.play()
            videoElement.src = streamUrl;
            videoElement.load();
            triggerSafePlay();
            break;
        }
      }
    });
  } else {
    // 9. DIRECT VIDEO STREAM (MP4, WebM, OGG, Google Drive, direct CDN link, etc.)
    console.log(`[ShowVerse Player] Step 1: Updating video.src = "${streamUrl}"`);
    videoElement.src = streamUrl;
    console.log("[ShowVerse Player] Step 2: Calling video.load()");
    videoElement.load();
    console.log("[ShowVerse Player] Step 3: Triggering video.play()");
    triggerSafePlay();
  }

  // 10. Ensure Plyr controls overlay is attached without tearing down the DOM
  ensurePlyrAttached(videoElement, resumeTime, options);

  console.log(`[ShowVerse Player] ========================================`);
  return null;
}

/**
 * Universal playback controls delegating directly to Plyr or active video
 */
export function togglePlay() {
  if (activePlyr) {
    activePlyr.togglePlay();
  } else {
    const vid = getActiveVideo();
    if (vid) vid.paused ? vid.play().catch(() => {}) : vid.pause();
  }
}

export function skipTime(seconds) {
  if (activePlyr) {
    const sec = Number(seconds) || 10;
    if (sec > 0) {
      activePlyr.forward(sec);
    } else {
      activePlyr.rewind(Math.abs(sec));
    }
  } else {
    const vid = getActiveVideo();
    if (vid) vid.currentTime += (Number(seconds) || 10);
  }
}

export function seekVideo() {
  // Native Plyr control bar handles seeking smoothly
}

export function toggleFullscreen() {
  if (activePlyr && activePlyr.fullscreen) {
    activePlyr.fullscreen.toggle();
  } else {
    const stage = document.getElementById('ytPlayerStage') || document.getElementById('playerStage');
    if (stage) {
      if (!document.fullscreenElement) {
        stage.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  }
}

export function toggleMute() {
  if (activePlyr) {
    activePlyr.muted = !activePlyr.muted;
  } else {
    const vid = getActiveVideo();
    if (vid) vid.muted = !vid.muted;
  }
}

export function changeVolume(val) {
  if (activePlyr) {
    activePlyr.volume = Number(val);
  } else {
    const vid = getActiveVideo();
    if (vid) vid.volume = Number(val);
  }
}

export function toggleAmbientLighting() {
  toggleYtAmbient();
}

export function toggleYtAmbient() {
  isAmbientGlowActive = !isAmbientGlowActive;
  const stages = [document.getElementById('ytPlayerStage'), document.getElementById('playerStage')];
  stages.forEach(stage => {
    if (!stage) return;
    if (isAmbientGlowActive) {
      stage.classList.add('yt-player-glow', 'ambient-glow-box');
    } else {
      stage.classList.remove('yt-player-glow', 'ambient-glow-box');
    }
  });
  const btns = [document.getElementById('ytAmbientBtn'), document.getElementById('ambientToggleBtn')];
  btns.forEach(btn => {
    if (!btn) return;
    btn.classList.toggle('text-brand-cyan', isAmbientGlowActive);
    btn.classList.toggle('text-slate-400', !isAmbientGlowActive);
  });
  if (window.showToast) {
    window.showToast(isAmbientGlowActive ? "Ambient Glow Enabled" : "Ambient Glow Disabled");
  }
}

export function togglePiP() {
  if (activePlyr && activePlyr.pip) {
    activePlyr.pip = !activePlyr.pip;
  }
}

// Stubs for backward compatibility
export function toggleAudioSubModal() {}
export function toggleQualityModal() {}
export function selectQuality() {}
export function setSubtitle() {}
export function setAudioTrack() {}
export function toggleLockScreen() {}
export function unlockScreen() {}
export function handlePlayerScreenTap() {}
export function handleYtPlayerTap() {}
export function triggerYtSkipAnimation() {}
export function executeSafeSkip(sec) { skipTime(sec); }
export function executeSafeSeek() {}
export function executeSafeTimelineSeek() {}
export function initMainPlayerControlsAutoHide() {}
export function wipeAndAttachMainPlayerSeekSkipListeners() {}
export function rebindMasterPlayerControls() {}
export function setupMainPlayerDelegatedEvents() {}
export function attachPlayerEvents() {}

// Expose globally on window
if (typeof window !== "undefined") {
  window.isAutoplayEnabled = isAutoplayEnabled;
  window.setAutoplay = setAutoplay;
  window.toggleAutoplay = toggleAutoplay;
  window.updateAutoplayUI = updateAutoplayUI;
  window.loadVideoWithPlyr = loadVideoWithPlyr;
  window.destroyCurrentPlayer = destroyCurrentPlayer;
  window.showVideoSpinner = showVideoSpinner;
  window.hideVideoSpinner = hideVideoSpinner;
  window.showPlayerError = showPlayerError;
  window.hidePlayerError = hidePlayerError;
  window.retryCurrentEpisode = retryCurrentEpisode;
  window.activePlyr = activePlyr;
  window.currentHls = currentHls;
  window.activeHls = currentHls;
  window.togglePlay = togglePlay;
  window.skipTime = skipTime;
  window.seekVideo = seekVideo;
  window.toggleFullscreen = toggleFullscreen;
  window.toggleMute = toggleMute;
  window.changeVolume = changeVolume;
  window.toggleAmbientLighting = toggleAmbientLighting;
  window.toggleYtAmbient = toggleYtAmbient;
  window.togglePiP = togglePiP;
  window.getActiveVideo = getActiveVideo;
  window.executeSafeSkip = executeSafeSkip;
  window.executeSafeSeek = executeSafeSeek;
  window.executeSafeTimelineSeek = executeSafeTimelineSeek;
  window.initMainPlayerControlsAutoHide = initMainPlayerControlsAutoHide;
  window.wipeAndAttachMainPlayerSeekSkipListeners = wipeAndAttachMainPlayerSeekSkipListeners;
  window.rebindMasterPlayerControls = rebindMasterPlayerControls;

  // Stretch & Crop Aspect Ratio APIs
  window.getVideoAspectMode = getVideoAspectMode;
  window.setVideoAspectMode = setVideoAspectMode;
  window.cycleVideoAspectMode = cycleVideoAspectMode;
  window.updateAspectUI = updateAspectUI;
  window.toggleAspectMenu = toggleAspectMenu;
  window.closeAspectMenu = closeAspectMenu;
  window.applyCurrentAspectMode = applyCurrentAspectMode;
  window.showAspectHUD = showAspectHUD;
  window.injectPlyrAspectControls = injectPlyrAspectControls;
  window.isLandscapeMode = isLandscapeMode;
  window.showStageAspectBtn = showStageAspectBtn;
  window.hideStageAspectBtn = hideStageAspectBtn;
  window.resetStageAspectAutoHide = resetStageAspectAutoHide;
  window.initStageAspectAutoHide = initStageAspectAutoHide;
}

// Auto-initialize UI and aspect handlers on ready
if (typeof document !== "undefined") {
  const initPlayerModules = () => {
    updateAutoplayUI();
    applyCurrentAspectMode();
    updateAspectUI();
    initStageAspectAutoHide();
  };

  if (document.readyState === "loading") {
    document.addEventListener('DOMContentLoaded', initPlayerModules);
  } else {
    initPlayerModules();
  }

  // Handle Landscape Orientation Changes ("landscape jab tab bhi")
  const handleOrientationOrResize = () => {
    applyCurrentAspectMode();
    updateAspectUI();

    // Re-verify Plyr controls in landscape
    if (window.activePlyr) {
      injectPlyrAspectControls(window.activePlyr);
    }

    const ytPage = document.getElementById('showPlayerPage');
    const modal = document.getElementById('playerModal');
    const isPlayerOpen = (ytPage && !ytPage.classList.contains('hidden')) || (modal && !modal.classList.contains('hidden'));

    if (isPlayerOpen && isLandscapeMode()) {
      showAspectHUD(getVideoAspectMode());
    }
  };

  if (window.screen && window.screen.orientation && typeof window.screen.orientation.addEventListener === 'function') {
    window.screen.orientation.addEventListener('change', handleOrientationOrResize);
  }
  window.addEventListener('orientationchange', handleOrientationOrResize);
  
  if (window.matchMedia) {
    const mql = window.matchMedia('(orientation: landscape)');
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleOrientationOrResize);
    } else if (typeof mql.addListener === 'function') {
      mql.addListener(handleOrientationOrResize);
    }
  }

  window.addEventListener('resize', () => {
    applyCurrentAspectMode();
  });

  // Close Aspect Dropdown on outside click
  document.addEventListener('click', (e) => {
    const container = document.getElementById('ytAspectContainer');
    if (container && !container.contains(e.target)) {
      closeAspectMenu();
    }
  });

  // Global Keyboard Shortcut: Press 'C' or 'c' to cycle aspect mode (Fit -> Stretch -> Crop -> Cinema)
  document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
      return;
    }
    // Only trigger if player is currently active/visible
    const ytPage = document.getElementById('showPlayerPage');
    const modal = document.getElementById('playerModal');
    const isPlayerOpen = (ytPage && !ytPage.classList.contains('hidden')) || (modal && !modal.classList.contains('hidden'));
    
    if (isPlayerOpen && (e.key === 'c' || e.key === 'C')) {
      cycleVideoAspectMode();
    }
  });
}


