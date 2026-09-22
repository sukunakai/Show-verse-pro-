// app.js - Show Verse Frontend Engine: Data Grouping, Real Trending Logic, Top Categories & YouTube-Style Player Page
import { 
  collection, 
  onSnapshot 
} from "firebase/firestore";
import { db } from "./firebase.js";

// Source of Truth from Firestore
export let firestoreEpisodes = [];

// High-performance batched icon updater (prevents DOM thrashing and UI lag)
export function triggerSafeIcons(scopeElement) {
  if (typeof window !== "undefined" && typeof window.safeCreateIcons === "function") {
    window.safeCreateIcons(scopeElement);
  } else if (typeof window !== "undefined" && window.lucide && typeof window.lucide.createIcons === "function") {
    try {
      if (scopeElement && scopeElement.nodeType === 1) {
        window.lucide.createIcons({ root: scopeElement });
      } else {
        window.lucide.createIcons();
      }
    } catch (_) {}
  }
}

// Grouped Series Structure (1 Poster per Show)
export let groupedShows = [];

// Current Active Category Filter ('All' | 'Kdrama' | 'Anime' | 'Chinese Drama' | 'Movie')
export let currentCategoryFilter = 'All';

// Currently Active Show and Episode in YouTube-Style Player
export let currentSelectedShow = null;
export let currentSelectedEpisodeIndex = 0;
let previousViewBeforePlayer = 'home';
let isYtAmbientOn = true;

// Normalize Category String strictly into one of the 4 valid categories
export function normalizeCategory(cat) {
  if (!cat) return 'Anime';
  const c = String(cat).trim().toLowerCase();
  if (c === 'kdrama' || c === 'k-drama' || c === 'korean drama') return 'Kdrama';
  if (c === 'anime' || c === 'animation') return 'Anime';
  if (c === 'chinese drama' || c === 'c-drama' || c === 'cdrama') return 'Chinese Drama';
  if (c === 'movie' || c === 'movies' || c === 'film') return 'Movie';
  return 'Anime';
}

// Format numbers (e.g. 842100 -> 842K, 1200000 -> 1.2M)
export function formatViews(num) {
  const n = Number(num) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

// Format seconds into MM:SS or HH:MM:SS
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

// Deterministic seed for initial realistic view counts
function getInitialSeedViews(title) {
  let hash = 0;
  const str = String(title || 'showverse');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash);
  return 120000 + (positive % 820000);
}

// Robust function to extract clean series name without "(S1 Ep 1)" or other episode tags
export function cleanSeriesTitle(epOrTitle) {
  if (!epOrTitle) return 'Untitled Series';
  let raw = '';
  if (typeof epOrTitle === 'string') {
    raw = epOrTitle;
  } else if (typeof epOrTitle === 'object') {
    if (typeof epOrTitle.seriesName === 'string' && epOrTitle.seriesName.trim()) {
      raw = epOrTitle.seriesName.trim();
    } else if (typeof epOrTitle.seriesTitle === 'string' && epOrTitle.seriesTitle.trim()) {
      raw = epOrTitle.seriesTitle.trim();
    } else if (typeof epOrTitle.showTitle === 'string' && epOrTitle.showTitle.trim()) {
      raw = epOrTitle.showTitle.trim();
    } else if (typeof epOrTitle.title === 'string' && epOrTitle.title.trim()) {
      raw = epOrTitle.title.trim();
    } else {
      raw = 'Untitled Series';
    }
  }

  // Strip trailing season/episode indicators
  let cleaned = raw
    .replace(/\s*[\(\[]\s*S\d+\s*(?:Ep|Episode|E)\s*\d+[^)\]]*[\)\]]/gi, '')
    .replace(/\s*[\(\[]\s*(?:Ep|Episode|E)\.?\s*\d+[^)\]]*[\)\]]/gi, '')
    .replace(/\s*-\s*(?:Season\s*\d+\s*)?(?:Episode|Ep\.?)\s*\d+/gi, '')
    .replace(/\s+-\s+S\d+\s+Ep\s+\d+/gi, '')
    .replace(/\s+S\d+\s+(?:Ep|Episode|E)\s*\d+$/gi, '')
    .trim();

  return cleaned || raw.trim() || 'Untitled Series';
}

// Extract clean episode number from doc or title
export function extractEpisodeNumber(ep, fallbackIndex = 1) {
  if (!ep) return fallbackIndex;
  if (ep.episode !== undefined && ep.episode !== null && ep.episode !== '') {
    const num = parseInt(ep.episode, 10);
    if (!isNaN(num) && num > 0) return num;
  }
  if (ep.episodeNumber !== undefined && ep.episodeNumber !== null && ep.episodeNumber !== '') {
    const num = parseInt(ep.episodeNumber, 10);
    if (!isNaN(num) && num > 0) return num;
  }
  const title = String(ep.title || ep.episodes || '');
  const match = title.match(/(?:Ep|Episode|E)\.?\s*(\d+)/i);
  if (match && match[1]) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return fallbackIndex;
}

// Extract season number
export function extractSeasonNumber(ep) {
  if (!ep) return 1;
  if (ep.season !== undefined && ep.season !== null && ep.season !== '') {
    const num = parseInt(ep.season, 10);
    if (!isNaN(num) && num > 0) return num;
  }
  const str = String(ep.title || ep.episodeTitle || ep.episodes || ep.description || '');
  const match = str.match(/(?:Season|S)\.?\s*(\d+)/i);
  if (match && match[1]) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 1;
}

// Active season state for player
export let currentSelectedSeason = 1;

export function getShowSeasons(show) {
  if (!show || !Array.isArray(show.episodes) || show.episodes.length === 0) {
    return [1];
  }
  const seasonSet = new Set();
  show.episodes.forEach(ep => {
    const s = parseInt(ep.season, 10);
    if (!isNaN(s) && s > 0) {
      seasonSet.add(s);
    }
  });
  if (seasonSet.size === 0) {
    const defaultS = parseInt(show.season, 10) || 1;
    seasonSet.add(defaultS);
  }
  return Array.from(seasonSet).sort((a, b) => a - b);
}

export function updateSeasonUI() {
  if (!currentSelectedShow) return;
  const seasons = getShowSeasons(currentSelectedShow);
  
  const seasonLabel = currentSelectedSeason === 'all' ? 'All Seasons' : `Season ${currentSelectedSeason}`;
  
  const metaSeasonEl = document.getElementById('ytMetaSeason');
  if (metaSeasonEl) metaSeasonEl.innerText = seasonLabel;

  const topBarSeasonText = document.getElementById('ytTopBarSeasonText');
  if (topBarSeasonText) topBarSeasonText.innerText = seasonLabel;

  const btnLabel = document.getElementById('ytSeasonBtnLabel');
  if (btnLabel) btnLabel.innerText = seasonLabel;

  // Dropdown select (for sync/fallback)
  const select = document.getElementById('ytSeasonSelect');
  if (select) {
    let html = seasons.map(s => `
      <option value="${s}" ${String(currentSelectedSeason) === String(s) ? 'selected' : ''}>Season ${s}</option>
    `).join('');
    if (seasons.length > 1) {
      html += `<option value="all" ${currentSelectedSeason === 'all' ? 'selected' : ''}>All Seasons</option>`;
    }
    select.innerHTML = html;
    select.value = String(currentSelectedSeason);
  }

  // Quick Season Tabs Container with radiant neon styling
  const tabsContainer = document.getElementById('ytSeasonTabsContainer');
  if (tabsContainer) {
    const items = [...seasons];
    if (seasons.length > 1) items.push('all');

    let tabsHtml = items.map(s => {
      const isAll = s === 'all';
      const isSelected = String(currentSelectedSeason) === String(s);
      const label = isAll ? 'All Seasons' : `Season ${s}`;
      const epCount = isAll ? currentSelectedShow.episodes.length : currentSelectedShow.episodes.filter(e => (parseInt(e.season, 10) || 1) === s).length;
      return `
        <button 
          type="button" 
          onclick="changePlayerSeason('${s}')"
          class="neon-pill-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 select-none ${
            isSelected 
              ? 'bg-brand-cyan text-black shadow-[0_0_20px_#00F0FF] scale-105 border-2 border-brand-cyan ring-2 ring-brand-cyan/40 font-black' 
              : 'bg-white/5 border border-white/10 hover:border-brand-cyan/60 text-slate-300 hover:text-white hover:bg-brand-cyan/10 hover:shadow-[0_0_15px_rgba(0,240,255,0.3)]'
          }">
          <i data-lucide="${isSelected ? 'check-circle' : 'layers'}" class="w-3.5 h-3.5 ${isSelected ? 'text-black' : 'text-brand-cyan'}"></i>
          <span>${label}</span>
          <span class="text-[10px] ${isSelected ? 'text-black/80 font-black' : 'text-brand-cyan/70 font-mono'}">(${epCount})</span>
        </button>
      `;
    }).join('');

    // Add a neon button to open the full Neon Season Selector dialog
    tabsHtml += `
      <button 
        type="button" 
        onclick="openSeasonModal(event)"
        class="neon-pill-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 select-none bg-gradient-to-r from-purple-500/20 to-brand-cyan/20 border border-brand-cyan/40 hover:border-brand-cyan text-brand-cyan hover:text-white shadow-[0_0_12px_rgba(0,240,255,0.25)]" 
        title="Open Neon Season Picker">
        <i data-lucide="sparkles" class="w-3.5 h-3.5 text-brand-cyan animate-pulse"></i>
        <span>Seasons Menu</span>
      </button>
    `;

    tabsContainer.innerHTML = tabsHtml;
  }

  // If neon modal is open, re-render its options to reflect current active selection
  const modal = document.getElementById('ytSeasonModal');
  if (modal && !modal.classList.contains('hidden')) {
    renderSeasonModal();
  }

  triggerSafeIcons(tabsContainer);
}

// NEON SEASON MODAL FUNCTIONS
export function openSeasonModal(e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
  closePlayerSeasonMenu();
  if (!currentSelectedShow) return;

  const modal = document.getElementById('ytSeasonModal');
  const titleEl = document.getElementById('ytSeasonModalShowTitle');
  if (!modal) return;

  if (titleEl) {
    titleEl.textContent = currentSelectedShow.title || 'Series';
  }

  renderSeasonModal();

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('overflow-hidden');

  triggerSafeIcons(modal);
}

