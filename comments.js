// comments.js - Episode Discussion & Real-Time Comments Engine for Show Verse
import { db, auth } from "./firebase.js";
import { getCurrentUser, isAuthorizedAdmin } from "./auth.js";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  increment,
  onSnapshot 
} from "firebase/firestore";

// Local storage keys
const COMMENTS_CACHE_PREFIX = 'showverse_comments_';
const LIKED_COMMENTS_KEY = 'showverse_liked_comments';
const GUEST_ID_KEY = 'showverse_guest_id';
const GUEST_NAME_KEY = 'showverse_guest_name';

// Active state
let activeShow = null;
let activeShowKey = '';
let activeSeriesTitle = '';
let activeEpisodeNumber = 1;
let activeSeasonNumber = 1;
let commentsFilter = 'current'; // 'current' | 'all'
let showComments = [];
let firestoreUnsubscribe = null;
let revealedSpoilers = new Set();

/**
 * Returns or generates a persistent guest ID for guest commenters
 */
function getGuestId() {
  try {
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = 'guest_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  } catch (_) {
    return 'guest_' + Math.random().toString(36).substring(2, 9);
  }
}

/**
 * Returns saved guest nickname or empty string
 */
export function getSavedGuestName() {
  try {
    return localStorage.getItem(GUEST_NAME_KEY) || '';
  } catch (_) {
    return '';
  }
}

/**
 * Saves guest nickname
 */
export function setSavedGuestName(name) {
  try {
    if (name && name.trim()) {
      localStorage.setItem(GUEST_NAME_KEY, name.trim());
    }
  } catch (_) {}
}

/**
 * Gets set of liked comment IDs from localStorage
 */
function getLikedCommentIds() {
  try {
    const raw = localStorage.getItem(LIKED_COMMENTS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (_) {
    return new Set();
  }
}

/**
 * Saves liked comment IDs
 */
function saveLikedCommentIds(likedSet) {
  try {
    localStorage.setItem(LIKED_COMMENTS_KEY, JSON.stringify(Array.from(likedSet)));
  } catch (_) {}
}

/**
 * Loads cached comments for the show
 */
function getCachedComments(showKey) {
  try {
    const raw = localStorage.getItem(COMMENTS_CACHE_PREFIX + showKey);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

/**
 * Saves cached comments for the show
 */
function setCachedComments(showKey, list) {
  try {
    localStorage.setItem(COMMENTS_CACHE_PREFIX + showKey, JSON.stringify(list));
  } catch (_) {}
}

/**
 * Format relative time (e.g. 'just now', '5m ago', '2h ago', '3d ago')
 */
function formatTimeAgo(isoString) {
  if (!isoString) return 'recently';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 45) return 'just now';
    if (diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      return `${mins}m ago`;
    }
    if (diffSec < 86400) {
      const hours = Math.floor(diffSec / 3600);
      return `${hours}h ago`;
    }
    const days = Math.floor(diffSec / 86400);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  } catch (_) {
    return 'recently';
  }
}

/**
 * Generates an avatar gradient based on author name
 */
function getAvatarGradient(name) {
  const gradients = [
    'from-cyan-500 to-blue-600',
    'from-purple-500 to-indigo-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-emerald-500 to-teal-600',
    'from-fuchsia-500 to-purple-600'
  ];
  let hash = 0;
  for (let i = 0; i < (name || 'G').length; i++) {
    hash = (hash + (name || 'G').charCodeAt(i)) % gradients.length;
  }
  return gradients[hash];
}

/**
 * Initializes comments for the currently active show and episode
 */
export function initEpisodeComments(show, episodeIndex = 0) {
  if (!show) return;

  activeShow = show;
  activeShowKey = show.showKey || (show.title || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  activeSeriesTitle = show.title || 'Untitled';
  
  const ep = (show.episodes && show.episodes[episodeIndex]) ? show.episodes[episodeIndex] : null;
  activeEpisodeNumber = ep ? (ep.episodeNumber || (episodeIndex + 1)) : (episodeIndex + 1);
  activeSeasonNumber = ep ? (parseInt(ep.season, 10) || 1) : 1;

  // Cleanup existing firestore listener
  if (firestoreUnsubscribe) {
    try {
      firestoreUnsubscribe();
    } catch (_) {}
    firestoreUnsubscribe = null;
  }

  // Load from local storage immediately so UI is instant
  showComments = getCachedComments(activeShowKey);
  renderCommentsUI();

  // Update input placeholder and author indicator
  updateAuthorUI();

  // If Firestore is available, establish live sync
  if (db) {
    try {
      const commentsCol = collection(db, 'showverse_comments');
      // Listen for all comments on this show
      firestoreUnsubscribe = onSnapshot(commentsCol, (snapshot) => {
        const firestoreList = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data && data.showKey === activeShowKey) {
            firestoreList.push({
              id: docSnap.id,
              ...data
            });
          }
        });

        // Merge with local comments if local has items that haven't reached Firestore yet
        const mergedMap = new Map();
        showComments.forEach(c => mergedMap.set(c.id, c));
        firestoreList.forEach(c => mergedMap.set(c.id, c));

        showComments = Array.from(mergedMap.values());
        // Sort newest first
        showComments.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

        // Update local cache
        setCachedComments(activeShowKey, showComments);
        renderCommentsUI();
      }, (err) => {
        console.log('[ShowVerse Comments] Firestore offline fallback:', err?.message || 'offline');
      });
    } catch (e) {
      console.warn('[ShowVerse Comments] Setup error:', e);
    }
  }
}

