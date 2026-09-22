// watchLater.js - User's Personal Watch Later Firestore Engine for Show Verse
import { db, auth } from "./firebase.js";
import { currentUser } from "./auth.js";
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  collection, 
  onSnapshot, 
  getDocs,
  serverTimestamp 
} from "firebase/firestore";

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Watch Later Notice: ', JSON.stringify(errInfo));
  return errInfo;
}

const STORAGE_KEY = 'showverse_watch_later_cache';

// In-memory list of Watch Later items
export let watchLaterList = [];
let unsubscribeWatchLater = null;
let isSyncing = false;

/**
 * Normalizes a showKey or title to a clean Firestore document ID
 */
export function getSafeDocId(key) {
  if (!key) return 'show_' + Date.now();
  const cleaned = String(key)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 100);
  return cleaned || 'show_' + Date.now();
}

/**
 * Loads cached Watch Later items from localStorage
 */
export function loadLocalCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Saves Watch Later items to localStorage
 */
export function saveLocalCache(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items || []));
  } catch (_) {}
}

/**
 * Checks if a given showKey is in the Watch Later list
 */
export function isWatchLater(showKey) {
  if (!showKey) return false;
  const cleanKey = String(showKey).toLowerCase().trim();
  const cleanKeyNorm = cleanKey.replace(/[-_]/g, ' ');
  const safeId = getSafeDocId(cleanKey);

  return watchLaterList.some(item => {
    const iKey = String(item.showKey || '').toLowerCase().trim();
    const iTitle = String(item.title || '').toLowerCase().trim();
    const iId = String(item.id || '').toLowerCase().trim();
    return iKey === cleanKey ||
           iTitle === cleanKey ||
           iId === safeId ||
           iTitle.replace(/[-_]/g, ' ') === cleanKeyNorm ||
           iKey.replace(/[-_]/g, ' ') === cleanKeyNorm;
  });
}

/**
 * Returns current Watch Later list
 */
export function getWatchLaterList() {
  return [...watchLaterList];
}

/**
 * Updates the 'Watch Later' button in the Show Details Card
 */