export function closeSeasonModal() {
  const modal = document.getElementById('ytSeasonModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
}

export function handleSeasonModalBackdropClick(e) {
  if (e && e.target && e.target.id === 'ytSeasonModal') {
    closeSeasonModal();
  }
}

export function selectSeasonFromModal(seasonVal) {
  changePlayerSeason(seasonVal, true);
  closeSeasonModal();
}

// ========================================================
// VIDEO DURATION FETCHING & CACHING ENGINE
// ========================================================
export const videoDurationCache = new Map();

// Initialize duration cache from localStorage
try {
  const savedDurations = localStorage.getItem('showverse_video_durations_v2');
  if (savedDurations) {
    const parsed = JSON.parse(savedDurations);
    Object.entries(parsed).forEach(([url, dur]) => {
      if (typeof dur === 'number' && dur > 0) {
        videoDurationCache.set(url, dur);
      }
    });
  }
} catch (_) {}

export function saveDurationToCache(videoUrl, duration) {
  if (!videoUrl || !isFinite(duration) || duration <= 0) return;
  const rounded = Math.round(duration);
  videoDurationCache.set(videoUrl, rounded);
  try {
    const obj = {};
    videoDurationCache.forEach((v, k) => {
      // Keep only up to 200 URLs to avoid excessive storage
      if (Object.keys(obj).length < 200) obj[k] = v;
    });
    localStorage.setItem('showverse_video_durations_v2', JSON.stringify(obj));
  } catch (_) {}
}

export function formatVideoDuration(seconds) {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '--:--';
  const total = Math.round(Number(seconds));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function getEstimatedDuration(category = '', episode = null) {
  if (episode && episode.duration) {
    const parsed = parseFloat(episode.duration);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  const norm = normalizeCategory(category || (episode ? episode.category : ''));
  if (norm === 'Movie') return 7080; // 1h 58m
  if (norm === 'Kdrama' || norm === 'Chinese Drama') return 2700; // 45m
  if (norm === 'Anime') return 1440; // 24m
  return 1500; // 25m
}

export function getCachedOrEstimatedDuration(ep, category = '') {
  if (!ep) return 1440;
  if (ep.videoUrl && videoDurationCache.has(ep.videoUrl)) {
    return videoDurationCache.get(ep.videoUrl);
  }
  if (ep.duration && typeof ep.duration === 'number' && ep.duration > 0) {
    return ep.duration;
  }
  return getEstimatedDuration(category || (currentSelectedShow ? currentSelectedShow.category : ''), ep);
}

export function updateDurationInDOM(videoUrl, duration) {
  if (!videoUrl) return;
  const formatted = formatVideoDuration(duration);

  // Update all duration text elements associated with this videoUrl
  const targets = document.querySelectorAll(`[data-video-url="${CSS.escape(videoUrl)}"]`);
  targets.forEach(el => {
    if (el.classList.contains('ep-duration-text') || el.classList.contains('ep-dur-val')) {
      el.textContent = formatted;
      const badge = el.closest('.neon-duration-badge');
      if (badge) badge.classList.remove('is-loading');
    } else {
      const child = el.querySelector('.ep-duration-text, .ep-dur-val');
      if (child) {
        child.textContent = formatted;
        const badge = child.closest('.neon-duration-badge');
        if (badge) badge.classList.remove('is-loading');
      }
    }
  });
}

const activeProbeUrls = new Set();

export function fetchEpisodeDuration(ep, category = '') {
  if (!ep || !ep.videoUrl) return Promise.resolve(null);
  const url = ep.videoUrl;

  // Cache hit
  if (videoDurationCache.has(url)) {
    return Promise.resolve(videoDurationCache.get(url));
  }

  if (ep.duration && typeof ep.duration === 'number' && ep.duration > 0) {
    saveDurationToCache(url, ep.duration);
    return Promise.resolve(ep.duration);
  }

  // Instant zero-lag resolution via smart category duration without stalling browser network
  const est = getEstimatedDuration(category, ep);
  saveDurationToCache(url, est);
  updateDurationInDOM(url, est);
  return Promise.resolve(est);
}

export function prefetchShowDurations(show) {
  if (!show || !Array.isArray(show.episodes)) return;
  // Initialize duration metadata synchronously into memory without launching concurrent video network probes
  show.episodes.forEach(ep => {
    if (ep.videoUrl && !videoDurationCache.has(ep.videoUrl)) {
      const est = (ep.duration && typeof ep.duration === 'number' && ep.duration > 0) 
        ? ep.duration 
        : getEstimatedDuration(show.category, ep);
      saveDurationToCache(ep.videoUrl, est);
      updateDurationInDOM(ep.videoUrl, est);
    }
  });
}

export function modalSwitchSeason(seasonVal) {
  currentSelectedSeason = seasonVal === 'all' ? 'all' : (parseInt(seasonVal, 10) || 1);
  updateSeasonUI();
  renderYtEpisodesRow();
  renderSeasonModal();
}

export function selectEpisodeFromSeasonModal(index) {
  switchYtEpisode(index);
  closeSeasonModal();
  if (window.showToast && currentSelectedShow && currentSelectedShow.episodes[index]) {
    const ep = currentSelectedShow.episodes[index];
    const durVal = getCachedOrEstimatedDuration(ep);
    const durStr = durVal ? ` (${formatVideoDuration(durVal)})` : '';
    window.showToast(`Playing S${ep.season || 1} Ep ${ep.episodeNumber}${durStr}`);
  }
}

export function renderSeasonModal() {
  const container = document.getElementById('ytSeasonModalOptions');
  if (!container || !currentSelectedShow) return;

  const seasons = getShowSeasons(currentSelectedShow);
  const totalEps = currentSelectedShow.episodes.length;
  const currentSeasonLabel = currentSelectedSeason === 'all' ? 'All Seasons' : `Season ${currentSelectedSeason}`;

  // Pre-fetch all episode durations for the current show
  prefetchShowDurations(currentSelectedShow);

  // Filter episodes for currently selected season
  const displayedEpisodes = currentSelectedSeason === 'all'
    ? currentSelectedShow.episodes
    : currentSelectedShow.episodes.filter(e => (parseInt(e.season, 10) || 1) === currentSelectedSeason);

  // 1. Season selection tabs header (cyberpunk neon pills with counts)
  let html = `
    <!-- Neon Season Pills Tab Bar -->
    <div class="space-y-2 pb-3 border-b border-brand-cyan/20">
      <div class="flex items-center justify-between text-xs px-1">
        <span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <i data-lucide="layers" class="w-3.5 h-3.5 text-brand-cyan"></i>
          <span>Choose Season</span>
        </span>
        <span class="text-[11px] font-mono text-brand-cyan font-bold">${seasons.length} ${seasons.length === 1 ? 'Season' : 'Seasons'} Available</span>
      </div>
      <div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
  `;

  seasons.forEach(s => {
    const isSelected = String(currentSelectedSeason) === String(s);
    const seasonEps = currentSelectedShow.episodes.filter(e => (parseInt(e.season, 10) || 1) === s);
    html += `
      <button 
        type="button" 
        onclick="modalSwitchSeason('${s}')"
        class="neon-pill-btn flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 select-none ${
          isSelected 
            ? 'bg-gradient-to-r from-brand-cyan via-brand-cyan/90 to-cyan-300 text-black shadow-[0_0_20px_#00F0FF] border-2 border-brand-cyan font-black' 
            : 'bg-white/5 hover:bg-brand-cyan/15 border border-white/10 hover:border-brand-cyan/60 text-slate-300 hover:text-white'
        }">
        <div class="w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-black shadow-[0_0_6px_black]' : 'border border-slate-400'}"></div>
        <span>Season ${s}</span>
        <span class="text-[10px] ${isSelected ? 'text-black/80 font-black' : 'text-brand-cyan/80 font-mono'}">(${seasonEps.length})</span>
      </button>
    `;
  });

  if (seasons.length > 1) {
    const isAllSelected = currentSelectedSeason === 'all';
    html += `
      <button 
        type="button" 
        onclick="modalSwitchSeason('all')"
        class="neon-pill-btn flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 select-none ${
          isAllSelected 
            ? 'bg-gradient-to-r from-brand-cyan via-brand-cyan/90 to-cyan-300 text-black shadow-[0_0_20px_#00F0FF] border-2 border-brand-cyan font-black' 
            : 'bg-white/5 hover:bg-brand-cyan/15 border border-white/10 hover:border-brand-cyan/60 text-slate-300 hover:text-white'
        }">
        <div class="w-2.5 h-2.5 rounded-full ${isAllSelected ? 'bg-black shadow-[0_0_6px_black]' : 'border border-slate-400'}"></div>
        <span>All Seasons</span>
        <span class="text-[10px] ${isAllSelected ? 'text-black/80 font-black' : 'text-brand-cyan/80 font-mono'}">(${totalEps})</span>
      </button>
    `;
  }

  html += `
      </div>
    </div>

    <!-- Episodes Header with Duration Highlight -->
    <div class="flex items-center justify-between pt-1 px-1">
      <div class="flex items-center gap-2">
        <i data-lucide="play-square" class="w-4 h-4 text-brand-cyan"></i>
        <h4 class="text-xs font-black uppercase tracking-wider text-white">${currentSeasonLabel} Episodes</h4>
      </div>
      <span class="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
        <i data-lucide="clock" class="w-3 h-3 text-brand-cyan"></i>
        <span>${displayedEpisodes.length} ${displayedEpisodes.length === 1 ? 'Episode' : 'Episodes'}</span>
      </span>
    </div>

    <!-- Episode Cards List in Season Selector -->
    <div class="space-y-2.5 pt-1">
  `;

  displayedEpisodes.forEach((ep) => {
    const overallIdx = currentSelectedShow.episodes.findIndex(e => e.id === ep.id);
    const targetIdx = overallIdx !== -1 ? overallIdx : 0;
    const isActive = targetIdx === currentSelectedEpisodeIndex;
    const sNum = ep.season || 1;
    const thumbUrl = ep.image || currentSelectedShow.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80';

    const durVal = getCachedOrEstimatedDuration(ep);
    const formattedDur = durVal ? formatVideoDuration(durVal) : '--:--';
    const isFetching = !videoDurationCache.has(ep.videoUrl);

    if (isFetching && ep.videoUrl) {
      fetchEpisodeDuration(ep, currentSelectedShow.category);
    }

    html += `
      <div 
        role="button"
        tabindex="0"
        onclick="selectEpisodeFromSeasonModal(${targetIdx})"
        class="group w-full p-3 sm:p-3.5 rounded-2xl cursor-pointer transition-all duration-200 border flex items-center gap-3.5 select-none ${
          isActive 
            ? 'bg-gradient-to-r from-brand-cyan/25 via-brand-cyan/15 to-purple-500/20 border-2 border-brand-cyan shadow-[0_0_24px_rgba(0,240,255,0.4)] ring-1 ring-brand-cyan/60 scale-[1.01]' 
            : 'bg-white/[0.04] hover:bg-brand-cyan/[0.08] border-white/10 hover:border-brand-cyan/50 hover:shadow-[0_0_16px_rgba(0,240,255,0.2)]'
        }">
        
        <!-- Thumbnail & Duration Pill Overlay -->
        <div class="relative flex-shrink-0 w-24 sm:w-28 h-15 sm:h-17 rounded-xl overflow-hidden bg-slate-900 border border-white/10 group-hover:border-brand-cyan/50 transition-colors">
          <img src="${thumbUrl}" alt="Ep ${ep.episodeNumber}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
          <div class="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
            <div class="w-7 h-7 rounded-full bg-brand-cyan text-black flex items-center justify-center shadow-neon-cyan ${isActive ? 'scale-110' : 'opacity-85 group-hover:opacity-100 group-hover:scale-110'} transition-all">
              <i data-lucide="${isActive ? 'volume-2' : 'play'}" class="w-3.5 h-3.5 ${isActive ? 'text-black' : 'text-black fill-current ml-0.5'}"></i>
            </div>
          </div>
          <!-- Floating Duration Overlay Pill on thumbnail -->
          <div class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/85 backdrop-blur-md text-[9px] font-mono font-bold text-brand-cyan border border-brand-cyan/40">
            <span class="ep-dur-val" data-video-url="${ep.videoUrl}">${formattedDur}</span>
          </div>
        </div>

        <!-- Episode Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-black uppercase tracking-wider ${
              isActive ? 'bg-brand-cyan text-black shadow-neon-cyan' : 'bg-white/10 text-slate-300'
            }">
              S${sNum} • E${ep.episodeNumber}
            </span>
            ${isActive ? '<span class="text-[9px] font-black text-brand-cyan uppercase tracking-wider animate-pulse flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-brand-cyan shadow-neon-cyan"></span> Playing</span>' : ''}
          </div>

          <h4 class="text-xs sm:text-sm font-bold truncate ${isActive ? 'text-white neon-text-glow font-black' : 'text-slate-200 group-hover:text-brand-cyan'} transition-colors">
            ${ep.episodeTitle || `Episode ${ep.episodeNumber}`}
          </h4>

          <div class="flex items-center gap-2.5 mt-1.5">
            <!-- Prominent Neon Video Duration Badge -->
            <div class="neon-duration-badge flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold ${isFetching ? 'is-loading' : ''}" title="Video Duration: ${formattedDur}">
              <i data-lucide="clock" class="w-3 h-3 text-brand-cyan"></i>
              <span class="ep-duration-text font-mono" data-video-url="${ep.videoUrl}">${formattedDur}</span>
            </div>

            <span class="text-[10px] font-mono text-slate-400 uppercase">
              ${ep.quality || '1080P MASTER'}
            </span>
          </div>
        </div>

        <!-- Right Action Button -->
        <div class="flex-shrink-0 pr-1">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
            isActive ? 'bg-brand-cyan text-black shadow-neon-cyan' : 'bg-white/5 text-slate-400 group-hover:text-brand-cyan group-hover:bg-brand-cyan/20 border border-white/10 group-hover:border-brand-cyan/40'
          }">
            <i data-lucide="${isActive ? 'check' : 'chevron-right'}" class="w-4 h-4"></i>
          </div>
        </div>
      </div>
    `;
  });

  html += `
    </div>
  `;

  container.innerHTML = html;
  triggerSafeIcons(container);
}

export function changePlayerSeason(seasonVal, shouldPlay = false) {
  if (!currentSelectedShow) return;
  currentSelectedSeason = seasonVal === 'all' ? 'all' : (parseInt(seasonVal, 10) || 1);
  updateSeasonUI();
  renderYtEpisodesRow();

  if (shouldPlay && currentSelectedSeason !== 'all') {
    const firstEpIndex = currentSelectedShow.episodes.findIndex(e => (parseInt(e.season, 10) || 1) === currentSelectedSeason);
    if (firstEpIndex !== -1 && firstEpIndex !== currentSelectedEpisodeIndex) {
      switchYtEpisode(firstEpIndex);
    }
  }

  if (window.showToast) {
    window.showToast(currentSelectedSeason === 'all' ? 'Viewing All Seasons' : `Season ${currentSelectedSeason} Active`);
  }
}

export function togglePlayerSeasonMenu(e) {
  openSeasonModal(e);
}

export function closePlayerSeasonMenu() {
  const dropdownTop = document.getElementById('ytTopBarSeasonDropdown');
  const dropdownMeta = document.getElementById('ytMetaSeasonDropdown');
  if (dropdownTop) dropdownTop.classList.add('hidden');
  if (dropdownMeta) dropdownMeta.classList.add('hidden');
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const topContainer = document.getElementById('ytTopBarSeasonContainer');
    const metaContainer = document.getElementById('ytMetaSeasonContainer');
    if ((!topContainer || !topContainer.contains(e.target)) && (!metaContainer || !metaContainer.contains(e.target))) {
      closePlayerSeasonMenu();
    }
  });
}

// 1. DATA GROUPING: GROUP ALL FIRESTORE DOCUMENTS BY SERIES TITLE (STRICT 1 CARD PER SHOW)
export function groupEpisodesIntoShows(episodesList) {
  // Load persistent views counters from localStorage
  let storedViews = {};
  try {
    storedViews = JSON.parse(localStorage.getItem('showverse_series_views') || '{}');
  } catch (_) {
    storedViews = {};
  }

  const map = new Map();

  // ONLY real Firestore episodes are processed into shows
  if (Array.isArray(episodesList) && episodesList.length > 0) {
    episodesList.forEach((ep) => {
      const cleanTitle = cleanSeriesTitle(ep);
      const key = cleanTitle.toLowerCase().trim();

      if (!map.has(key)) {
        let views = storedViews[key];
        if (typeof views !== 'number' || isNaN(views) || views <= 0) {
          views = getInitialSeedViews(cleanTitle);
          storedViews[key] = views;
        }

        let seedRating = (9.2 + ((getInitialSeedViews(cleanTitle) % 8) / 10)).toFixed(1);

        map.set(key, {
          id: ep.id || `show_${key}`,
          showKey: key,
          title: cleanTitle,
          category: normalizeCategory(ep.category),
          image: ep.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80',
          description: ep.description || ep.desc || `Watch ${cleanTitle} in ultra-high bitrate with Dolby Atmos sound on Show Verse.`,
          season: extractSeasonNumber(ep),
          rating: ep.rating || seedRating,
          views: views,
          episodes: []
        });
      }

      const show = map.get(key);

      if (ep.category && normalizeCategory(ep.category) !== 'Anime') {
        show.category = normalizeCategory(ep.category);
      }
      if (ep.image && (!show.image || show.image.includes('unsplash'))) {
        show.image = ep.image;
      }

      const epNum = extractEpisodeNumber(ep, show.episodes.length + 1);
      const sNum = extractSeasonNumber(ep) || show.season || 1;
      const vUrl = ep.videoUrl || '';

      const exists = show.episodes.some(existing => 
        (existing.id && ep.id && existing.id === ep.id) ||
        (existing.episodeNumber === epNum && existing.season === sNum && existing.videoUrl === vUrl)
      );

      if (!exists) {
        show.episodes.push({
          id: ep.id || `${key}_ep_${epNum}`,
          showTitle: cleanTitle,
          episodeNumber: epNum,
          season: sNum,
          episodeTitle: ep.episodeTitle || (show.category === 'Movie' ? 'Feature Presentation' : `Episode ${epNum}`),
          videoUrl: vUrl,
          image: ep.image || show.image,
          quality: ep.quality || '1080p',
          createdAt: ep.createdAt || ep.uploadedAt || '',
          duration: ep.duration || ep.videoDuration || ep.length || null
        });
      }
    });
  }

  // Save views map back to localStorage
  try {
    localStorage.setItem('showverse_series_views', JSON.stringify(storedViews));
  } catch (_) {}

  // Sort episodes in each show in natural order
  const shows = Array.from(map.values());
  shows.forEach((show) => {
    show.episodes.sort((a, b) => {
      const sA = parseInt(a.season, 10) || 1;
      const sB = parseInt(b.season, 10) || 1;
      if (sA !== sB) return sA - sB;
      const eA = parseInt(a.episodeNumber, 10) || 0;
      const eB = parseInt(b.episodeNumber, 10) || 0;
      return eA - eB;
    });
  });

  return shows;
}

// Increment view count for a series when watched
export function incrementShowViews(showKey) {
  if (!showKey) return;
  const key = String(showKey).trim().toLowerCase();
  let storedViews = {};
  try {
    storedViews = JSON.parse(localStorage.getItem('showverse_series_views') || '{}');
  } catch (_) {}
  const current = storedViews[key] || getInitialSeedViews(key);
  storedViews[key] = current + 1;
  try {
    localStorage.setItem('showverse_series_views', JSON.stringify(storedViews));
  } catch (_) {}

  const show = groupedShows.find(s => s.showKey === key);
  if (show) {
    show.views = storedViews[key];
    const viewsEl = document.getElementById('ytShowViews');
    if (viewsEl && currentSelectedShow && currentSelectedShow.showKey === key) {
      viewsEl.innerHTML = `<i data-lucide="flame" class="w-4 h-4 text-amber-400"></i> ${formatViews(show.views)} Views`;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

// 2. LISTEN TO FIRESTORE "showverse_episodes" REAL-TIME
export function initShowverseEpisodesSync() {
  // Purge any legacy mock demo videos from local cache and continue watching
  try {
    const cached = localStorage.getItem('showverse_cached_episodes');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Keep ONLY real Firestore items
        const realOnly = parsed.filter(ep => ep.isLiveFirestore === true || ep.docId || ep.uploadedAt);
        firestoreEpisodes = realOnly;
      }
    }
    // Clean continue watching and watch history from old ocean demo videos
    const cw = localStorage.getItem('showverse_continue_watching');
    if (cw) {
      const parsedCw = JSON.parse(cw);
      if (Array.isArray(parsedCw)) {
        const cleanedCw = parsedCw.filter(item => item.videoUrl && !item.videoUrl.includes('oceans.mp4'));
        localStorage.setItem('showverse_continue_watching', JSON.stringify(cleanedCw));
      }
    }
  } catch (_) {}

  groupedShows = groupEpisodesIntoShows(firestoreEpisodes);
  if (typeof window !== "undefined") {
    window.firestoreEpisodes = firestoreEpisodes;
    window.groupedShows = groupedShows;
  }
  renderAllViews();
  checkUrlDeepLink();

  if (!db) {
    return;
  }

  // Real-time onSnapshot subscription to "showverse_episodes"
  try {
    onSnapshot(collection(db, "showverse_episodes"), (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          isLiveFirestore: true,
          ...data,
          category: normalizeCategory(data.category)
        });
      });
      list.sort((a, b) => {
        const timeA = a.uploadedAt || a.createdAt || '';
        const timeB = b.uploadedAt || b.createdAt || '';
        return timeB.localeCompare(timeA);
      });
      firestoreEpisodes = list;
      groupedShows = groupEpisodesIntoShows(firestoreEpisodes);
      if (typeof window !== "undefined") {
        window.firestoreEpisodes = firestoreEpisodes;
        window.groupedShows = groupedShows;
      }
      try {
        localStorage.setItem('showverse_cached_episodes', JSON.stringify(list));
      } catch (_) {}
      renderAllViews();
      checkUrlDeepLink();
    }, (err) => {
      console.log("[Show Verse] Firestore live sync offline fallback:", err ? (err.message || String(err)) : "offline");
    });
  } catch (e) {
    console.warn("Firestore subscription notice:", e);
  }
}