/**
 * Updates UI when switching active episode without reloading entire show
 */
export function updateActiveEpisodeInComments(episodeNumber, seasonNumber) {
  activeEpisodeNumber = Number(episodeNumber) || 1;
  activeSeasonNumber = Number(seasonNumber) || 1;
  updateAuthorUI();
  renderCommentsUI();
}

/**
 * Updates the author preview bar above the comment input
 */
export function updateAuthorUI() {
  const authorBadge = document.getElementById('commentAuthorBadge');
  const guestNameInput = document.getElementById('commentGuestNameInput');
  const commentInput = document.getElementById('episodeCommentInput');
  const curEpLabel = document.getElementById('commentsActiveEpisodeLabel');

  if (curEpLabel) {
    curEpLabel.innerText = `Ep ${activeEpisodeNumber}`;
  }

  if (commentInput) {
    commentInput.placeholder = `Share your thoughts on Episode ${activeEpisodeNumber}... (Be respectful, tag spoilers!)`;
  }

  const user = getCurrentUser();
  if (user) {
    const name = user.displayName || (user.email ? user.email.split('@')[0] : 'Member');
    const isAdmin = isAuthorizedAdmin(user);
    if (authorBadge) {
      authorBadge.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-full bg-gradient-to-tr from-brand-cyan to-purple-600 flex items-center justify-center text-[10px] font-black text-black">
            ${(name[0] || 'U').toUpperCase()}
          </div>
          <span class="text-xs font-bold text-white">${name}</span>
          ${isAdmin ? '<span class="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-black">ADMIN</span>' : '<span class="text-[10px] text-slate-400 font-mono">Logged in</span>'}
        </div>
      `;
    }
    if (guestNameInput) {
      guestNameInput.classList.add('hidden');
    }
  } else {
    const savedName = getSavedGuestName();
    if (authorBadge) {
      authorBadge.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-full bg-slate-800 border border-white/20 flex items-center justify-center text-[10px] font-bold text-slate-300">
            <i data-lucide="user" class="w-3.5 h-3.5"></i>
          </div>
          <span class="text-xs text-slate-400">Commenting as Guest</span>
        </div>
      `;
    }
    if (guestNameInput) {
      guestNameInput.classList.remove('hidden');
      if (savedName && !guestNameInput.value) {
        guestNameInput.value = savedName;
      }
    }
  }

  if (window.safeCreateIcons) {
    window.safeCreateIcons();
  } else if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Filter mode switcher ('current' | 'all')
 */
export function setCommentsFilter(mode) {
  commentsFilter = mode === 'all' ? 'all' : 'current';
  
  const currentBtn = document.getElementById('commentsFilterCurrentBtn');
  const allBtn = document.getElementById('commentsFilterAllBtn');

  if (currentBtn && allBtn) {
    if (commentsFilter === 'current') {
      currentBtn.className = 'px-3 py-1 rounded-xl bg-brand-cyan text-black font-extrabold text-xs shadow-neon-cyan transition cursor-pointer select-none';
      allBtn.className = 'px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs border border-white/10 transition cursor-pointer select-none';
    } else {
      currentBtn.className = 'px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs border border-white/10 transition cursor-pointer select-none';
      allBtn.className = 'px-3 py-1 rounded-xl bg-purple-500 text-white font-extrabold text-xs shadow-[0_0_15px_rgba(168,85,247,0.4)] transition cursor-pointer select-none';
    }
  }

  renderCommentsUI();
}

/**
 * Submits a new comment for the active episode
 */
export async function submitEpisodeComment() {
  const input = document.getElementById('episodeCommentInput');
  const spoilerCheck = document.getElementById('episodeCommentSpoilerCheckbox');
  const guestNameInput = document.getElementById('commentGuestNameInput');

  if (!input) return;

  const content = (input.value || '').trim();
  if (!content) {
    if (window.showToast) window.showToast('Please type a comment before posting.');
    input.focus();
    return;
  }

  if (content.length > 2000) {
    if (window.showToast) window.showToast('Comment is too long (max 2000 characters).');
    return;
  }

  const isSpoiler = spoilerCheck ? spoilerCheck.checked : false;
  const user = getCurrentUser();
  const isAdmin = isAuthorizedAdmin(user);

  let authorName = 'Anime Fan';
  let userId = '';
  let userEmail = '';

  if (user) {
    userId = user.uid;
    authorName = user.displayName || (user.email ? user.email.split('@')[0] : 'Member');
    userEmail = user.email || '';
  } else {
    userId = getGuestId();
    const typedGuestName = guestNameInput ? guestNameInput.value.trim() : '';
    if (typedGuestName) {
      authorName = typedGuestName;
      setSavedGuestName(typedGuestName);
    } else {
      authorName = getSavedGuestName() || ('Guest_' + Math.floor(1000 + Math.random() * 9000));
    }
  }

  const commentId = 'comm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const newComment = {
    id: commentId,
    showKey: activeShowKey,
    seriesTitle: activeSeriesTitle,
    episodeNumber: Number(activeEpisodeNumber) || 1,
    seasonNumber: Number(activeSeasonNumber) || 1,
    content: content,
    userId: userId,
    userName: authorName,
    userEmail: userEmail,
    isAdmin: Boolean(isAdmin),
    isSpoiler: Boolean(isSpoiler),
    likes: 0,
    likedBy: [],
    createdAt: new Date().toISOString()
  };

  // Add to local state immediately (optimistic UI)
  showComments.unshift(newComment);
  setCachedComments(activeShowKey, showComments);

  // Clear inputs
  input.value = '';
  if (spoilerCheck) spoilerCheck.checked = false;

  renderCommentsUI();
  if (window.showToast) window.showToast('Comment posted!');

  // Sync to Firestore if available
  if (db) {
    try {
      await setDoc(doc(db, 'showverse_comments', commentId), newComment);
    } catch (err) {
      console.warn('[ShowVerse Comments] Could not persist to Firestore cloud:', err);
    }
  }
}

