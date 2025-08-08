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

  // Initialize Supabase (v2 CDN global is window.supabase)
  const client = window.supabase.createClient(url, anonKey, {
    auth: { persistSession: false }
  });

  let allArt = [];
  let loading = false;
  let lastFetchTs = 0;

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
    const img = a.image_url ? `<img src="${escapeHtml(a.image_url)}" alt="${escapeHtml(a.title)}" loading="lazy" decoding="async">` : '<div class="placeholder" aria-label="No image">🎨</div>';
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
  }

  refreshBtn.addEventListener('click', () => fetchArtworks());
  searchInput.addEventListener('input', () => render());

  // Auto refresh if > 5 min stale when tab focused
  window.addEventListener('focus', () => {
    if (Date.now() - lastFetchTs > 5 * 60 * 1000) fetchArtworks();
  });

  fetchArtworks();
})();