// Deep linking: If someone opened a shared link ?series=... or ?show=..., auto-open it
function checkUrlDeepLink() {
  try {
    const params = new URLSearchParams(window.location.search);
    const seriesTitle = params.get('series') || params.get('show');
    if (seriesTitle && !window._hasAutoOpenedSharedSeries) {
      const matched = (groupedShows || []).find(s => 
        cleanSeriesTitle(s.title).toLowerCase() === seriesTitle.trim().toLowerCase() ||
        s.showKey === seriesTitle.trim().toLowerCase()
      );
      if (matched) {
        window._hasAutoOpenedSharedSeries = true;
        const epParam = parseInt(params.get('ep'), 10) || 1;
        const epIndex = Math.max(0, epParam - 1);
        setTimeout(() => {
          openShowPlayerPage(matched.title, epIndex);
        }, 150);
      }
    }
  } catch (_) {}
}

// Master Render Function
export function renderAllViews() {
  if (!groupedShows || groupedShows.length === 0) {
    groupedShows = groupEpisodesIntoShows(firestoreEpisodes);
  }

  renderCategoryRows();
  renderTrendingRows();
  renderHeroFromFirestore();

  if (currentCategoryFilter && currentCategoryFilter !== 'All') {
    renderDedicatedCategoryGrid(currentCategoryFilter);
  }

  if (typeof window !== "undefined" && typeof window.renderContinueWatching === "function") {
    window.renderContinueWatching();
  }

  triggerSafeIcons();
}