/**
 * Likes or unlikes a comment
 */
export async function toggleCommentLike(commentId, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const target = showComments.find(c => c.id === commentId);
  if (!target) return;

  const likedSet = getLikedCommentIds();
  const isLiked = likedSet.has(commentId);

  if (isLiked) {
    likedSet.delete(commentId);
    target.likes = Math.max(0, (target.likes || 1) - 1);
  } else {
    likedSet.add(commentId);
    target.likes = (target.likes || 0) + 1;
  }

  saveLikedCommentIds(likedSet);
  setCachedComments(activeShowKey, showComments);
  renderCommentsUI();

  // Firestore update
  if (db) {
    try {
      const commentRef = doc(db, 'showverse_comments', commentId);
      await updateDoc(commentRef, {
        likes: increment(isLiked ? -1 : 1)
      });
    } catch (err) {
      console.warn('[ShowVerse Comments] Error updating like in Firestore:', err);
    }
  }
}

/**
 * Deletes a comment (by author or admin)
 */
export async function deleteEpisodeComment(commentId, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const user = getCurrentUser();
  const isAdmin = isAuthorizedAdmin(user);
  const target = showComments.find(c => c.id === commentId);

  if (!target) return;

  const canDelete = isAdmin || (user && user.uid === target.userId) || target.userId === getGuestId();
  if (!canDelete) {
    if (window.showToast) window.showToast('You can only delete your own comments.');
    return;
  }

  if (!window.confirm('Delete this comment?')) {
    return;
  }

  // Remove from local
  showComments = showComments.filter(c => c.id !== commentId);
  setCachedComments(activeShowKey, showComments);
  renderCommentsUI();

  if (window.showToast) window.showToast('Comment deleted.');

  // Delete from Firestore
  if (db) {
    try {
      await deleteDoc(doc(db, 'showverse_comments', commentId));
    } catch (err) {
      console.warn('[ShowVerse Comments] Error deleting from Firestore:', err);
    }
  }
}

