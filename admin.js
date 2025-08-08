/* Admin upload + minimal auth (email/password) for Supabase */
(function() {
  let supa, session;
  const cfg = window.SUPABASE_CONFIG;
  const loginForm = document.getElementById('loginForm');
  const loginStatus = document.getElementById('loginStatus');
  const logoutBtn = document.getElementById('logoutBtn');
  const authPanel = document.getElementById('authPanel');
  const uploadPanel = document.getElementById('uploadPanel');
  const artForm = document.getElementById('artForm');
  const formStatus = document.getElementById('formStatus');
  const listPanel = document.getElementById('listPanel');
  const listStatus = document.getElementById('listStatus');
  const artTable = document.getElementById('artTable').querySelector('tbody');
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
    authPanel.hidden = authed;
    uploadPanel.hidden = !authed;
    listPanel.hidden = !authed;
    logoutBtn.hidden = !authed;
  }

  async function refreshSession() {
    const { data } = await supa.auth.getSession();
    session = data.session;
    toggleAuthUI();
    if (session) loadArtworks();
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
      loadArtworks();
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

  async function loadArtworks() {
    set(listStatus, 'Loading...');
    const { data, error } = await supa.from('artworks').select('*').order('created_at', { ascending: false });
    if (error) { set(listStatus, 'Failed to load'); return; }
    set(listStatus, data.length ? `${data.length} item(s)` : 'Empty');
    artTable.innerHTML = data.map(row => `<tr data-id="${esc(row.id)}">
      <td style="min-width:140px;">${esc(row.title)}</td>
      <td style="min-width:160px;">${row.image_url ? `<a href="${esc(row.image_url)}" target="_blank" rel="noopener">image</a>`:''}</td>
      <td style="max-width:260px;white-space:pre-wrap;">${esc(row.description||'')}</td>
      <td>${row.created_at ? new Date(row.created_at).toLocaleDateString():''}</td>
      <td class="actions"><button data-act="del" class="btn danger" type="button">Delete</button></td>
    </tr>`).join('');
  }

  artTable.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act="del"]');
    if (!btn) return;
    if (!confirm('Delete this artwork?')) return;
    const tr = btn.closest('tr');
    const id = tr.getAttribute('data-id');
    btn.disabled = true; btn.textContent = '...';
    const { error } = await supa.from('artworks').delete().eq('id', id);
    if (error) { alert(error.message); btn.disabled = false; btn.textContent='Delete'; return; }
    tr.remove();
  });

  refreshSession();
})();