// 3. RENDER HOMEPAGE CATEGORY SLIDERS (STRICTLY 1 POSTER PER SHOW)
export function renderCategoryRows() {
  const categorized = {
    'Kdrama': groupedShows.filter(show => show.category === 'Kdrama'),
    'Anime': groupedShows.filter(show => show.category === 'Anime'),
    'Chinese Drama': groupedShows.filter(show => show.category === 'Chinese Drama'),
    'Movie': groupedShows.filter(show => show.category === 'Movie')
  };

  updateCategoryCounters(categorized);
  renderRowContainer('kdramaRow', categorized['Kdrama'], 'Kdrama');
  renderRowContainer('animeRow', categorized['Anime'], 'Anime');
  renderRowContainer('cdramaRow', categorized['Chinese Drama'], 'Chinese Drama');
  renderRowContainer('moviesRow', categorized['Movie'], 'Movie');

  triggerSafeIcons();
}

function updateCategoryCounters(categorized) {
  const countKdrama = document.getElementById('badge-count-Kdrama');
  const countAnime = document.getElementById('badge-count-Anime');
  const countCDrama = document.getElementById('badge-count-ChineseDrama');
  const countMovie = document.getElementById('badge-count-Movie');

  if (countKdrama) countKdrama.innerText = categorized['Kdrama'].length;
  if (countAnime) countAnime.innerText = categorized['Anime'].length;
  if (countCDrama) countCDrama.innerText = categorized['Chinese Drama'].length;
  if (countMovie) countMovie.innerText = categorized['Movie'].length;

  const headerKdrama = document.getElementById('header-count-Kdrama');
  const headerAnime = document.getElementById('header-count-Anime');
  const headerCDrama = document.getElementById('header-count-ChineseDrama');
  const headerMovie = document.getElementById('header-count-Movie');

  if (headerKdrama) headerKdrama.innerText = `${categorized['Kdrama'].length} Series`;
  if (headerAnime) headerAnime.innerText = `${categorized['Anime'].length} Series`;
  if (headerCDrama) headerCDrama.innerText = `${categorized['Chinese Drama'].length} Series`;
  if (headerMovie) headerMovie.innerText = `${categorized['Movie'].length} Series`;
}

