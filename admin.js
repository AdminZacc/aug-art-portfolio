/* Admin upload + minimal auth (email/password) for Supabase */
(function() {
  let supa, session;
  const cfg = window.SUPABASE_CONFIG;
  const loginForm = document.getElementById('loginForm');
  const loginStatus = document.getElementById('loginStatus');
  const connTestBtn = document.getElementById('connTestBtn');
  const connStatus = document.getElementById('connStatus');
  const logoutBtn = document.getElementById('logoutBtn');
  const authPanel = document.getElementById('authPanel');
  const uploadPanel = document.getElementById('uploadPanel');
  const artForm = document.getElementById('artForm');
  const formStatus = document.getElementById('formStatus');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const previewWrap = document.getElementById('previewWrap');
  const extUrlInput = document.getElementById('extUrl');
  const clearImageBtn = document.getElementById('clearImageBtn');
  const maxDimInput = document.getElementById('maxDim');
  const qualityInput = document.getElementById('quality');
  const skipOptimizeChk = document.getElementById('skipOptimize');
  const progressWrap = document.getElementById('uploadProgressWrap');
  const progressBar = document.getElementById('uploadProgressBar');
  const progressText = document.getElementById('uploadProgressText');

  if (!cfg || !cfg.url || !cfg.anonKey) {
    if (loginStatus) loginStatus.textContent = 'Missing config.js';
    return;
  }
  supa = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true } });

  function set(el, msg) { if (el) el.textContent = msg || ''; }
  function esc(s){ return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

  function toggleAuthUI() {
    const authed = !!session;
    
    // Hide/show main dashboard elements
    const dashboardNav = document.querySelector('.dashboard-nav');
    const overviewTab = document.getElementById('overview-tab');
    const galleryTab = document.getElementById('gallery-tab');
    const settingsTab = document.getElementById('settings-tab');
    
    if (dashboardNav) dashboardNav.style.display = authed ? 'flex' : 'none';
    if (overviewTab) overviewTab.style.display = authed ? 'block' : 'none';
    if (galleryTab) galleryTab.style.display = authed ? 'block' : 'none';
    if (settingsTab) settingsTab.style.display = authed ? 'block' : 'none';
    
    // Handle auth panel visibility
    authPanel.hidden = authed;
    uploadPanel.hidden = !authed;
    logoutBtn.hidden = !authed;
    
    // Update upload tab visibility
    const uploadTab = document.getElementById('upload-tab');
    if (uploadTab) {
      if (authed) {
        uploadTab.style.display = 'block';
        // Show the upload panel, hide auth panel within upload tab
        if (authPanel) authPanel.style.display = 'none';
        if (uploadPanel) uploadPanel.style.display = 'block';
      } else {
        uploadTab.style.display = 'block'; // Keep visible to show auth form
        if (authPanel) authPanel.style.display = 'block';
        if (uploadPanel) uploadPanel.style.display = 'none';
      }
    }
    
    // Redirect if not authenticated to central auth page
    if (!authed) {
      // Defer a tick so initial DOM paints
      setTimeout(()=>{
        if (!location.pathname.endsWith('/auth.html')) {
          window.location.href = './auth.html';
        }
      }, 0);
    }
  }

  async function refreshSession() {
    const { data } = await supa.auth.getSession();
    session = data.session;
    toggleAuthUI();
    if (session) {
      // Load overview by default, but defer to avoid race conditions
      setTimeout(() => loadOverview(), 100);
    }
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    set(loginStatus, 'Signing in...');
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    try {
      const { error } = await supa.auth.signInWithPassword({ email, password });
      if (error) throw error;
      set(loginStatus, 'Signed in.');
      await refreshSession();
    } catch(err) {
      console.error(err);
      set(loginStatus, err.message || 'Failed.');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await supa.auth.signOut();
    session = null;
    toggleAuthUI();
  });

  // Connection test
  if (connTestBtn) {
    connTestBtn.addEventListener('click', async () => {
      if (!cfg || !cfg.url || !cfg.anonKey) { set(connStatus,'Missing config.js'); return; }
      set(connStatus, 'Testing...');
      connTestBtn.disabled = true;
      const t0 = performance.now();
      try {
        const { data, error } = await supa.from('artworks').select('id').limit(1);
        const ms = Math.round(performance.now() - t0);
        if (error) throw error;
        set(connStatus, `OK (${ms} ms${data && data.length ? ', 1+ rows' : ''})`);
      } catch (err) {
        console.error(err);
        set(connStatus, (err.message||'Error').slice(0,120));
      } finally {
        connTestBtn.disabled = false;
      }
    });
  }

  artForm.addEventListener('submit', async e => {
    e.preventDefault();
    set(formStatus, 'Uploading...');
    const fd = new FormData(artForm);
    const title = fd.get('title').toString().trim();
    const description = fd.get('description').toString().trim();
    const extUrl = fd.get('image_url').toString().trim();
    const file = fd.get('file');

    if (!title) { set(formStatus,'Title required'); return; }

    try {
      let image_url = extUrl;
      if (file && file.size) {
        let uploadFile = file;
        if (!skipOptimizeChk.checked) {
          try {
            startProgress('Optimizing', 5);
            uploadFile = await optimizeImage(file);
          } catch (optErr) {
            console.warn('Optimization failed, using original', optErr);
          }
        }
        startProgress('Uploading', 15);
        const path = `${Date.now()}-${(uploadFile.name || file.name).replace(/[^a-zA-Z0-9._-]/g,'_')}`;
        const { data: up, error: upErr } = await uploadWithProgress(path, uploadFile);
        if (upErr) throw upErr;
        const { data: pub } = supa.storage.from('artworks').getPublicUrl(up.path);
        image_url = pub.publicUrl;
      }
      const { error: insertErr } = await supa.from('artworks').insert({ title, description, image_url });
      if (insertErr) throw insertErr;
      set(formStatus, 'Saved ✓');
      artForm.reset();
      clearPreview();
      finishProgress();
      // Refresh gallery view if currently active
      if (document.getElementById('gallery-tab')?.classList.contains('active')) {
        loadGalleryView();
      }
      // Update overview if currently active
      if (document.getElementById('overview-tab')?.classList.contains('active')) {
        loadOverview();
      }
    } catch(err) {
      console.error(err);
      set(formStatus, err.message || 'Error');
      finishProgress(true);
    }
  });

  function clearPreview(){
    previewWrap.innerHTML='';
    previewWrap.hidden = true;
  }

  function showPreviewFromFile(file) {
    if (!file) { clearPreview(); return; }
    const url = URL.createObjectURL(file);
    previewWrap.hidden = false;
    previewWrap.innerHTML = `<div class="preview-item"><img src="${url}" alt="Preview"><div class="meta"><span>${(file.size/1024).toFixed(1)} KB</span></div></div>`;
  }

  function showPreviewFromExternal(url) {
    if (!url) { if (!fileInput.files.length) clearPreview(); return; }
    if (fileInput.files.length) return; // file takes precedence
    previewWrap.hidden = false;
    previewWrap.innerHTML = `<div class="preview-item"><img src="${url}" alt="Preview from URL" referrerpolicy="no-referrer"><div class="meta"><span>External</span></div></div>`;
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) {
      extUrlInput.value='';
      showPreviewFromFile(file);
    } else {
      clearPreview();
      showPreviewFromExternal(extUrlInput.value.trim());
    }
  });

  extUrlInput.addEventListener('input', () => {
    if (fileInput.files.length) return; // ignore if file chosen
    const val = extUrlInput.value.trim();
    if (/^https?:\/\//i.test(val)) {
      showPreviewFromExternal(val);
    } else if (!val) {
      clearPreview();
    }
  });

  clearImageBtn.addEventListener('click', () => {
    fileInput.value='';
    extUrlInput.value='';
    clearPreview();
  });

  // Drag & drop
  ['dragenter','dragover'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); if (ev==='drop') handleDrop(e); dropZone.classList.remove('dragover'); }));

  function handleDrop(e){
    const files = e.dataTransfer.files;
    if (!files || !files.length) return;
    fileInput.files = files; // assign
    fileInput.dispatchEvent(new Event('change'));
  }

  async function optimizeImage(file) {
    const processable = /^image\/(jpe?g|png|webp)$/i.test(file.type);
    if (!processable) return file; // Skip GIF/SVG/others
    const maxDim = Math.min(6000, Math.max(256, parseInt(maxDimInput.value,10) || 1600));
    let quality = parseFloat(qualityInput.value);
    if (isNaN(quality) || quality < 0.4 || quality > 1) quality = 0.8;
    const bmp = await createImageBitmap(file);
    const { width, height } = bmp;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = targetW; canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, targetW, targetH);
    // Decide output format; prefer WebP unless original is JPEG and near-target size
    let outType = 'image/webp';
    if (file.type === 'image/jpeg' && scale === 1) outType = 'image/jpeg';
    const blob = await new Promise((res, rej) => canvas.toBlob(b => b?res(b):rej(new Error('Blob failed')), outType, quality));
    const newNameBase = file.name.replace(/\.[^.]+$/, '');
    const ext = outType === 'image/webp' ? '.webp' : '.jpg';
    return new File([blob], newNameBase + ext, { type: outType, lastModified: Date.now() });
  }

  function startProgress(label, minDurationMs=10) {
    progressWrap.hidden = false;
    setProgress(5, label);
    progressWrap.dataset.start = Date.now();
    progressWrap.dataset.min = minDurationMs;
  }
  function setProgress(pct, label) {
    progressBar.style.width = pct + '%';
    progressText.textContent = (label? label+ ' ' : '') + Math.min(100, Math.round(pct)) + '%';
  }
  function finishProgress(error=false) {
    if (progressWrap.hidden) return;
    setProgress(error?100:100, error? 'Error' : 'Done');
    setTimeout(() => { progressWrap.hidden = true; setProgress(0,''); }, 800);
  }
  async function uploadWithProgress(path, file) {
    // Real progress using direct XHR to Supabase Storage REST endpoint.
    // Ensure we have latest session for bearer token.
    if (!session) {
      const { data } = await supa.auth.getSession();
      session = data.session;
    }
    return new Promise((resolve, reject) => {
      const baseUrl = cfg.url.replace(/\/$/, '');
      const bucket = 'artworks';
      const url = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${path}?upsert=false`;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('apikey', cfg.anonKey);
      if (session && session.access_token) {
        xhr.setRequestHeader('authorization', 'Bearer ' + session.access_token);
      }
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
          const pct = 5 + (e.loaded / e.total) * 90; // reserve a little headroom
            setProgress(pct, 'Uploading');
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setProgress(97, 'Finalizing');
          let json;
            try { json = JSON.parse(xhr.responseText || '{}'); } catch { json = {}; }
          resolve({ data: json, error: null });
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };
      xhr.send(file);
    });
  }

  refreshSession();

  // Dashboard functionality
  window.switchTab = function(tabName) {
    // Update nav buttons
    document.querySelectorAll('.dashboard-nav button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.toggle('active', tab.id === `${tabName}-tab`);
    });
    
    // Load tab-specific content
    if (tabName === 'overview') loadOverview();
    else if (tabName === 'gallery') loadGalleryView();
    else if (tabName === 'settings') loadSettings();
  };

  async function loadOverview() {
    try {
      const { data: artworks } = await supa.from('artworks').select('*');
      const totalCount = artworks?.length || 0;
      
      // Calculate storage usage (rough estimate)
      let storageUsed = 0;
      if (artworks) {
        artworks.forEach(art => {
          if (art.image_url && art.image_url.includes('supabase')) {
            storageUsed += 500; // Rough estimate of 500KB per image
          }
        });
      }
      
      // Recent uploads (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentCount = artworks?.filter(art => 
        new Date(art.created_at) > weekAgo
      ).length || 0;
      
      // Update stats
      document.getElementById('total-artworks').textContent = totalCount;
      document.getElementById('storage-used').textContent = `${(storageUsed/1024).toFixed(1)} MB`;
      document.getElementById('recent-uploads').textContent = recentCount;
      
      // Test connection for status
      await testConnectionStatus();
      
      // Update activity feed
      updateActivityFeed(artworks);
    } catch (error) {
      console.error('Overview load error:', error);
    }
  }

  async function testConnectionStatus() {
    try {
      const start = Date.now();
      const { data } = await supa.from('artworks').select('id').limit(1);
      const latency = Date.now() - start;
      document.getElementById('connection-status').textContent = `${latency}ms`;
    } catch (error) {
      document.getElementById('connection-status').textContent = 'Error';
    }
  }

  function updateActivityFeed(artworks) {
    const activityContainer = document.getElementById('recent-activity');
    if (!artworks || artworks.length === 0) {
      activityContainer.innerHTML = `
        <div class="activity-item">
          <div class="activity-icon">📝</div>
          <div class="activity-content">
            <div class="activity-title">No artworks yet</div>
            <div class="activity-meta">Start by uploading your first artwork</div>
          </div>
        </div>
      `;
      return;
    }
    
    // Sort by creation date and take last 5
    const recent = artworks
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
    
    activityContainer.innerHTML = recent.map(art => `
      <div class="activity-item">
        <div class="activity-icon">🎨</div>
        <div class="activity-content">
          <div class="activity-title">Uploaded "${esc(art.title)}"</div>
          <div class="activity-meta">${formatDate(art.created_at)}</div>
        </div>
      </div>
    `).join('');
  }

  async function loadGalleryView() {
    const grid = document.getElementById('artworkGrid');
    grid.innerHTML = '<p style="color:var(--text-dim);grid-column:1/-1;text-align:center;padding:2rem;">Loading...</p>';
    
    try {
      const { data: artworks, error } = await supa.from('artworks').select('*').order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (!artworks || artworks.length === 0) {
        grid.innerHTML = `
          <div style="grid-column:1/-1;text-align:center;padding:3rem;">
            <h4 style="margin:0 0 1rem;color:var(--text-dim);">No artworks yet</h4>
            <button class="btn" onclick="switchTab('upload')">📤 Upload Your First Artwork</button>
          </div>
        `;
        return;
      }
      
      grid.innerHTML = artworks.map(art => `
        <div class="artwork-card">
          <img src="${esc(art.image_url)}" alt="${esc(art.title)}" loading="lazy" />
          <div class="artwork-card-body">
            <h4 class="artwork-card-title">${esc(art.title)}</h4>
            <p class="artwork-card-desc">${esc(art.description || 'No description')}</p>
            <div class="artwork-card-meta">Created: ${formatDate(art.created_at)}</div>
            <div class="artwork-card-actions">
              <button class="btn" onclick="editArtwork(${art.id})">✏️ Edit</button>
              <button class="btn danger" onclick="deleteArtworkCard(${art.id}, this)">🗑️ Delete</button>
            </div>
          </div>
        </div>
      `).join('');
    } catch (error) {
      grid.innerHTML = `<p style="color:#ff6b6b;grid-column:1/-1;text-align:center;">Error: ${error.message}</p>`;
    }
  }

  function loadSettings() {
    const userEmail = session?.user?.email || 'Not signed in';
    document.getElementById('user-email').textContent = userEmail;
  }

  window.refreshGallery = loadGalleryView;
  window.testConnection = async function() {
    connTestBtn.disabled = true;
    connTestBtn.textContent = 'Testing...';
    set(connStatus, '⏳ Testing...');
    
    try {
      const start = Date.now();
      const { data, error } = await supa.from('artworks').select('id').limit(1);
      const elapsed = Date.now() - start;
      
      if (error) throw error;
      
      set(connStatus, `✅ OK (${elapsed}ms)`);
      await testConnectionStatus(); // Update overview if visible
    } catch (error) {
      set(connStatus, `❌ ${error.message}`);
    } finally {
      connTestBtn.disabled = false;
      connTestBtn.textContent = 'Test Supabase';
    }
  };

  // Edit artwork functionality
  window.editArtwork = async function(id) {
    try {
      const { data: artwork, error } = await supa.from('artworks').select('*').eq('id', id).single();
      
      if (error) throw error;
      
      document.getElementById('editId').value = artwork.id;
      document.getElementById('editTitle').value = artwork.title;
      document.getElementById('editDescription').value = artwork.description || '';
      
      document.getElementById('editModal').classList.add('active');
    } catch (error) {
      alert('Error loading artwork: ' + error.message);
    }
  };

  window.closeEditModal = function() {
    document.getElementById('editModal').classList.remove('active');
  };

  // Edit form submission
  document.getElementById('editForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('editId').value;
    const title = document.getElementById('editTitle').value;
    const description = document.getElementById('editDescription').value;
    
    try {
      const { error } = await supa.from('artworks').update({
        title,
        description
      }).eq('id', id);
      
      if (error) throw error;
      
      closeEditModal();
      if (document.getElementById('gallery-tab').classList.contains('active')) {
        loadGalleryView();
      }
      if (document.getElementById('overview-tab').classList.contains('active')) {
        loadOverview();
      }
    } catch (error) {
      alert('Error updating artwork: ' + error.message);
    }
  });

  window.deleteArtworkCard = async function(id, btn) {
    if (!confirm('Delete this artwork? This cannot be undone.')) return;
    
    const card = btn.closest('.artwork-card');
    btn.disabled = true;
    btn.textContent = '...';
    
    try {
      const { error } = await supa.from('artworks').delete().eq('id', id);
      
      if (error) throw error;
      
      card.remove();
      
      // Update overview if visible
      if (document.getElementById('overview-tab').classList.contains('active')) {
        loadOverview();
      }
    } catch (error) {
      alert('Error deleting artwork: ' + error.message);
      btn.disabled = false;
      btn.textContent = '🗑️ Delete';
    }
  };

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  // Tab navigation
  document.querySelectorAll('.dashboard-nav button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Load overview by default
  setTimeout(() => {
    if (session) loadOverview();
  }, 100);
})();