/**
 * Toggles revealing a spoiler comment
 */
export function toggleSpoilerReveal(commentId) {
  if (revealedSpoilers.has(commentId)) {
    revealedSpoilers.delete(commentId);
  } else {
    revealedSpoilers.add(commentId);
  }
  renderCommentsUI();
}

/**
 * Inserts emoji reaction into textarea
 */
export function insertEmojiReaction(emoji) {
  const input = document.getElementById('episodeCommentInput');
  if (!input) return;
  input.value = (input.value ? input.value + ' ' : '') + emoji;
  input.focus();
}

/**
 * Renders the full comments list in the DOM
 */
export function renderCommentsUI() {
  const container = document.getElementById('episodeCommentsList');
  const countBadge = document.getElementById('ytCommentsCountBadge');
  const totalCounter = document.getElementById('ytCommentsTotalCounter');
  const filterEpLabel = document.getElementById('commentsFilterCurrentEpNum');

  if (filterEpLabel) {
    filterEpLabel.innerText = `Ep ${activeEpisodeNumber}`;
  }

  // Filter based on selected mode
  let filtered = showComments;
  if (commentsFilter === 'current') {
    filtered = showComments.filter(c => Number(c.episodeNumber) === Number(activeEpisodeNumber));
  }

  const totalShowComments = showComments.length;
  const filteredCount = filtered.length;

  if (countBadge) {
    countBadge.innerText = commentsFilter === 'current'
      ? `${filteredCount} ${filteredCount === 1 ? 'Comment' : 'Comments'} (Ep ${activeEpisodeNumber})`
      : `${totalShowComments} ${totalShowComments === 1 ? 'Comment' : 'Comments'} (All)`;
  }

  if (totalCounter) {
    totalCounter.innerText = `${totalShowComments} ${totalShowComments === 1 ? 'comment' : 'comments'} on this show`;
  }

  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2">
        <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400">
          <i data-lucide="message-square" class="w-6 h-6 text-brand-cyan/60"></i>
        </div>
        <p class="font-bold text-sm text-slate-200">No comments ${commentsFilter === 'current' ? `on Episode ${activeEpisodeNumber}` : 'on this series'} yet</p>
        <p class="text-xs text-slate-400 max-w-sm">Be the first to share your thoughts, reaction, or theory about this episode!</p>
      </div>
    `;
    if (window.safeCreateIcons) {
      window.safeCreateIcons(container);
    } else if (window.lucide) {
      window.lucide.createIcons();
    }
    return;
  }

  const likedSet = getLikedCommentIds();
  const user = getCurrentUser();
  const isAdmin = isAuthorizedAdmin(user);
  const currentGuestId = getGuestId();

  container.innerHTML = filtered.map(comment => {
    const isLiked = likedSet.has(comment.id);
    const canDelete = isAdmin || (user && user.uid === comment.userId) || (comment.userId === currentGuestId);
    const initial = (comment.userName || 'A').charAt(0).toUpperCase();
    const gradient = getAvatarGradient(comment.userName);
    const timeAgo = formatTimeAgo(comment.createdAt);
    const isRevealed = revealedSpoilers.has(comment.id);

    // Escape text content safely
    const safeContent = (comment.content || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br/>');

    let bodyHtml = '';
    if (comment.isSpoiler && !isRevealed) {
      bodyHtml = `
        <div class="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-xs font-bold text-amber-300">
            <i data-lucide="eye-off" class="w-4 h-4 text-amber-400 flex-shrink-0"></i>
            <span>Spoiler Warning: This comment contains spoilers for Episode ${comment.episodeNumber}.</span>
          </div>
          <button type="button" onclick="toggleSpoilerReveal('${comment.id}')" class="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-black transition cursor-pointer select-none flex-shrink-0">
            Reveal
          </button>
        </div>
      `;
    } else if (comment.isSpoiler && isRevealed) {
      bodyHtml = `
        <div class="mt-2.5 space-y-1.5">
          <div class="flex items-center justify-between text-[11px] text-amber-400 font-bold">
            <span class="flex items-center gap-1"><i data-lucide="eye" class="w-3.5 h-3.5"></i> Spoiler Revealed</span>
            <button type="button" onclick="toggleSpoilerReveal('${comment.id}')" class="text-slate-400 hover:text-white underline cursor-pointer text-[10px]">Hide</button>
          </div>
          <p class="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">${safeContent}</p>
        </div>
      `;
    } else {
      bodyHtml = `
        <p class="mt-2 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">${safeContent}</p>
      `;
    }

    return `
      <div id="comment-${comment.id}" class="p-4 rounded-2xl bg-white/5 hover:bg-white/[0.07] border border-white/10 hover:border-brand-cyan/30 transition-all duration-200 space-y-2 group">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-full bg-gradient-to-tr ${gradient} flex items-center justify-center font-black text-xs text-white shadow-md flex-shrink-0">
              ${initial}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-xs sm:text-sm text-white truncate">${comment.userName || 'Anime Fan'}</span>
                ${comment.isAdmin ? '<span class="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-black uppercase tracking-wider">ADMIN</span>' : ''}
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/20">
                  Ep ${comment.episodeNumber}
                </span>
                <span class="text-[11px] text-slate-400 font-mono">${timeAgo}</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 flex-shrink-0">
            ${canDelete ? `
              <button 
                type="button" 
                onclick="deleteEpisodeComment('${comment.id}', event)" 
                class="opacity-60 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                title="Delete comment"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
          </div>
        </div>

        ${bodyHtml}

        <!-- Footer / Reactions -->
        <div class="flex items-center justify-between pt-1 text-xs text-slate-400">
          <button 
            type="button" 
            onclick="toggleCommentLike('${comment.id}', event)" 
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition cursor-pointer select-none ${
              isLiked 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold' 
                : 'hover:bg-white/10 hover:text-white border border-transparent'
            }"
            title="${isLiked ? 'Unlike' : 'Like this comment'}"
          >
            <i data-lucide="heart" class="w-3.5 h-3.5 ${isLiked ? 'fill-rose-400 text-rose-400' : 'text-slate-400'}"></i>
            <span class="font-mono text-[11px] font-semibold">${comment.likes || 0}</span>
          </button>
          
          <span class="text-[10px] text-slate-400">#${comment.showKey}</span>
        </div>
      </div>
    `;
  }).join('');

  if (window.safeCreateIcons) {
    window.safeCreateIcons(container);
  } else if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Attach to window for global inline onclick handlers
if (typeof window !== 'undefined') {
  window.submitEpisodeComment = submitEpisodeComment;
  window.toggleCommentLike = toggleCommentLike;
  window.deleteEpisodeComment = deleteEpisodeComment;
  window.toggleSpoilerReveal = toggleSpoilerReveal;
  window.setCommentsFilter = setCommentsFilter;
  window.insertEmojiReaction = insertEmojiReaction;
  window.initEpisodeComments = initEpisodeComments;
  window.updateActiveEpisodeInComments = updateActiveEpisodeInComments;
}