// Generate Card HTML for each Series in horizontal category sliders
function renderRowContainer(elementId, shows, categoryName) {
  const container = document.getElementById(elementId);
  if (!container) return;

  if (!shows || shows.length === 0) {
    container.innerHTML = `
      <div class="flex-shrink-0 w-80 p-6 text-center glass-card rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2">
        <i data-lucide="film" class="w-8 h-8 text-slate-500"></i>
        <p class="font-bold text-xs text-slate-300">No series published in ${categoryName} yet</p>
        <p class="text-[11px] text-slate-400">Upload episodes via Creator Studio to feature series here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = shows.map((show) => {
    const safeTitle = (show.title || 'Untitled').replace(/'/g, "\\'");
    const epCount = show.episodes.length;
    const epLabel = epCount === 1 ? '1 Episode' : `${epCount} Episodes`;
    const isSaved = typeof window.isWatchLater === 'function' && window.isWatchLater(show.title);
    return `
      <div class="relative flex-shrink-0 w-44 sm:w-52 glass-card rounded-2xl overflow-hidden tilt-card group cursor-pointer border border-white/5 hover:border-brand-cyan/40 transition-all duration-300" onclick="openShowPlayerPage('${safeTitle}')">
        <!-- 2:3 Aspect Poster -->
        <div class="relative aspect-[2/3] overflow-hidden bg-slate-950">
          <img src="${show.image}" alt="${show.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async" />
          
          <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
          
          <!-- Top Badges -->
          <div class="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
            <span class="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur text-[10px] font-bold text-slate-300 border border-white/10 uppercase">
              ${show.category}
            </span>
            <div class="flex items-center gap-1.5">
              <button 
                type="button"
                onclick="toggleWatchLaterFromCard('${safeTitle}', event)"
                class="w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-md ${isSaved ? 'bg-brand-cyan text-black shadow-neon-cyan ring-1 ring-brand-cyan/60' : 'bg-black/60 hover:bg-black/90 text-slate-300 hover:text-brand-cyan border border-white/20'}"
                title="${isSaved ? 'Remove from Watch Later' : 'Add to Watch Later'}"
              >
                <i data-lucide="${isSaved ? 'bookmark-check' : 'bookmark'}" class="w-3.5 h-3.5 ${isSaved ? 'text-black fill-black' : 'text-brand-cyan'}"></i>
              </button>
              <span class="px-2 py-0.5 rounded-full bg-brand-cyan/90 text-black text-[10px] font-black uppercase shadow-neon-cyan">
                ★ ${show.rating}
              </span>
            </div>
          </div>

          <!-- Play Hover Overlay -->
          <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
            <div class="w-12 h-12 rounded-full bg-brand-cyan text-black flex items-center justify-center shadow-neon-cyan transform scale-90 group-hover:scale-100 transition-transform">
              <i data-lucide="play" class="w-5 h-5 fill-black ml-0.5"></i>
            </div>
          </div>

          <!-- Bottom Meta Info -->
          <div class="absolute bottom-2.5 left-2.5 right-2.5 text-left">
            <div class="flex items-center justify-between text-[11px] text-slate-300 mb-1">
              <span class="font-mono text-brand-cyan text-[10px] font-bold">${epLabel}</span>
              <span class="text-[10px] text-amber-400 font-mono">🔥 ${formatViews(show.views)}</span>
            </div>
            <h3 class="text-xs font-black text-white truncate group-hover:text-brand-cyan transition-colors">
              ${show.title}
            </h3>
            <p class="text-[10px] text-slate-400 truncate mt-0.5">Season ${show.season || '1'} • 4K Dolby Atmos</p>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// 4. REAL TRENDING LOGIC: SORT GROUPED SHOWS BY HIGHEST VIEWS WITH RANK NUMERALS
export function renderTrendingRows() {
  const container = document.getElementById('trendingRow');
  if (!container) return;

  if (!groupedShows || groupedShows.length === 0) {
    container.innerHTML = `
      <div class="w-full p-8 text-center glass-card rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2">
        <i data-lucide="flame" class="w-8 h-8 text-slate-500"></i>
        <p class="font-bold text-slate-300">No trending series available yet</p>
        <p class="text-xs text-slate-400">Titles will appear ranked by user stream views.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Sort series by highest views descending
  const sortedByViews = [...groupedShows].sort((a, b) => (b.views || 0) - (a.views || 0));
  const trendingItems = sortedByViews.slice(0, 10);

  container.innerHTML = trendingItems.map((show, index) => {
    const safeTitle = (show.title || 'Untitled').replace(/'/g, "\\'");
    const epCount = show.episodes.length;
    const epLabel = epCount === 1 ? '1 Episode' : `${epCount} Episodes`;
    const isSaved = typeof window.isWatchLater === 'function' && window.isWatchLater(show.title);
    return `
      <div class="relative flex-shrink-0 w-44 sm:w-52 glass-card rounded-2xl overflow-hidden tilt-card group cursor-pointer border border-white/5 hover:border-brand-cyan/40 transition-all duration-300" onclick="openShowPlayerPage('${safeTitle}')">
        <div class="relative aspect-[2/3] overflow-hidden bg-slate-950">
          <img src="${show.image}" alt="${show.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async">
          <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent"></div>
          
          <!-- Large Netflix-Style Rank Number -->
          <span class="absolute -bottom-3 -left-1 text-7xl font-black italic tracking-tighter text-transparent select-none" style="-webkit-text-stroke: 2px #00F0FF; opacity: 0.85;">
            ${index + 1}
          </span>

          <!-- Views Counter Badge & Watch Later Top Right -->
          <div class="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
            <button 
              type="button"
              onclick="toggleWatchLaterFromCard('${safeTitle}', event)"
              class="w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-md ${isSaved ? 'bg-brand-cyan text-black shadow-neon-cyan ring-1 ring-brand-cyan/60' : 'bg-black/60 hover:bg-black/90 text-slate-300 hover:text-brand-cyan border border-white/20'}"
              title="${isSaved ? 'Remove from Watch Later' : 'Add to Watch Later'}"
            >
              <i data-lucide="${isSaved ? 'bookmark-check' : 'bookmark'}" class="w-3.5 h-3.5 ${isSaved ? 'text-black fill-black' : 'text-brand-cyan'}"></i>
            </button>
            <div class="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur border border-amber-400/40 text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1">
              <i data-lucide="flame" class="w-3 h-3 text-amber-400"></i> ${formatViews(show.views)}
            </div>
          </div>
        </div>
        <div class="p-3 pl-14">
          <h4 class="font-bold text-xs text-white truncate group-hover:text-brand-cyan transition">${show.title}</h4>
          <p class="text-[10px] text-slate-400 truncate mt-0.5">${show.category} • ${epLabel}</p>
        </div>
      </div>
    `;
  }).join('');

  triggerSafeIcons(container);
}

// 5. HERO BANNER: FEATURING TOP SERIES (OPENS YOUTUBE-STYLE PLAYER PAGE)
export function renderHeroFromFirestore() {
  const heroTitle = document.getElementById('heroTitle');
  const heroDesc = document.getElementById('heroDesc');
  const heroImage = document.getElementById('heroImage');
  const heroPlayBtn = document.getElementById('heroPlayBtn');

  if (!heroTitle || !heroDesc) return;

  if (groupedShows.length > 0) {
    const sorted = [...groupedShows].sort((a, b) => (b.views || 0) - (a.views || 0));
    const featured = sorted[0];

    heroTitle.innerText = featured.title.toUpperCase();
    heroDesc.innerText = featured.description || `Streaming ${featured.title} with high bitrate, ambient glow, and Dolby Atmos audio on Show Verse.`;
    if (heroImage && featured.image) {
      heroImage.src = featured.image;
    }
    if (heroPlayBtn) {
      const safeTitle = featured.title.replace(/'/g, "\\'");
      heroPlayBtn.setAttribute('onclick', `openShowPlayerPage('${safeTitle}')`);
      heroPlayBtn.innerHTML = `<i data-lucide="play" class="w-4 h-4 fill-black"></i> Play`;
    }
  } else {
    heroTitle.innerText = "SHOW VERSE";
    heroDesc.innerText = "Direct Firebase Streaming. Hardcoded AI-generated demo videos have been removed. Only real series and episodes published to your Firebase collection will appear here. Open Creator Studio to upload your first series.";
    if (heroPlayBtn) {
      heroPlayBtn.setAttribute('onclick', "if(window.openCreatorStudio){window.openCreatorStudio();}else{window.openMeModal();}");
      heroPlayBtn.innerHTML = `<i data-lucide="plus-circle" class="w-4 h-4 fill-black"></i> Open Creator Studio`;
    }
  }

  triggerSafeIcons();
}

// 6. TOP CATEGORY BAR & DEDICATED FULL-PAGE SLIDE TRANSITIONS
export function filterCategoryView(selectedCategory) {
  currentCategoryFilter = selectedCategory;

  const chips = ['All', 'Kdrama', 'Anime', 'Chinese Drama', 'Movie'];
  chips.forEach((c) => {
    const chipId = c === 'Chinese Drama' ? 'chip-ChineseDrama' : `chip-${c}`;
    const el = document.getElementById(chipId);
    if (!el) return;
    if (c === selectedCategory) {
      el.className = "category-filter-chip active px-4 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-2 bg-brand-cyan text-black shadow-neon-cyan whitespace-nowrap scale-105 cursor-pointer";
    } else {
      el.className = "category-filter-chip px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 glass-card hover:bg-white/15 border border-white/15 text-white whitespace-nowrap scale-100 cursor-pointer";
    }
  });

  const indicator = document.getElementById('categoryActiveIndicator');
  if (indicator) {
    if (selectedCategory === 'All') {
      indicator.innerText = "All Categories Active";
      indicator.className = "hidden sm:inline-flex text-[11px] font-semibold text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/20 px-2.5 py-0.5 rounded-full whitespace-nowrap";
    } else {
      indicator.innerText = `Viewing: ${selectedCategory}`;
      indicator.className = "hidden sm:inline-flex text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full whitespace-nowrap";
    }
  }

  const homeView = document.getElementById('homeView');
  const dedicatedCategoryView = document.getElementById('dedicatedCategoryView');
  const showPlayerPage = document.getElementById('showPlayerPage');
  const topCategoryBar = document.getElementById('topCategoryBar');

  if (topCategoryBar) {
    topCategoryBar.classList.remove('hidden');
  }

  if (showPlayerPage && !showPlayerPage.classList.contains('hidden')) {
    pauseYtVideo();
    showPlayerPage.classList.add('hidden');
  }

  if (selectedCategory === 'All') {
    if (dedicatedCategoryView) dedicatedCategoryView.classList.add('hidden');
    if (homeView) {
      homeView.classList.remove('hidden');
      window.scrollTo(0, 0);
    }
  } else {
    if (homeView) homeView.classList.add('hidden');
    if (dedicatedCategoryView) {
      dedicatedCategoryView.classList.remove('hidden');
      renderDedicatedCategoryGrid(selectedCategory);
      window.scrollTo(0, 0);
    }
  }

  if (window.showToast) {
    window.showToast(selectedCategory === 'All' ? 'Browsing Show Verse Homepage' : `Switched to ${selectedCategory} Category`);
  }
}

// Render the dedicated category full-page grid
function renderDedicatedCategoryGrid(category) {
  const titleEl = document.getElementById('categoryHeaderTitle');
  const subtitleEl = document.getElementById('categoryHeaderSubtitle');
  const iconEl = document.getElementById('categoryHeaderIcon');
  const countBadgeEl = document.getElementById('categorySeriesCountBadge');
  const gridContainer = document.getElementById('categoryShowsGrid');

  if (!gridContainer) return;

  const shows = groupedShows.filter(s => s.category === category);

  const meta = {
    'Kdrama': {
      title: 'Korean Dramas & Series',
      desc: 'Romance, thriller, and action K-dramas with official subtitles and studio dubs.',
      icon: 'heart',
      color: 'text-rose-400',
      border: 'border-rose-500/40'
    },
    'Anime': {
      title: 'Anime Universe',
      desc: 'Top-tier seasonal animation, shonen, and fantasy series in Dolby Atmos.',
      icon: 'zap',
      color: 'text-brand-cyan',
      border: 'border-brand-cyan/40'
    },
    'Chinese Drama': {
      title: 'Chinese Historical & Modern Dramas',
      desc: 'Wuxia, xianxia, and contemporary romantic drama series streaming in high bitrate.',
      icon: 'flame',
      color: 'text-amber-400',
      border: 'border-amber-500/40'
    },
    'Movie': {
      title: 'Feature Cinema & Movies',
      desc: 'Full-length cinematic blockbuster movies, 4K masters, and high-fidelity sound.',
      icon: 'film',
      color: 'text-purple-400',
      border: 'border-purple-500/40'
    }
  }[category] || {
    title: `${category} Series`,
    desc: 'Browse streaming series on Show Verse.',
    icon: 'compass',
    color: 'text-brand-cyan',
    border: 'border-brand-cyan/40'
  };

  if (titleEl) titleEl.innerText = meta.title;
  if (subtitleEl) subtitleEl.innerText = meta.desc;
  if (iconEl) {
    iconEl.setAttribute('class', `w-12 h-12 rounded-2xl bg-white/5 border ${meta.border} ${meta.color} flex items-center justify-center shadow-lg`);
    iconEl.innerHTML = `<i data-lucide="${meta.icon}" class="w-6 h-6"></i>`;
  }
  if (countBadgeEl) {
    countBadgeEl.innerText = `${shows.length} ${shows.length === 1 ? 'Series' : 'Series'} Available`;
  }

  if (shows.length === 0) {
    gridContainer.innerHTML = `
      <div class="col-span-full py-16 text-center glass-card rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3">
        <i data-lucide="${meta.icon}" class="w-12 h-12 text-slate-600"></i>
        <p class="font-bold text-base text-slate-300">No series available in ${category} yet</p>
        <p class="text-xs text-slate-400 max-w-md">Open Creator Studio from the profile menu to upload and publish series in this category.</p>
        <button onclick="filterCategoryView('All')" class="mt-2 px-5 py-2.5 rounded-xl bg-brand-cyan text-black font-bold text-xs shadow-neon-cyan cursor-pointer">
          Back to All Categories
        </button>
      </div>
    `;
    triggerSafeIcons(gridContainer);
    return;
  }

  gridContainer.innerHTML = shows.map((show) => {
    const safeTitle = (show.title || 'Untitled').replace(/'/g, "\\'");
    const epCount = show.episodes.length;
    const epLabel = epCount === 1 ? '1 Episode' : `${epCount} Episodes`;
    const isSaved = typeof window.isWatchLater === 'function' && window.isWatchLater(show.title);
    return `
      <div class="glass-card rounded-2xl overflow-hidden group cursor-pointer border border-white/5 hover:border-brand-cyan/40 transition-all duration-300 hover:scale-[1.02]" onclick="openShowPlayerPage('${safeTitle}')">
        <div class="relative aspect-[2/3] overflow-hidden bg-slate-950">
          <img src="${show.image}" alt="${show.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>
          
          <div class="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
            <button 
              type="button"
              onclick="toggleWatchLaterFromCard('${safeTitle}', event)"
              class="w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-md ${isSaved ? 'bg-brand-cyan text-black shadow-neon-cyan ring-1 ring-brand-cyan/60' : 'bg-black/60 hover:bg-black/90 text-slate-300 hover:text-brand-cyan border border-white/20'}"
              title="${isSaved ? 'Remove from Watch Later' : 'Add to Watch Later'}"
            >
              <i data-lucide="${isSaved ? 'bookmark-check' : 'bookmark'}" class="w-3.5 h-3.5 ${isSaved ? 'text-black fill-black' : 'text-brand-cyan'}"></i>
            </button>
            <div class="px-2 py-0.5 rounded-full bg-brand-cyan/90 text-black text-[10px] font-black uppercase shadow-neon-cyan">
              ★ ${show.rating}
            </div>
          </div>
          <div class="absolute bottom-2.5 left-2.5 right-2.5">
            <span class="text-[10px] text-amber-400 font-mono font-bold block mb-0.5">🔥 ${formatViews(show.views)} Views</span>
            <h3 class="text-xs sm:text-sm font-black text-white truncate group-hover:text-brand-cyan transition">
              ${show.title}
            </h3>
            <p class="text-[11px] text-slate-400 truncate mt-0.5">${show.category} • ${epLabel}</p>
          </div>
        </div>
      </div>
    `;
  }).join('');

  triggerSafeIcons(gridContainer);
}

// 7. YOUTUBE-STYLE SHOW DETAILS & PLAYER PAGE CONTROLLER
export function openShowPlayerPage(showKeyOrTitle, episodeIndex = 0, resumeTime = 0) {
  if (!showKeyOrTitle) return;
  const raw = String(showKeyOrTitle).trim().toLowerCase();
  const rawNorm = raw.replace(/[-_]/g, ' ');
  const cleanKey = cleanSeriesTitle(showKeyOrTitle).trim().toLowerCase();
  const cleanKeyNorm = cleanKey.replace(/[-_]/g, ' ');

  const findMatchingShow = (list) => (list || []).find(s => {
    const sKey = (s.showKey || '').toLowerCase();
    const sTitle = (s.title || '').toLowerCase();
    const sKeyNorm = sKey.replace(/[-_]/g, ' ');
    const sTitleNorm = sTitle.replace(/[-_]/g, ' ');
    return sKey === raw ||
           sTitle === raw ||
           sKeyNorm === rawNorm ||
           sTitleNorm === rawNorm ||
           sKey === cleanKey ||
           sTitle === cleanKey ||
           sKeyNorm === cleanKeyNorm ||
           sTitleNorm === cleanKeyNorm ||
           sTitle.includes(rawNorm) ||
           rawNorm.includes(sTitle);
  });

  let show = findMatchingShow(groupedShows);

  if (!show) {
    groupedShows = groupEpisodesIntoShows(firestoreEpisodes);
    show = findMatchingShow(groupedShows);
  }

  if (!show) {
    console.warn(`[Show Verse] Show "${showKeyOrTitle}" not found in grouped database.`);
    if (window.showToast) window.showToast(`Series "${showKeyOrTitle}" is being loaded...`);
    return;
  }

  currentSelectedShow = show;
  window.currentSelectedShow = show;
  currentSelectedEpisodeIndex = Math.max(0, Math.min(show.episodes.length - 1, Number(episodeIndex) || 0));
  cancelUpNext();
  if (window.updateAutoplayUI) window.updateAutoplayUI();

  const homeView = document.getElementById('homeView');
  const dedicatedCategoryView = document.getElementById('dedicatedCategoryView');
  const showPlayerPage = document.getElementById('showPlayerPage');

  if (dedicatedCategoryView && !dedicatedCategoryView.classList.contains('hidden')) {
    previousViewBeforePlayer = currentCategoryFilter || 'category';
  } else {
    previousViewBeforePlayer = 'home';
  }

  incrementShowViews(show.showKey);

  if (homeView) homeView.classList.add('hidden');
  if (dedicatedCategoryView) dedicatedCategoryView.classList.add('hidden');
  
  // Hide top category bar when in player (only show in explore/browse view)
  const topCategoryBar = document.getElementById('topCategoryBar');
  if (topCategoryBar) topCategoryBar.classList.add('hidden');

  if (showPlayerPage) {
    showPlayerPage.classList.remove('hidden');
    window.scrollTo(0, 0);
    if (window.initMainPlayerControlsAutoHide) window.initMainPlayerControlsAutoHide();
    if (window.showMainPlayerControls) window.showMainPlayerControls();
    if (window.initStageAspectAutoHide) window.initStageAspectAutoHide();
  }

  const cleanTitle = cleanSeriesTitle(show.title);
  const breadcrumbCat = document.getElementById('ytBreadcrumbCategory');
  const breadcrumbTitle = document.getElementById('ytBreadcrumbTitle');
  const showTitleEl = document.getElementById('ytShowTitle');
  const showDescEl = document.getElementById('ytShowDesc');
  const showViewsEl = document.getElementById('ytShowViews');
  const metaCategoryEl = document.getElementById('ytMetaCategory');
  const metaSeasonEl = document.getElementById('ytMetaSeason');
  const metaRatingEl = document.getElementById('ytMetaRating');
  const episodeCountBadge = document.getElementById('ytEpisodeCountBadge');

  if (breadcrumbCat) breadcrumbCat.innerText = show.category;
  if (breadcrumbTitle) breadcrumbTitle.innerText = cleanTitle;
  if (showTitleEl) showTitleEl.innerText = cleanTitle;
  if (showDescEl) showDescEl.innerText = show.description;
  if (showViewsEl) showViewsEl.innerHTML = `<i data-lucide="flame" class="w-4 h-4 text-amber-400"></i> ${formatViews(show.views)} Views`;
  if (metaCategoryEl) metaCategoryEl.innerText = show.category;
  if (metaSeasonEl) metaSeasonEl.innerText = `Season ${show.season || '1'}`;
  if (metaRatingEl) metaRatingEl.innerText = `★ ${show.rating}`;

  const distinctSeasons = getShowSeasons(show);
  const activeEp = show.episodes[currentSelectedEpisodeIndex];
  currentSelectedSeason = activeEp ? (parseInt(activeEp.season, 10) || distinctSeasons[0] || 1) : (distinctSeasons[0] || 1);
  updateSeasonUI();

  if (episodeCountBadge) {
    const total = show.episodes.length;
    episodeCountBadge.innerText = `${total} ${total === 1 ? 'Episode' : 'Episodes'}`;
  }

  // Pre-fetch video durations for episodes in this series
  prefetchShowDurations(show);

  // Update Watch Later state and details card button for this series
  if (typeof window.updateWatchLaterButtonUI === 'function') {
    window.updateWatchLaterButtonUI(show);
  }
  const watchLaterNotice = document.getElementById('ytWatchLaterNotice');
  if (watchLaterNotice) {
    if (typeof window.isWatchLater === 'function' && window.isWatchLater(show.showKey || show.title)) {
      watchLaterNotice.classList.remove('hidden');
    } else {
      watchLaterNotice.classList.add('hidden');
    }
  }

  loadActiveYtEpisode(currentSelectedEpisodeIndex, resumeTime);
  renderYtEpisodesRow();
  renderYtSuggestedRow();

  // Initialize Episode Discussion and Comments
  if (typeof window.initEpisodeComments === 'function') {
    window.initEpisodeComments(show, currentSelectedEpisodeIndex);
  }

  // Sync shareable series URL in browser address bar without reload
  try {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('series', cleanTitle);
    const activeEp = show.episodes[currentSelectedEpisodeIndex];
    const activeEpNum = activeEp ? (activeEp.episodeNumber || (currentSelectedEpisodeIndex + 1)) : (currentSelectedEpisodeIndex + 1);
    if (show.category !== 'Movie' && activeEpNum > 1) {
      currentUrl.searchParams.set('ep', String(activeEpNum));
    } else {
      currentUrl.searchParams.delete('ep');
    }
    window.history.replaceState(null, '', currentUrl.toString());
  } catch (_) {}

  triggerSafeIcons();
}

export function loadActiveYtEpisode(index, resumeTime = 0) {
  console.log(`[ShowVerse] loadActiveYtEpisode called for episode index: ${index}, resumeTime: ${resumeTime}`);
  if (!currentSelectedShow || !currentSelectedShow.episodes || !currentSelectedShow.episodes[index]) {
    console.warn(`[ShowVerse] loadActiveYtEpisode: show or episode index ${index} invalid.`, currentSelectedShow);
    return;
  }

  const episode = currentSelectedShow.episodes[index];
  console.log(`[ShowVerse] Loading Episode Data:`, {
    showTitle: currentSelectedShow.title,
    episodeNumber: episode.episodeNumber,
    episodeTitle: episode.episodeTitle,
    videoUrl: episode.videoUrl
  });

  const video = document.getElementById('main-video') || document.querySelector('#ytPlayerStage video');
  const curEpTitle = document.getElementById('ytCurrentEpisodeTitle');
  const badgeQuality = document.getElementById('ytBadgeQuality');

  if (curEpTitle) {
    if (currentSelectedShow.category === 'Movie' && currentSelectedShow.episodes.length === 1) {
      curEpTitle.innerText = 'Feature Film • 4K Master';
    } else {
      const sNum = episode.season || 1;
      curEpTitle.innerText = `Season ${sNum} • Episode ${episode.episodeNumber}${episode.episodeTitle && !episode.episodeTitle.startsWith('Episode') ? ' - ' + episode.episodeTitle : ''}`;
    }
  }

  // Update on-stage player title overlay for Fullscreen & Landscape mode
  const stageShowTitle = document.getElementById('plyrStageShowTitle');
  const stageEpTitle = document.getElementById('plyrStageEpTitle');
  if (stageShowTitle) {
    stageShowTitle.textContent = cleanSeriesTitle(currentSelectedShow.title);
  }
  if (stageEpTitle) {
    if (currentSelectedShow.category === 'Movie' && currentSelectedShow.episodes.length === 1) {
      stageEpTitle.textContent = 'Feature Film • 4K Master';
    } else {
      const sNum = episode.season || 1;
      stageEpTitle.textContent = `S${sNum} • Ep ${episode.episodeNumber}${episode.episodeTitle && !episode.episodeTitle.startsWith('Episode') ? ': ' + episode.episodeTitle : ''}`;
    }
  }

  if (badgeQuality) {
    badgeQuality.innerText = `${(episode.quality || '1080p').toUpperCase()} MASTER`;
  }

  if (typeof window.recordWatchHistory === 'function') {
    window.recordWatchHistory({
      id: episode.id,
      title: `${cleanSeriesTitle(currentSelectedShow.title)} - Ep ${episode.episodeNumber}`,
      videoUrl: episode.videoUrl,
      image: episode.image || currentSelectedShow.image,
      category: currentSelectedShow.category,
      currentTime: Number(resumeTime) || 0
    });
  }

  if (video) {
    const targetUrl = typeof episode.videoUrl === 'string' ? episode.videoUrl.trim() : '';
    console.log(`[ShowVerse] Target video URL reaching player: "${targetUrl}"`);

    if (!targetUrl) {
      console.warn("[ShowVerse] Episode video URL is empty!");
      if (typeof window.showPlayerError === 'function') {
        window.showPlayerError(video, "Error loading video", "No video stream URL found for this episode.");
      }
      if (window.showToast) window.showToast("No video stream URL found for this episode.");
      return;
    }

    let seekTo = Number(resumeTime) || 0;
    if (seekTo <= 0 && typeof window.getContinueWatchingList === 'function') {
      const epTitle = `${cleanSeriesTitle(currentSelectedShow.title)} - Ep ${episode.episodeNumber}`;
      const saved = window.getContinueWatchingList().find(x => 
        x.id === episode.id || 
        x.title === epTitle || 
        (currentSelectedShow.category === 'Movie' && x.title && x.title.includes(cleanSeriesTitle(currentSelectedShow.title)))
      );
      if (saved && saved.currentTime > 2) {
        seekTo = saved.currentTime;
      }
    }

    if (video) {
      const onMeta = () => {
        if (video.duration && isFinite(video.duration) && video.duration > 0) {
          saveDurationToCache(targetUrl, video.duration);
          updateDurationInDOM(targetUrl, video.duration);
        }
      };
      video.addEventListener('loadedmetadata', onMeta, { once: true });
    }

    if (typeof window.loadVideoWithPlyr === 'function') {
      video.removeAttribute('poster');
      video.poster = '';
      window.loadVideoWithPlyr(video, targetUrl, seekTo, {
        loadingText: `Loading Episode ${episode.episodeNumber}...`,
        title: episode.episodeTitle || `Episode ${episode.episodeNumber}`,
        onEnded: () => {
          console.log("[ShowVerse] Episode playback ended in series sequence.");
          const autoplayActive = typeof window.isAutoplayEnabled === 'function' ? window.isAutoplayEnabled() : true;

          if (!autoplayActive) {
            console.log("[ShowVerse] Autoplay is disabled by user. Next episode will not load automatically.");
            if (window.showToast) window.showToast("Autoplay is OFF. Choose next episode to continue.");
            return;
          }

          if (currentSelectedShow && Array.isArray(currentSelectedShow.episodes) && currentSelectedEpisodeIndex < currentSelectedShow.episodes.length - 1) {
            const nextIdx = currentSelectedEpisodeIndex + 1;
            const nextEp = currentSelectedShow.episodes[nextIdx];
            console.log(`[ShowVerse] Autoplay active. Launching Up Next countdown for Episode ${nextEp ? nextEp.episodeNumber : nextIdx + 1}...`);
            triggerUpNextCountdown(nextIdx, 5);
          } else {
            console.log("[ShowVerse] Reached end of series sequence.");
            if (window.showToast) window.showToast("You've completed all episodes in this series!");
          }
        }
      });
    } else {
      // Direct fallback
      console.log(`[ShowVerse] Fallback: updating video.src, video.load(), video.play()`);
      video.removeAttribute('poster');
      video.poster = '';
      video.src = targetUrl;
      video.load();
      const p = video.play();
      if (p !== undefined) {
        p.catch(err => console.log("[ShowVerse] Autoplay caught:", err));
      }
    }
  } else {
    console.error("[ShowVerse] Video element could not be found in DOM!");
  }
}

export function renderYtEpisodesRow() {
  const container = document.getElementById('ytEpisodesRow');
  const countBadge = document.getElementById('ytEpisodeCountBadge');
  if (!container || !currentSelectedShow) return;

  const allEpisodes = currentSelectedShow.episodes || [];
  if (allEpisodes.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-xs text-slate-400 w-full glass-card rounded-2xl border border-white/10">
        No episodes published for this show yet.
      </div>
    `;
    if (countBadge) countBadge.innerText = '0 Episodes';
    return;
  }

  if (currentSelectedShow.category === 'Movie' && allEpisodes.length === 1) {
    container.innerHTML = `
      <button type="button" onclick="switchYtEpisode(0)" class="px-5 py-3 rounded-2xl border-2 border-brand-cyan shadow-neon-cyan bg-brand-cyan/20 text-brand-cyan font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition">
        <i data-lucide="film" class="w-4 h-4"></i>
        <span>Full Movie / Feature Film</span>
      </button>
    `;
    if (countBadge) countBadge.innerText = 'Feature Film';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  let displayedEpisodes = allEpisodes;
  if (currentSelectedSeason !== 'all') {
    displayedEpisodes = allEpisodes.filter(ep => (parseInt(ep.season, 10) || 1) === currentSelectedSeason);
  }

  if (countBadge) {
    const count = displayedEpisodes.length;
    countBadge.innerText = currentSelectedSeason === 'all' 
      ? `${count} ${count === 1 ? 'Episode' : 'Episodes'} (All Seasons)` 
      : `${count} ${count === 1 ? 'Episode' : 'Episodes'} (Season ${currentSelectedSeason})`;
  }

  if (displayedEpisodes.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-xs text-slate-400 w-full glass-card rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-2">
        <i data-lucide="layers" class="w-6 h-6 text-slate-500"></i>
        <p class="font-bold text-slate-300">No Episodes Found in Season ${currentSelectedSeason}</p>
        <p class="text-[11px] text-slate-500">Switch to another season or upload Season ${currentSelectedSeason} in Creator Studio.</p>
        <button type="button" onclick="changePlayerSeason('all')" class="mt-2 px-3 py-1 bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan rounded-lg text-xs font-bold hover:bg-brand-cyan hover:text-black transition cursor-pointer">
          View All Episodes
        </button>
      </div>
    `;
    triggerSafeIcons(container);
    return;
  }

  container.innerHTML = displayedEpisodes.map((ep) => {
    const overallIdx = allEpisodes.findIndex(e => e.id === ep.id);
    const targetIdx = overallIdx !== -1 ? overallIdx : 0;
    const isActive = targetIdx === currentSelectedEpisodeIndex;
    const sNum = ep.season || 1;

    const durVal = getCachedOrEstimatedDuration(ep);
    const formattedDur = durVal ? formatVideoDuration(durVal) : '--:--';
    const isFetching = !videoDurationCache.has(ep.videoUrl);

    if (isFetching && ep.videoUrl) {
      fetchEpisodeDuration(ep, currentSelectedShow.category);
    }

    return `
      <button 
        type="button"
        onclick="switchYtEpisode(${targetIdx})" 
        id="ep-btn-${targetIdx}" 
        title="Season ${sNum} Episode ${ep.episodeNumber}: ${ep.episodeTitle || ''} (${formattedDur})" 
        aria-label="Play Season ${sNum} Episode ${ep.episodeNumber}"
        class="episode-selector-btn flex-shrink-0 min-w-[4.5rem] sm:min-w-[5.25rem] h-16 sm:h-20 px-2.5 py-1.5 rounded-xl sm:rounded-2xl flex flex-col items-center justify-between transition-all duration-200 cursor-pointer select-none relative ${
          isActive 
            ? 'is-active border-2 border-brand-cyan shadow-neon-cyan bg-brand-cyan/20 text-brand-cyan font-black scale-105 ring-2 ring-brand-cyan/40' 
            : 'bg-white/5 hover:bg-white/15 border border-white/10 hover:border-brand-cyan/40 text-slate-200 hover:text-white font-bold'
        }">
        <div class="flex items-center gap-1 leading-none mt-0.5">
          <span class="text-[10px] font-mono font-extrabold uppercase opacity-80">S${sNum}</span>
          <span class="text-[10px] opacity-40">•</span>
          <span class="text-xs sm:text-sm font-black">E${ep.episodeNumber}</span>
        </div>
        <div class="neon-duration-badge flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold leading-none mb-0.5 ${isFetching ? 'is-loading' : ''}">
          <i data-lucide="clock" class="w-2.5 h-2.5 text-brand-cyan"></i>
          <span class="ep-duration-text" data-video-url="${ep.videoUrl}">${formattedDur}</span>
        </div>
      </button>
    `;
  }).join('');

  triggerSafeIcons(container);
}

export function renderYtSuggestedRow() {
  const container = document.getElementById('ytSuggestedRow');
  if (!container || !currentSelectedShow) return;

  const others = groupedShows.filter(s => s.showKey !== currentSelectedShow.showKey);
  const suggested = others.slice(0, 8);

  if (suggested.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-xs text-slate-400 w-full glass-card rounded-2xl border border-white/10">
        More recommendations will appear as new series are uploaded.
      </div>
    `;
    return;
  }

  container.innerHTML = suggested.map((show) => {
    const safeTitle = (show.title || 'Untitled').replace(/'/g, "\\'");
    const epCount = show.episodes.length;
    const epLabel = epCount === 1 ? '1 Ep' : `${epCount} Eps`;
    const isSaved = typeof window.isWatchLater === 'function' && window.isWatchLater(show.title);
    return `
      <div onclick="openShowPlayerPage('${safeTitle}')" class="flex-shrink-0 w-44 sm:w-48 glass-card rounded-2xl overflow-hidden cursor-pointer border border-white/5 hover:border-brand-purple/50 transition-all duration-300 group">
        <div class="relative aspect-[2/3] overflow-hidden bg-slate-950">
          <img src="${show.image}" alt="${show.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>
          
          <div class="absolute top-2 right-2 flex items-center gap-1.5 z-10">
            <button 
              type="button"
              onclick="toggleWatchLaterFromCard('${safeTitle}', event)"
              class="w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-md ${isSaved ? 'bg-brand-cyan text-black shadow-neon-cyan' : 'bg-black/60 hover:bg-black/90 text-slate-300 hover:text-brand-cyan border border-white/20'}"
              title="${isSaved ? 'Remove from Watch Later' : 'Add to Watch Later'}"
            >
              <i data-lucide="${isSaved ? 'bookmark-check' : 'bookmark'}" class="w-3 h-3 ${isSaved ? 'text-black fill-black' : 'text-brand-cyan'}"></i>
            </button>
            <div class="px-1.5 py-0.5 rounded-full bg-brand-purple/90 text-white text-[9px] font-black uppercase">
              ★ ${show.rating}
            </div>
          </div>
          <div class="absolute bottom-2.5 left-2.5 right-2.5">
            <span class="text-[9px] text-amber-400 font-mono font-bold block mb-0.5">🔥 ${formatViews(show.views)}</span>
            <h4 class="text-xs font-black text-white truncate group-hover:text-purple-300 transition">${show.title}</h4>
            <p class="text-[10px] text-slate-400 truncate">${show.category} • ${epLabel}</p>
          </div>
        </div>
      </div>
    `;
  }).join('');

  triggerSafeIcons(container);
}

// Global refresher for all show card bookmarks across views
if (typeof window !== 'undefined') {
  window.refreshAllShowCardsWatchLater = function() {
    renderHomeRows();
    renderTrendingRows();
    if (currentCategoryFilter && currentCategoryFilter !== 'All') {
      renderDedicatedCategoryGrid(currentCategoryFilter);
    }
    if (currentSelectedShow) {
      renderYtSuggestedRow();
    }
  };
}

// ========================================================
// AUTOPLAY UP NEXT COUNTDOWN CONTROLLER
// ========================================================
let upNextInterval = null;
let pendingNextEpisodeIndex = null;

export function triggerUpNextCountdown(nextIndex, delaySeconds = 5) {
  cancelUpNext();

  if (!currentSelectedShow || !currentSelectedShow.episodes || !currentSelectedShow.episodes[nextIndex]) {
    return;
  }

  pendingNextEpisodeIndex = nextIndex;
  const nextEp = currentSelectedShow.episodes[nextIndex];
  const overlay = document.getElementById('ytUpNextOverlay');
  const countSec = document.getElementById('ytCountdownSeconds');
  const countBar = document.getElementById('ytCountdownBar');
  const upNextImg = document.getElementById('ytUpNextImage');
  const upNextBadge = document.getElementById('ytUpNextBadge');
  const upNextTitle = document.getElementById('ytUpNextTitle');
  const upNextShow = document.getElementById('ytUpNextShow');

  if (overlay) {
    if (countSec) countSec.textContent = delaySeconds;
    if (countBar) countBar.style.width = '100%';
    if (upNextBadge) upNextBadge.textContent = `Episode ${nextEp.episodeNumber || (nextIndex + 1)}`;
    if (upNextTitle) upNextTitle.textContent = nextEp.episodeTitle || `Episode ${nextEp.episodeNumber || (nextIndex + 1)}`;
    if (upNextShow) upNextShow.textContent = currentSelectedShow.title || 'Series';
    if (upNextImg) upNextImg.src = nextEp.thumbnailUrl || currentSelectedShow.thumbnailUrl || '';

    overlay.classList.remove('is-hidden');
    overlay.style.display = 'flex';
    triggerSafeIcons(overlay);
  }

  let remaining = delaySeconds;
  const total = delaySeconds;

  upNextInterval = setInterval(() => {
    remaining -= 0.1;
    if (countSec) countSec.textContent = Math.max(0, Math.ceil(remaining));
    if (countBar) {
      const pct = Math.max(0, (remaining / total) * 100);
      countBar.style.width = `${pct}%`;
    }
    if (remaining <= 0) {
      clearInterval(upNextInterval);
      upNextInterval = null;
      playNextEpisodeImmediately();
    }
  }, 100);
}

export function playNextEpisodeImmediately() {
  const targetIdx = pendingNextEpisodeIndex !== null ? pendingNextEpisodeIndex : (currentSelectedEpisodeIndex + 1);
  cancelUpNext();
  if (currentSelectedShow && currentSelectedShow.episodes && currentSelectedShow.episodes[targetIdx]) {
    switchYtEpisode(targetIdx);
  }
}

export function cancelUpNext() {
  if (upNextInterval) {
    clearInterval(upNextInterval);
    upNextInterval = null;
  }
  pendingNextEpisodeIndex = null;
  const overlay = document.getElementById('ytUpNextOverlay');
  if (overlay) {
    overlay.classList.add('is-hidden');
    overlay.style.display = 'none';
  }
}

export function switchYtEpisode(index) {
  cancelUpNext();
  console.log(`[ShowVerse] switchYtEpisode called with index: ${index}`);
  if (!currentSelectedShow || !currentSelectedShow.episodes || !currentSelectedShow.episodes[index]) {
    console.warn(`[ShowVerse] switchYtEpisode: Invalid episode index ${index}`, currentSelectedShow);
    return;
  }

  currentSelectedEpisodeIndex = index;
  window.currentSelectedEpisodeIndex = index;
  const ep = currentSelectedShow.episodes[index];
  if (ep) {
    const epSeason = parseInt(ep.season, 10) || 1;
    if (currentSelectedSeason !== 'all' && currentSelectedSeason !== epSeason) {
      currentSelectedSeason = epSeason;
    }
    updateSeasonUI();
  }
  console.log(`[ShowVerse] switchYtEpisode switching to Episode ${ep.episodeNumber}:`, {
    title: ep.episodeTitle,
    videoUrl: ep.videoUrl
  });

  if (typeof window.showVideoSpinner === 'function') {
    window.showVideoSpinner(null, `Loading Episode ${ep.episodeNumber}...`);
  }

  loadActiveYtEpisode(index);
  renderYtEpisodesRow();

  // Update active episode in Episode Discussion
  if (typeof window.updateActiveEpisodeInComments === 'function') {
    window.updateActiveEpisodeInComments(ep.episodeNumber, ep.season);
  }

  const stage = document.getElementById('ytPlayerStage');
  if (stage) {
    stage.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  }
}

export function handlePlayerBack(event) {
  if (event) {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
  }

  // 1. If currently in Fullscreen, exit fullscreen to return to the embedded player view without destroying the player!
  const isFullscreen = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    (window.activePlyr && window.activePlyr.fullscreen && window.activePlyr.fullscreen.active)
  );

  if (isFullscreen) {
    if (window.activePlyr && window.activePlyr.fullscreen && window.activePlyr.fullscreen.active) {
      window.activePlyr.fullscreen.exit();
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }

    const stage = document.getElementById('ytPlayerStage');
    if (stage) {
      stage.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
    if (window.showToast) window.showToast("Back in player view");
    return;
  }

  // 2. If the user is scrolled down in showPlayerPage (viewing episodes, comments, details)
  // return smoothly to the video player stage so the player is front and center ("player me aa jaye, poora cut na ho")
  const stage = document.getElementById('ytPlayerStage');
  const scrollPos = window.pageYOffset || document.documentElement.scrollTop || 0;
  if (stage) {
    const stageRect = stage.getBoundingClientRect();
    if (stageRect.top < -100 || scrollPos > 220) {
      stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (window.showToast) window.showToast("Returned to Player");
      return;
    }
  }

  // 3. If in Landscape mobile view where the player filled the screen:
  // Scroll down to the episodes section so they can choose other episodes without cutting off the player
  const isLandscape = window.matchMedia && window.matchMedia('(orientation: landscape) and (max-height: 620px)').matches;
  if (isLandscape) {
    const epSection = document.getElementById('ytEpisodesSection') || document.getElementById('showDetailsSection');
    if (epSection && (!stage || stage.getBoundingClientRect().top >= -50)) {
      epSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (window.showToast) window.showToast("Episodes & Details");
      return;
    }
  }

  // 4. If already at the top of the player and not in fullscreen:
  // Cleanly navigate back to browse/home
  closeShowPlayerPage();
}

export function closeShowPlayerPage() {
  cancelUpNext();
  if (typeof window.destroyCurrentPlayer === 'function') {
    window.destroyCurrentPlayer();
  }
  const showPlayerPage = document.getElementById('showPlayerPage');
  const homeView = document.getElementById('homeView');
  const dedicatedCategoryView = document.getElementById('dedicatedCategoryView');

  if (document.fullscreenElement || document.webkitFullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }

  if (showPlayerPage) showPlayerPage.classList.add('hidden');
  const topCategoryBar = document.getElementById('topCategoryBar');
  if (topCategoryBar) topCategoryBar.classList.remove('hidden');

  // Clean URL when closing player
  try {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('series');
    currentUrl.searchParams.delete('show');
    currentUrl.searchParams.delete('ep');
    window.history.replaceState(null, '', currentUrl.toString());
  } catch (_) {}

  if (previousViewBeforePlayer === 'home' || previousViewBeforePlayer === 'All') {
    if (homeView) homeView.classList.remove('hidden');
  } else {
    if (dedicatedCategoryView) dedicatedCategoryView.classList.remove('hidden');
    else if (homeView) homeView.classList.remove('hidden');
  }
}

// ========================================================
// SHAREABLE LINK GENERATOR FOR CURRENT SERIES
// ========================================================
export function shareCurrentSeries() {
  if (!currentSelectedShow) {
    if (window.showToast) window.showToast("No active series to share.");
    return;
  }

  const seriesTitle = cleanSeriesTitle(currentSelectedShow.title);
  const epIndex = currentSelectedEpisodeIndex || 0;
  const ep = (currentSelectedShow.episodes && currentSelectedShow.episodes[epIndex]) 
    ? currentSelectedShow.episodes[epIndex] 
    : null;
  const epNum = ep ? (ep.episodeNumber || (epIndex + 1)) : (epIndex + 1);

  // Generate clean shareable link pointing to current host with series & ep query params
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('series', seriesTitle);
  if (currentSelectedShow.category !== 'Movie' && epNum > 1) {
    url.searchParams.set('ep', String(epNum));
  }
  const shareableUrl = url.toString();

  const shareBtn = document.getElementById('ytShareBtn');
  const shareIcon = document.getElementById('ytShareIcon');
  const shareText = document.getElementById('ytShareText');

  const showCopiedFeedback = () => {
    if (shareBtn) {
      shareBtn.classList.add('border-brand-cyan', 'text-brand-cyan', 'bg-brand-cyan/20');
    }
    if (shareText) {
      shareText.innerText = 'Copied!';
    }
    if (shareIcon) {
      shareIcon.setAttribute('data-lucide', 'check');
    }
    if (window.lucide) window.lucide.createIcons();
    if (window.showToast) {
      window.showToast(`Shareable link copied for "${seriesTitle}"!`);
    }

    setTimeout(() => {
      if (shareBtn) {
        shareBtn.classList.remove('border-brand-cyan', 'text-brand-cyan', 'bg-brand-cyan/20');
      }
      if (shareText) {
        shareText.innerText = 'Share';
      }
      if (shareIcon) {
        shareIcon.setAttribute('data-lucide', 'share-2');
      }
      triggerSafeIcons(shareBtn);
    }, 2500);
  };

  const copyToClipboard = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareableUrl).then(showCopiedFeedback).catch(() => {
        fallbackCopyText(shareableUrl, showCopiedFeedback);
      });
    } else {
      fallbackCopyText(shareableUrl, showCopiedFeedback);
    }
  };

  // If Web Share API is available (e.g. mobile Safari / Chrome Android), offer native share sheet
  if (navigator.share) {
    navigator.share({
      title: `${seriesTitle} - ShowVerse`,
      text: `Watch ${seriesTitle} on ShowVerse!`,
      url: shareableUrl
    }).then(() => {
      showCopiedFeedback();
    }).catch((err) => {
      // If user dismissed share dialog without sharing, do nothing
      if (err && err.name !== 'AbortError') {
        copyToClipboard();
      }
    });
  } else {
    copyToClipboard();
  }
}

