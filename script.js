/* global window, document, fetch */
// Expect window.SUPABASE_CONFIG injected by config.js (a copy of config.example.js)
// Basic defensive check
(function init() {
  const statusEl = document.getElementById('status');
  const galleryEl = document.getElementById('gallery');
  const refreshBtn = document.getElementById('refreshBtn');
  const searchInput = document.getElementById('searchInput');
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  function setStatus(msg, options = {}) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.dataset.state = options.state || '';
  }

  if (!window.SUPABASE_CONFIG) {
    setStatus('Missing config.js. Copy config.example.js → config.js and add keys.');
    return;
  }

  const { url, anonKey } = window.SUPABASE_CONFIG;
  if (!url || !anonKey) {
    setStatus('Supabase credentials not set.');
    return;
  }
  // Guard against placeholders to avoid confusing network errors
  if (/YOUR_PROJECT_ID/i.test(url) || /^YOUR_/i.test(anonKey)) {
    setStatus('Update config.js with your real Supabase URL and anon key.');
    return;
  }

  // Initialize Supabase (v2 CDN global is window.supabase)
  const client = window.supabase.createClient(url, anonKey, {
    auth: { persistSession: false }
  });

  let allArt = [];
  let loading = false;
  let lastFetchTs = 0;
  const CACHE_KEY = 'artworks_cache_v1';
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Try load from cache immediately for fast paint
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Array.isArray(cached.data) && (Date.now() - cached.time) < CACHE_TTL_MS) {
      allArt = cached.data;
      render();
      setStatus(`Loaded ${allArt.length} cached item${allArt.length===1?'':'s'}… refreshing`);
    }
  } catch { /* ignore */ }

  async function fetchArtworks() {
    if (loading) return;
    loading = true;
    setStatus('Loading artworks…');
    try {
      const { data, error } = await client
        .from('artworks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      allArt = data || [];
      lastFetchTs = Date.now();
  // Cache
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data: allArt })); } catch { /* quota */ }
      render();
      if (!allArt.length) {
        setStatus('No artworks yet. Add some rows in Supabase table.', { state: 'empty' });
      } else {
        setStatus(`Loaded ${allArt.length} artwork${allArt.length === 1 ? '' : 's'}.`);
      }
    } catch (e) {
      console.error(e);
      setStatus('Failed to load artworks (see console).');
    } finally {
      loading = false;
    }
  }

  function filterArtworks(term) {
    if (!term) return allArt;
    term = term.toLowerCase();
    return allArt.filter(a => (a.title || '').toLowerCase().includes(term));
  }

  function fmtDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; }
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function cardTemplate(a) {
  const img = a.image_url ? `<img class="lazy-img" data-src="${escapeHtml(a.image_url)}" alt="${escapeHtml(a.title)}" loading="lazy" decoding="async" />` : '<div class="placeholder" aria-label="No image">🎨</div>';
    return `<article class="art-card" tabindex="0">
      <div class="art-img-wrap">${img}</div>
      <div class="art-body">
        <h2 class="art-title">${escapeHtml(a.title)}</h2>
        <p class="art-desc">${escapeHtml(a.description)}</p>
        <div class="meta-row">
          <span>${fmtDate(a.created_at)}</span>
          <span class="badge">ID: ${(a.id || '').toString().slice(0,8)}</span>
        </div>
      </div>
    </article>`;
  }

  function render() {
    const term = searchInput.value.trim();
    const items = filterArtworks(term);
    galleryEl.innerHTML = items.length
      ? items.map(cardTemplate).join('')
      : '<div class="empty">No matches.</div>';
  setupLazyLoading();
  }

  refreshBtn.addEventListener('click', () => fetchArtworks());
  searchInput.addEventListener('input', () => render());

  // Auto refresh if > 5 min stale when tab focused
  window.addEventListener('focus', () => {
    if (Date.now() - lastFetchTs > 5 * 60 * 1000) fetchArtworks();
  });

  fetchArtworks();

  /* Lightbox Logic */
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lbImg');
  const lbTitle = document.getElementById('lbTitle');
  const lbDesc = document.getElementById('lbDesc');
  const lbDate = document.getElementById('lbDate');
  const lbPrev = document.getElementById('lbPrev');
  const lbNext = document.getElementById('lbNext');
  let lbIndex = -1;
  let prevFocused = null;
  let focusables = [];
  const FOCUS_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  function collectFocusables() {
    focusables = Array.from(lb.querySelectorAll(FOCUS_SELECTOR))
      .filter(el => !el.hasAttribute('disabled') && el.getAttribute('tabindex') !== '-1');
  }

  function trapFocus(e) {
    if (lb.getAttribute('aria-hidden') === 'true') return;
    if (e.key !== 'Tab') return;
    if (!focusables.length) { e.preventDefault(); return; }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !lb.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function openLightbox(idx) {
    if (!allArt.length) return;
  prevFocused = document.activeElement;
    lbIndex = ((idx % allArt.length) + allArt.length) % allArt.length;
    const a = allArt[lbIndex];
    lbImg.src = a.image_url || '';
    lbImg.alt = a.title || '';
    lbTitle.textContent = a.title || 'Untitled';
    lbDesc.textContent = a.description || '';
    lbDate.textContent = a.created_at ? new Date(a.created_at).toLocaleString() : '';
    lb.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  collectFocusables();
  // Focus first focusable (close button likely)
  (focusables[0] || lb).focus();
  // Preload adjacent
  preloadAdjacent(lbIndex);
  }
  function closeLightbox() {
    lb.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
    lbIndex = -1;
    if (prevFocused && typeof prevFocused.focus === 'function') {
      prevFocused.focus();
    }
  }
  function nextArt(delta) { if (lbIndex === -1) return; openLightbox(lbIndex + delta); }

  galleryEl.addEventListener('click', e => {
    const card = e.target.closest('.art-card');
    if (!card) return;
    const nodes = [...galleryEl.querySelectorAll('.art-card')];
    const idx = nodes.indexOf(card);
    if (idx >= 0) openLightbox(idx);
  });

  galleryEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.art-card');
      if (card) {
        e.preventDefault();
        const nodes = [...galleryEl.querySelectorAll('.art-card')];
        const idx = nodes.indexOf(card);
        if (idx >= 0) openLightbox(idx);
      }
    }
  });

  lb.addEventListener('click', e => { if (e.target.hasAttribute('data-close')) closeLightbox(); });
  lbPrev && lbPrev.addEventListener('click', () => nextArt(-1));
  lbNext && lbNext.addEventListener('click', () => nextArt(1));

  window.addEventListener('keydown', e => {
    if (lb.getAttribute('aria-hidden') === 'true') return;
    if (e.key === 'Escape') { closeLightbox(); }
    else if (e.key === 'ArrowRight') { nextArt(1); }
    else if (e.key === 'ArrowLeft') { nextArt(-1); }
  else if (e.key === 'Tab') { trapFocus(e); }
  });

  /* Lazy Loading */
  let io;
  function setupLazyLoading() {
    const imgs = galleryEl.querySelectorAll('img.lazy-img[data-src]');
    if (!imgs.length) return;
    if (!('IntersectionObserver' in window)) {
      imgs.forEach(img => loadLazyImage(img));
      return;
    }
    io?.disconnect();
    io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target; loadLazyImage(img); io.unobserve(img);
        }
      });
    }, { rootMargin: '100px 0px 150px' });
    imgs.forEach(i => io.observe(i));
  }
  function loadLazyImage(img) {
    const src = img.getAttribute('data-src');
    if (!src) return;
    img.src = src;
    img.removeAttribute('data-src');
    img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
  }

  function preloadAdjacent(idx) {
    [idx+1, idx-1].forEach(i => {
      const a = allArt[((i % allArt.length)+allArt.length)%allArt.length];
      if (a && a.image_url) {
        const img = new Image(); img.src = a.image_url; // passive preload
      }
    });
  }
})();