export function updateWatchLaterButtonUI(show) {
  const targetShow = show || window.currentSelectedShow;
  const btn = document.getElementById('ytWatchLaterBtn');
  const icon = document.getElementById('ytWatchLaterIcon');
  const text = document.getElementById('ytWatchLaterText');

  if (!btn || !targetShow) return;

  const inList = isWatchLater(targetShow.title || targetShow.showKey);

  if (inList) {
    btn.className = 'group flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer select-none bg-brand-cyan/20 hover:bg-brand-cyan/25 border border-brand-cyan text-brand-cyan shadow-neon-cyan ring-1 ring-brand-cyan/40';
    btn.title = `In your Watch Later list. Click to remove "${targetShow.title}"`;
    btn.setAttribute('aria-pressed', 'true');

    if (icon) {
      icon.outerHTML = `<i data-lucide="bookmark-check" id="ytWatchLaterIcon" class="w-4 h-4 text-brand-cyan fill-brand-cyan/30 transition-transform group-hover:scale-110"></i>`;
    }
    if (text) {
      text.innerText = 'Saved to Watch Later';
    }
  } else {
    btn.className = 'group flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer select-none bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 hover:text-white hover:border-brand-cyan/40';
    btn.title = `Save "${targetShow.title}" to your personal Watch Later list in Firestore`;
    btn.setAttribute('aria-pressed', 'false');

    if (icon) {
      icon.outerHTML = `<i data-lucide="bookmark" id="ytWatchLaterIcon" class="w-4 h-4 text-brand-cyan transition-transform group-hover:scale-110"></i>`;
    }
    if (text) {
      text.innerText = 'Watch Later';
    }
  }

  const notice = document.getElementById('ytWatchLaterNotice');
  if (notice) {
    if (inList) {
      notice.classList.remove('hidden');
    } else {
      notice.classList.add('hidden');
    }
  }

  if (window.safeCreateIcons) {
    window.safeCreateIcons();
  } else if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * Updates all navbar & UI badges showing the Watch Later count
 */
export function updateNavWatchLaterBadge() {
  const count = watchLaterList.length;

  const navBadge = document.getElementById('navWatchLaterBadge');
  if (navBadge) {
    navBadge.innerText = count;
    if (count > 0) {
      navBadge.className = 'min-w-[18px] h-4.5 px-1.5 rounded-full bg-brand-cyan text-black text-[10px] font-black flex items-center justify-center font-mono shadow-neon-cyan animate-pulse';
    } else {
      navBadge.className = 'min-w-[18px] h-4.5 px-1 rounded-full bg-white/10 text-slate-400 text-[10px] font-bold flex items-center justify-center font-mono';
    }
  }

  const bottomBadge = document.getElementById('bottomWatchLaterBadge');
  if (bottomBadge) {
    bottomBadge.innerText = count;
    if (count > 0) {
      bottomBadge.classList.remove('hidden');
    } else {
      bottomBadge.classList.add('hidden');
    }
  }

  const meBadge = document.getElementById('meWatchLaterBadge');
  if (meBadge) {
    meBadge.innerText = `${count} ${count === 1 ? 'Show' : 'Shows'}`;
  }

  const modalCount = document.getElementById('watchLaterModalCount');
  if (modalCount) {
    modalCount.innerText = `${count} ${count === 1 ? 'Series' : 'Series'}`;
  }
}

/**
 * Saves a show to the user's Watch Later list (Firestore & Cache)
 */
export async function saveToWatchLater(show) {
  if (!show) return;

  let targetShow = show;
  if (typeof targetShow === 'string') {
    const rawKey = targetShow.trim().toLowerCase();
    const rawNorm = rawKey.replace(/[-_]/g, ' ');
    const found = (window.groupedShows || []).find(s => {
      const sKey = (s.showKey || '').toLowerCase();
      const sTitle = (s.title || '').toLowerCase();
      return sKey === rawKey || sTitle === rawKey || sTitle === rawNorm || sTitle.replace(/[-_]/g, ' ') === rawNorm;
    });
    if (found) {
      targetShow = found;
    } else {
      targetShow = { title: show, showKey: show };
    }
  }

  if (!targetShow || !targetShow.title) return;

  const showTitle = targetShow.title.trim();
  const showKey = showTitle;
  const safeDocId = getSafeDocId(showTitle);

  const episodesCount = Array.isArray(targetShow.episodes) 
    ? targetShow.episodes.length 
    : (targetShow.episodesCount || 1);

  const item = {
    id: safeDocId,
    showKey: showKey,
    title: showTitle,
    category: targetShow.category || 'Anime',
    image: targetShow.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80',
    rating: targetShow.rating || '9.8',
    views: Number(targetShow.views) || 0,
    episodesCount: episodesCount,
    description: targetShow.description || '',
    savedAt: new Date().toISOString()
  };

  // Optimistic local update
  watchLaterList = watchLaterList.filter(i => {
    const iTitle = (i.title || '').toLowerCase().trim();
    const iKey = (i.showKey || '').toLowerCase().trim();
    return iTitle !== showTitle.toLowerCase() && iKey !== showTitle.toLowerCase() && i.id !== safeDocId;
  });
  watchLaterList.unshift(item);
  saveLocalCache(watchLaterList);

  updateWatchLaterButtonUI(targetShow);
  updateNavWatchLaterBadge();
  renderWatchLaterModal();
  renderWatchLaterHomeShelf();
  renderMeWatchLater();
  if (typeof window.refreshAllShowCardsWatchLater === 'function') {
    window.refreshAllShowCardsWatchLater();
  }

  const user = auth?.currentUser;

  if (user && db) {
    try {
      const docPath = `users/${user.uid}/watch_later/${safeDocId}`;
      await setDoc(doc(db, "users", user.uid, "watch_later", safeDocId), {
        ...item,
        userId: user.uid,
        updatedAt: new Date().toISOString()
      });
      if (window.showToast) {
        window.showToast(`Saved "${showTitle}" to Watch Later!`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/watch_later/${safeDocId}`);
      if (window.showToast) {
        window.showToast(`Saved "${showTitle}" to Watch Later (Offline Cache)`);
      }
    }
  } else {
    if (window.showToast) {
      window.showToast(`Saved "${showTitle}" to Watch Later!`);
    }
  }
}

/**
 * Removes a show from the user's Watch Later list (Firestore & Cache)
 */
export async function removeFromWatchLater(showKey, event) {
  if (event) {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
  }

  if (!showKey) return;
  const cleanKey = String(showKey).toLowerCase().trim();
  const cleanKeyNorm = cleanKey.replace(/[-_]/g, ' ');
  const safeDocId = getSafeDocId(cleanKey);

  const existingItem = watchLaterList.find(i => {
    const iKey = String(i.showKey || '').toLowerCase().trim();
    const iTitle = String(i.title || '').toLowerCase().trim();
    const iId = String(i.id || '').toLowerCase().trim();
    return iKey === cleanKey ||
           iTitle === cleanKey ||
           iId === safeDocId ||
           iTitle.replace(/[-_]/g, ' ') === cleanKeyNorm ||
           iKey.replace(/[-_]/g, ' ') === cleanKeyNorm;
  });
  const title = existingItem ? existingItem.title : showKey;
  const docIdToRemove = existingItem ? existingItem.id : safeDocId;

  // Optimistic local update
  watchLaterList = watchLaterList.filter(i => {
    const iKey = String(i.showKey || '').toLowerCase().trim();
    const iTitle = String(i.title || '').toLowerCase().trim();
    const iId = String(i.id || '').toLowerCase().trim();
    const match = iKey === cleanKey ||
                  iTitle === cleanKey ||
                  iId === safeDocId ||
                  iId === docIdToRemove ||
                  iTitle.replace(/[-_]/g, ' ') === cleanKeyNorm ||
                  iKey.replace(/[-_]/g, ' ') === cleanKeyNorm;
    return !match;
  });
  saveLocalCache(watchLaterList);

  updateWatchLaterButtonUI();
  updateNavWatchLaterBadge();
  renderWatchLaterModal();
  renderWatchLaterHomeShelf();
  renderMeWatchLater();
  if (typeof window.refreshAllShowCardsWatchLater === 'function') {
    window.refreshAllShowCardsWatchLater();
  }

  const user = auth?.currentUser;

  if (user && db) {
    try {
      const docPath = `users/${user.uid}/watch_later/${docIdToRemove}`;
      await deleteDoc(doc(db, "users", user.uid, "watch_later", docIdToRemove));
      if (window.showToast) {
        window.showToast(`Removed "${title}" from Watch Later`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/watch_later/${docIdToRemove}`);
      if (window.showToast) {
        window.showToast(`Removed "${title}" from Watch Later`);
      }
    }
  } else {
    if (window.showToast) {
      window.showToast(`Removed "${title}" from Watch Later`);
    }
  }
}

/**
 * Toggles Watch Later for the currently active show in the player
 */
export async function toggleWatchLaterCurrentShow() {
  const show = window.currentSelectedShow || (window.getCurrentSelectedShow && window.getCurrentSelectedShow());
  if (!show) {
    if (window.showToast) window.showToast("No active series loaded.");
    return;
  }

  const inList = isWatchLater(show.title || show.showKey);
  if (inList) {
    await removeFromWatchLater(show.title || show.showKey);
  } else {
    await saveToWatchLater(show);
  }
}

/**
 * Toggles Watch Later directly from any show card in Explore, Home, or Category grids
 */
export async function toggleWatchLaterFromCard(showTitleOrKey, event) {
  if (event) {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
  }
  if (!showTitleOrKey) return;

  const inList = isWatchLater(showTitleOrKey);
  if (inList) {
    await removeFromWatchLater(showTitleOrKey, event);
  } else {
    await saveToWatchLater(showTitleOrKey);
  }

  if (typeof window.refreshAllShowCardsWatchLater === 'function') {
    window.refreshAllShowCardsWatchLater();
  }
}

/**
 * Renders the Watch Later Quick Access Modal
 */
export function renderWatchLaterModal() {
  const container = document.getElementById('watchLaterModalList');
  if (!container) return;

  const items = watchLaterList;
  const user = auth?.currentUser;

  // Sync indicator badge
  const syncStatusEl = document.getElementById('watchLaterSyncStatus');
  if (syncStatusEl) {
    if (user) {
      syncStatusEl.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-cyan/15 border border-brand-cyan/40 text-brand-cyan">
          <span class="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse"></span>
          Firestore Cloud Synced
        </span>
      `;
    } else {
      syncStatusEl.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          Local Mode (Login to Sync)
        </span>
      `;
    }
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="py-12 px-6 text-center rounded-2xl bg-white/5 border border-dashed border-white/10 flex flex-col items-center justify-center gap-3">
        <div class="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500">
          <i data-lucide="bookmark" class="w-7 h-7 text-slate-400"></i>
        </div>
        <div class="space-y-1">
          <h4 class="text-sm font-bold text-white">Your Watch Later List is Empty</h4>
          <p class="text-xs text-slate-400 max-w-sm">
            Browse any Anime, K-Drama, or Movie, then click the <span class="text-brand-cyan font-bold">'Watch Later'</span> button on the show card to save it here for fast access.
          </p>
        </div>
        <button onclick="closeWatchLaterModal(); filterCategoryView('All');" class="mt-2 px-4 py-2 rounded-xl bg-brand-cyan hover:bg-cyan-300 text-black text-xs font-black shadow-neon-cyan transition cursor-pointer">
          Explore Content
        </button>
      </div>
    `;
  } else {
    container.innerHTML = items.map((item) => {
      const safeKey = (item.showKey || item.title || '').replace(/'/g, "\\'");
      const safeTitle = (item.title || 'Untitled Series').replace(/'/g, "\\'");
      const safeImg = (item.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80').replace(/'/g, "\\'");
      const epCount = item.episodesCount || 1;
      const cat = item.category || 'Anime';
      
      const catBadgeColor = 
        cat === 'Kdrama' ? 'text-rose-400 bg-rose-500/15 border-rose-500/30' :
        cat === 'Anime' ? 'text-brand-cyan bg-brand-cyan/15 border-brand-cyan/30' :
        cat === 'Chinese Drama' ? 'text-amber-400 bg-amber-500/15 border-amber-500/30' :
        'text-purple-400 bg-purple-500/15 border-purple-500/30';

      return `
        <div class="group relative flex items-center gap-3.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand-cyan/40 transition duration-200">
          <!-- Thumbnail Poster -->
          <div 
            onclick="openShowPlayerPage('${safeTitle}'); closeWatchLaterModal();"
            class="w-20 sm:w-24 h-16 sm:h-20 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0 relative cursor-pointer group-hover:scale-105 transition duration-200 shadow-md"
          >
            <img src="${safeImg}" alt="${safeTitle}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/40 group-hover:bg-brand-cyan/20 flex items-center justify-center transition">
              <div class="w-7 h-7 rounded-full bg-brand-cyan text-black flex items-center justify-center shadow-neon-cyan opacity-90 group-hover:opacity-100 group-hover:scale-110 transition">
                <i data-lucide="play" class="w-3.5 h-3.5 fill-black ml-0.5"></i>
              </div>
            </div>
          </div>

          <!-- Series Info -->
          <div class="min-w-0 flex-1 cursor-pointer" onclick="openShowPlayerPage('${safeTitle}'); closeWatchLaterModal();">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <span class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${catBadgeColor}">
                ${cat}
              </span>
              <span class="text-[10px] text-slate-400 font-mono">
                ${epCount} ${epCount === 1 ? 'Ep' : 'Eps'}
              </span>
              <span class="text-[10px] text-amber-400 font-bold flex items-center gap-0.5">
                ★ ${item.rating || '9.8'}
              </span>
            </div>
            <h4 class="text-sm font-bold text-white group-hover:text-brand-cyan transition truncate">
              ${item.title}
            </h4>
            <p class="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
              ${item.description || 'Watch on Show Verse in ultra-HD'}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <button 
              type="button"
              onclick="openShowPlayerPage('${safeTitle}'); closeWatchLaterModal();" 
              class="px-3 py-1.5 rounded-xl bg-brand-cyan/15 hover:bg-brand-cyan text-brand-cyan hover:text-black font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
              title="Play Series Now"
            >
              <i data-lucide="play" class="w-3.5 h-3.5"></i>
              <span class="hidden sm:inline">Play</span>
            </button>
            <button 
              type="button"
              onclick="removeFromWatchLater('${safeTitle}', event)" 
              class="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
              title="Remove from Watch Later"
            >
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  if (window.safeCreateIcons) {
    window.safeCreateIcons(container);
  } else if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * Renders the Watch Later Quick Preview section inside the 'Me' Profile Modal
 */
export function renderMeWatchLater() {
  const container = document.getElementById('meWatchLaterPreviewList');
  if (!container) return;

  const items = watchLaterList;
  if (items.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-1.5">
        <i data-lucide="bookmark" class="w-6 h-6 text-slate-500"></i>
        <p class="text-xs font-bold text-slate-300">Watch Later is Empty</p>
        <p class="text-[11px] text-slate-400">Save shows to access them quickly here.</p>
      </div>
    `;
  } else {
    container.innerHTML = items.map(item => {
      const safeKey = (item.showKey || item.title || '').replace(/'/g, "\\'");
      const safeTitle = (item.title || 'Untitled').replace(/'/g, "\\'");
      const safeImg = (item.image || '').replace(/'/g, "\\'");
      return `
        <div class="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-brand-cyan/30 transition group cursor-pointer" onclick="openShowPlayerPage('${safeTitle}'); closeMeModal();">
          <div class="flex items-center gap-3 min-w-0 mr-2">
            <img src="${safeImg}" class="w-12 h-12 rounded-xl object-cover flex-shrink-0 shadow-sm" alt="${safeTitle}">
            <div class="min-w-0">
              <h5 class="text-xs font-bold text-white group-hover:text-brand-cyan transition truncate">${item.title}</h5>
              <span class="text-[10px] text-brand-cyan font-semibold">${item.category} • ${item.episodesCount || 1} Eps</span>
            </div>
          </div>
          <button type="button" onclick="removeFromWatchLater('${safeTitle}', event)" class="p-2 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 transition cursor-pointer" title="Remove from Watch Later">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      `;
    }).join('');
  }

  if (window.safeCreateIcons) {
    window.safeCreateIcons(container);
  } else if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * Renders the Watch Later shelf on the Home View if items exist
 */
export function renderWatchLaterHomeShelf() {
  const section = document.getElementById('section-WatchLater');
  const row = document.getElementById('watchLaterRow');
  const countBadge = document.getElementById('watchLaterHomeCount');

  if (!section || !row) return;

  const items = watchLaterList;

  if (items.length === 0) {
    section.classList.add('hidden');
    row.innerHTML = '';
    return;
  }

  section.classList.remove('hidden');
  if (countBadge) {
    countBadge.innerText = `${items.length} Saved`;
  }

  row.innerHTML = items.map((item) => {
    const safeTitle = (item.title || 'Untitled').replace(/'/g, "\\'");
    const safeImg = (item.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80').replace(/'/g, "\\'");
    const epCount = item.episodesCount || 1;
    const cat = item.category || 'Anime';

    return `
      <div 
        class="show-card group relative flex-shrink-0 w-64 md:w-72 rounded-2xl overflow-hidden glass-card border border-white/10 hover:border-brand-cyan/50 transition-all duration-300 hover:scale-[1.02] cursor-pointer snap-start"
        onclick="openShowPlayerPage('${safeTitle}')"
      >
        <div class="relative aspect-video overflow-hidden bg-slate-900">
          <img src="${safeImg}" alt="${safeTitle}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
          <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
          
          <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            <span class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-black/60 backdrop-blur border border-white/20 text-brand-cyan">
              ${cat}
            </span>
          </div>

          <button 
            type="button" 
            onclick="removeFromWatchLater('${safeTitle}', event)" 
            class="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/70 hover:bg-rose-500/80 text-white hover:text-white flex items-center justify-center transition opacity-80 hover:opacity-100 cursor-pointer shadow-md"
            title="Remove from Watch Later"
          >
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>

          <div class="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-xs">
            <span class="text-amber-400 font-bold text-[11px] flex items-center gap-1">
              ★ ${item.rating || '9.8'}
            </span>
            <span class="text-slate-300 font-mono text-[10px] bg-white/10 px-2 py-0.5 rounded-full">
              ${epCount} ${epCount === 1 ? 'Episode' : 'Episodes'}
            </span>
          </div>
        </div>

        <div class="p-3.5 space-y-1">
          <h4 class="text-sm font-black text-white group-hover:text-brand-cyan transition truncate">
            ${item.title}
          </h4>
          <p class="text-[11px] text-slate-400 line-clamp-1">
            ${item.description || 'Watch now in ultra-HD stream'}
          </p>
        </div>
      </div>
    `;
  }).join('');

  if (window.safeCreateIcons) {
    window.safeCreateIcons(row);
  } else if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * Open/close modal controls
 */
export function openWatchLaterModal() {
  const modal = document.getElementById('watchLaterModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (document.body) document.body.classList.add('overflow-hidden');
    renderWatchLaterModal();
    if (typeof window.updateActiveNavTab === 'function') {
      window.updateActiveNavTab('watchLater');
    }
  }
}

export function closeWatchLaterModal() {
  const modal = document.getElementById('watchLaterModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (document.body) document.body.classList.remove('overflow-hidden');
    if (typeof window.updateActiveNavTab === 'function') {
      window.updateActiveNavTab('explore');
    }
  }
}

export function handleWatchLaterBackdropClick(event) {
  if (event.target.id === 'watchLaterModal') {
    closeWatchLaterModal();
  }
}

/**
 * Initializes real-time Firebase Auth and Firestore synchronization
 */
export function initWatchLaterAuthSync() {
  // 1. Initial load from local cache
  watchLaterList = loadLocalCache();
  updateNavWatchLaterBadge();
  renderWatchLaterHomeShelf();
  renderMeWatchLater();

  if (!auth) {
    console.warn("[WatchLater] Firebase Auth not available, running in local cache mode.");
    return;
  }

  // 2. Listen to Auth state changes
  auth.onAuthStateChanged(async (user) => {
    if (unsubscribeWatchLater) {
      unsubscribeWatchLater();
      unsubscribeWatchLater = null;
    }

    if (user && db) {
      console.log(`[WatchLater] User authenticated: ${user.email}. Connecting personal Firestore list...`);

      // Sync local items to Firestore if any exist
      const localItems = loadLocalCache();
      if (localItems.length > 0) {
        for (const it of localItems) {
          try {
            const sId = getSafeDocId(it.showKey || it.title);
            await setDoc(doc(db, "users", user.uid, "watch_later", sId), {
              ...it,
              id: sId,
              userId: user.uid
            }, { merge: true });
          } catch (_) {}
        }
      }

      // Attach Firestore real-time listener
      try {
        const watchLaterCol = collection(db, "users", user.uid, "watch_later");
        unsubscribeWatchLater = onSnapshot(watchLaterCol, (snapshot) => {
          const remoteItems = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            remoteItems.push({
              id: docSnap.id,
              ...data
            });
          });

          // Sort by savedAt descending
          remoteItems.sort((a, b) => new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime());

          watchLaterList = remoteItems;
          saveLocalCache(watchLaterList);

          updateWatchLaterButtonUI();
          updateNavWatchLaterBadge();
          renderWatchLaterModal();
          renderWatchLaterHomeShelf();
          renderMeWatchLater();
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/watch_later`);
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/watch_later`);
      }
    } else {
      console.log("[WatchLater] Guest mode active. Using local client cache.");
      watchLaterList = loadLocalCache();
      updateWatchLaterButtonUI();
      updateNavWatchLaterBadge();
      renderWatchLaterModal();
      renderWatchLaterHomeShelf();
      renderMeWatchLater();
    }
  });
}

// Global window exposure for inline event handlers
if (typeof window !== "undefined") {
  window.isWatchLater = isWatchLater;
  window.getWatchLaterList = getWatchLaterList;
  window.saveToWatchLater = saveToWatchLater;
  window.removeFromWatchLater = removeFromWatchLater;
  window.toggleWatchLaterCurrentShow = toggleWatchLaterCurrentShow;
  window.toggleWatchLaterFromCard = toggleWatchLaterFromCard;
  window.updateWatchLaterButtonUI = updateWatchLaterButtonUI;
  window.updateNavWatchLaterBadge = updateNavWatchLaterBadge;
  window.openWatchLaterModal = openWatchLaterModal;
  window.closeWatchLaterModal = closeWatchLaterModal;
  window.handleWatchLaterBackdropClick = handleWatchLaterBackdropClick;
  window.renderWatchLaterModal = renderWatchLaterModal;
  window.renderWatchLaterHomeShelf = renderWatchLaterHomeShelf;
  window.renderMeWatchLater = renderMeWatchLater;
  window.initWatchLaterAuthSync = initWatchLaterAuthSync;
}

// Auto-initialize when script loads
if (typeof document !== "undefined") {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initWatchLaterAuthSync());
  } else {
    initWatchLaterAuthSync();
  }
}