function fallbackCopyText(text, onSuccess) {
  try {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    tempInput.style.position = 'fixed';
    tempInput.style.opacity = '0';
    tempInput.style.left = '-9999px';
    document.body.appendChild(tempInput);
    tempInput.focus();
    tempInput.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(tempInput);
    if (successful && onSuccess) {
      onSuccess();
    } else if (window.showToast) {
      window.showToast(`Link: ${text}`);
    }
  } catch (_) {
    if (window.showToast) window.showToast("Could not copy link to clipboard.");
  }
}

export function toggleYtPlay() {
  if (window.activePlyr) {
    window.activePlyr.togglePlay();
  } else {
    const video = document.getElementById('main-video') || document.querySelector('video');
    if (video) video.paused ? video.play() : video.pause();
  }
}

export function pauseYtVideo() {
  if (window.activePlyr) {
    window.activePlyr.pause();
  } else {
    const video = document.getElementById('main-video') || document.querySelector('video');
    if (video && !video.paused) video.pause();
  }
}

export function skipMainVideo(seconds, e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
  if (window.activePlyr) {
    const secNum = Number(seconds) || 10;
    if (secNum > 0) window.activePlyr.forward(secNum);
    else window.activePlyr.rewind(Math.abs(secNum));
  }
}

export const skipYtTime = skipMainVideo;

export function seekMainVideo(e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
}

export const seekYtVideo = seekMainVideo;

export function changeYtVolume(val) {
  if (window.activePlyr) {
    window.activePlyr.volume = Number(val);
  }
}

export function toggleYtMute() {
  if (window.activePlyr) {
    window.activePlyr.muted = !window.activePlyr.muted;
  }
}

export function toggleYtAmbient() {
  if (typeof window.toggleAmbientLighting === 'function') {
    window.toggleAmbientLighting();
  }
}

export function toggleYtFullscreen() {
  if (window.activePlyr && window.activePlyr.fullscreen) {
    window.activePlyr.fullscreen.toggle();
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

export function toggleFullscreenPlayerModal() {
  if (currentSelectedShow && currentSelectedShow.episodes[currentSelectedEpisodeIndex]) {
    const ep = currentSelectedShow.episodes[currentSelectedEpisodeIndex];
    const video = document.getElementById('main-video') || document.getElementById('ytVideo');
    const curTime = video ? video.currentTime : 0;
    pauseYtVideo();
    if (typeof window.playMedia === 'function') {
      window.playMedia(
        `${currentSelectedShow.title} - Ep ${ep.episodeNumber}`,
        ep.videoUrl,
        curTime,
        { id: ep.id, image: ep.image || currentSelectedShow.image, category: currentSelectedShow.category }
      );
    }
  }
}

export function handleYtPlayerTap() {}
export function triggerYtSkipAnimation() {}

// Global Exports
export function scrollSlider(rowId, distance) {
  const row = document.getElementById(rowId);
  if (row) {
    row.scrollBy({ left: distance, behavior: 'smooth' });
  }
}

// Expose all functions to window for global and inline access
if (typeof window !== "undefined") {
  window.scrollSlider = scrollSlider;
  window.filterCategoryView = filterCategoryView;
  window.renderCategoryRows = renderCategoryRows;
  window.renderTrendingRows = renderTrendingRows;
  window.renderHeroFromFirestore = renderHeroFromFirestore;
  window.renderAllViews = renderAllViews;
  window.initShowverseEpisodesSync = initShowverseEpisodesSync;
  window.normalizeCategory = normalizeCategory;
  window.groupEpisodesIntoShows = groupEpisodesIntoShows;
  window.openShowPlayerPage = openShowPlayerPage;
  window.handlePlayerBack = handlePlayerBack;
  window.closeShowPlayerPage = closeShowPlayerPage;
  window.triggerUpNextCountdown = triggerUpNextCountdown;
  window.playNextEpisodeImmediately = playNextEpisodeImmediately;
  window.cancelUpNext = cancelUpNext;
  window.switchYtEpisode = switchYtEpisode;
  window.loadActiveYtEpisode = loadActiveYtEpisode;
  window.toggleYtPlay = toggleYtPlay;
  window.handleYtPlayerTap = handleYtPlayerTap;
  window.triggerYtSkipAnimation = triggerYtSkipAnimation;
  window.skipMainVideo = skipMainVideo;
  window.seekMainVideo = seekMainVideo;
  window.skipYtTime = skipMainVideo;
  window.seekYtVideo = seekMainVideo;
  window.changeYtVolume = changeYtVolume;
  window.toggleYtMute = toggleYtMute;
  window.toggleYtAmbient = toggleYtAmbient;
  window.toggleYtFullscreen = toggleYtFullscreen;
  window.toggleFullscreenPlayerModal = toggleFullscreenPlayerModal;
  window.changePlayerSeason = changePlayerSeason;
  window.togglePlayerSeasonMenu = togglePlayerSeasonMenu;
  window.closePlayerSeasonMenu = closePlayerSeasonMenu;
  window.openSeasonModal = openSeasonModal;
  window.closeSeasonModal = closeSeasonModal;
  window.handleSeasonModalBackdropClick = handleSeasonModalBackdropClick;
  window.selectSeasonFromModal = selectSeasonFromModal;
  window.renderSeasonModal = renderSeasonModal;
  window.modalSwitchSeason = modalSwitchSeason;
  window.selectEpisodeFromSeasonModal = selectEpisodeFromSeasonModal;
  window.formatVideoDuration = formatVideoDuration;
  window.fetchEpisodeDuration = fetchEpisodeDuration;
  window.prefetchShowDurations = prefetchShowDurations;
  window.updateDurationInDOM = updateDurationInDOM;
  window.videoDurationCache = videoDurationCache;
  window.getShowSeasons = getShowSeasons;
  window.updateSeasonUI = updateSeasonUI;
  window.shareCurrentSeries = shareCurrentSeries;
}

// Auto-initialize when DOM is ready
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener('DOMContentLoaded', () => {
      initShowverseEpisodesSync();
    });
  } else {
    initShowverseEpisodesSync();
  }
}
