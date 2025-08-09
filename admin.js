/* Admin Dashboard with CRUD operations for Supabase art portfolio */
(function() {
  let supa, session;
  const cfg = window.SUPABASE_CONFIG;
  
  // Dashboard Elements
  const dashboardNav = document.getElementById('dashboardNav');
  const authSection = document.getElementById('authSection');
  const logoutBtn = document.getElementById('logoutBtn');
  
  // Panel Elements
  const overviewPanel = document.getElementById('overviewPanel');
  const uploadPanel = document.getElementById('uploadPanel');
  const galleryPanel = document.getElementById('galleryPanel');
  const settingsPanel = document.getElementById('settingsPanel');
  const editModal = document.getElementById('editModal');
  
  // Auth Form Elements
  const authForm = document.getElementById('authForm');
  const authStatus = document.getElementById('authStatus');
  const signupBtn = document.getElementById('signupBtn');
  const magicLinkBtn = document.getElementById('magicLinkBtn');
  const resetPasswordBtn = document.getElementById('resetPasswordBtn');
  
  // Upload Form Elements
  const uploadForm = document.getElementById('uploadForm');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const progressContainer = document.getElementById('progressContainer');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const previewContainer = document.getElementById('previewContainer');
  const preview = document.getElementById('preview');
  
  // Gallery Elements
  const galleryGrid = document.getElementById('galleryGrid');
  const galleryLoading = document.getElementById('galleryLoading');
  const galleryEmpty = document.getElementById('galleryEmpty');
  const searchArtworks = document.getElementById('searchArtworks');
  const sortBy = document.getElementById('sortBy');
  const refreshGallery = document.getElementById('refreshGallery');
  
  // Edit Modal Elements
  const editForm = document.getElementById('editForm');
  const closeEdit = document.getElementById('closeEdit');
  const cancelEdit = document.getElementById('cancelEdit');
  
  // Settings Elements
  const userEmail = document.getElementById('userEmail');
  const lastSignIn = document.getElementById('lastSignIn');
  const clearCache = document.getElementById('clearCache');
  const optimizeStorage = document.getElementById('optimizeStorage');
  const signOut = document.getElementById('signOut');

  if (!cfg || !cfg.url || !cfg.anonKey) {
    if (authStatus) authStatus.textContent = 'Missing Supabase configuration';
    return;
  }
  
  supa = window.supabase.createClient(cfg.url, cfg.anonKey, { 
    auth: { persistSession: true } 
  });

  // Utility functions
  function showStatus(element, message, type = 'info') {
    if (!element) return;
    element.textContent = message;
    element.className = `status ${type}`;
    setTimeout(() => {
      element.textContent = '';
      element.className = 'status';
    }, 5000);
  }
  
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
  
  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Dashboard Navigation
  function showPanel(panelName) {
    // Hide all panels
    [overviewPanel, uploadPanel, galleryPanel, settingsPanel].forEach(panel => {
      if (panel) panel.hidden = true;
    });
    
    // Remove active state from all nav buttons
    document.querySelectorAll('.dashboard-nav button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Show selected panel and activate nav button
    switch(panelName) {
      case 'overview':
        if (overviewPanel) overviewPanel.hidden = false;
        if (document.getElementById('navOverview')) document.getElementById('navOverview').classList.add('active');
        loadOverviewData();
        break;
      case 'upload':
        if (uploadPanel) uploadPanel.hidden = false;
        if (document.getElementById('navUpload')) document.getElementById('navUpload').classList.add('active');
        break;
      case 'gallery':
        if (galleryPanel) galleryPanel.hidden = false;
        if (document.getElementById('navGallery')) document.getElementById('navGallery').classList.add('active');
        loadGalleryData();
        break;
      case 'settings':
        if (settingsPanel) settingsPanel.hidden = false;
        if (document.getElementById('navSettings')) document.getElementById('navSettings').classList.add('active');
        loadSettingsData();
        break;
    }
  }

  // Make showPanel globally available for onclick handlers
  window.showPanel = showPanel;

  // Authentication handling
  function toggleAuthUI() {
    const authenticated = !!session;
    
    if (authSection) authSection.hidden = authenticated;
    if (dashboardNav) dashboardNav.hidden = !authenticated;
    if (logoutBtn) logoutBtn.hidden = !authenticated;
    
    if (authenticated) {
      showPanel('overview');
    }
  }

  async function refreshSession() {
    try {
      const { data: { session: currentSession } } = await supa.auth.getSession();
      session = currentSession;
      toggleAuthUI();
      return session;
    } catch (error) {
      console.error('Session refresh error:', error);
      if (authStatus) showStatus(authStatus, 'Authentication error', 'error');
      return null;
    }
  }

  // Overview Panel Functions
  async function loadOverviewData() {
    try {
      const { data: artworks, error } = await supa
        .from('artworks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Update stats
      const totalArtworks = artworks.length;
      const recentUploads = artworks.filter(art => {
        const createdDate = new Date(art.created_at);
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return createdDate > monthAgo;
      }).length;

      const totalSize = artworks.reduce((sum, art) => sum + (art.file_size || 0), 0);
      const avgSize = totalArtworks > 0 ? totalSize / totalArtworks : 0;

      document.getElementById('totalArtworks').textContent = totalArtworks;
      document.getElementById('storageUsed').textContent = formatFileSize(totalSize);
      document.getElementById('recentUploads').textContent = recentUploads;
      document.getElementById('avgFileSize').textContent = formatFileSize(avgSize);

      // Show recent activity
      const recentActivity = document.getElementById('recentActivity');
      if (recentActivity) {
        recentActivity.innerHTML = artworks.slice(0, 6).map(artwork => `
          <div class="artwork-card">
            <img src="${artwork.image_url}" alt="${artwork.title}" loading="lazy">
            <div class="artwork-card-content">
              <h3>${artwork.title}</h3>
              <p>${artwork.medium || 'Unknown medium'}</p>
              <p>${formatDate(artwork.created_at)}</p>
            </div>
          </div>
        `).join('');
      }

    } catch (error) {
      console.error('Error loading overview:', error);
    }
  }

  // Gallery Panel Functions
  async function loadGalleryData() {
    if (galleryLoading) galleryLoading.hidden = false;
    if (galleryEmpty) galleryEmpty.hidden = true;
    if (galleryGrid) galleryGrid.innerHTML = '';

    try {
      const { data: artworks, error } = await supa
        .from('artworks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (galleryLoading) galleryLoading.hidden = true;

      if (artworks.length === 0) {
        if (galleryEmpty) galleryEmpty.hidden = false;
        return;
      }

      if (galleryGrid) {
        galleryGrid.innerHTML = artworks.map(artwork => `
          <div class="artwork-card" data-id="${artwork.id}">
            <img src="${artwork.image_url}" alt="${artwork.title}" loading="lazy">
            <div class="artwork-card-content">
              <h3>${artwork.title}</h3>
              <p>${artwork.medium || 'Unknown medium'}</p>
              <p>${artwork.year || 'Unknown year'}</p>
              <p>${artwork.dimensions || ''}</p>
              <div class="artwork-card-actions">
                <button class="edit-btn" onclick="editArtwork('${artwork.id}')">✏️ Edit</button>
                <button class="delete-btn" onclick="deleteArtwork('${artwork.id}')">🗑️ Delete</button>
              </div>
            </div>
          </div>
        `).join('');
      }

    } catch (error) {
      console.error('Error loading gallery:', error);
      if (galleryLoading) galleryLoading.hidden = true;
      if (galleryEmpty) galleryEmpty.hidden = false;
    }
  }

  // Settings Panel Functions
  function loadSettingsData() {
    if (session && session.user) {
      if (userEmail) userEmail.textContent = session.user.email || 'Unknown';
      if (lastSignIn) lastSignIn.textContent = formatDate(session.user.last_sign_in_at || session.user.created_at);
    }
  }

  // Upload Functions
  function optimizeImage(file, maxDimension = 1920, quality = 0.85) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        const { width, height } = img;
        let { width: newWidth, height: newHeight } = img;

        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          newWidth = width * ratio;
          newHeight = height * ratio;
        }

        canvas.width = newWidth;
        canvas.height = newHeight;
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        canvas.toBlob(resolve, 'image/jpeg', quality);
      };

      img.src = URL.createObjectURL(file);
    });
  }

  // CRUD Operations
  async function editArtwork(id) {
    try {
      const { data: artwork, error } = await supa
        .from('artworks')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Populate edit form
      document.getElementById('editId').value = artwork.id;
      document.getElementById('editTitle').value = artwork.title || '';
      document.getElementById('editMedium').value = artwork.medium || '';
      document.getElementById('editYear').value = artwork.year || '';
      document.getElementById('editDimensions').value = artwork.dimensions || '';
      document.getElementById('editDescription').value = artwork.description || '';
      document.getElementById('editPreview').src = artwork.image_url;

      if (editModal) editModal.hidden = false;

    } catch (error) {
      console.error('Error loading artwork for edit:', error);
      alert('Error loading artwork details');
    }
  }

  async function deleteArtwork(id) {
    if (!confirm('Are you sure you want to delete this artwork?')) return;

    try {
      const { error } = await supa
        .from('artworks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadGalleryData();
      loadOverviewData();

    } catch (error) {
      console.error('Error deleting artwork:', error);
      alert('Error deleting artwork');
    }
  }

  // Make CRUD functions globally available
  window.editArtwork = editArtwork;
  window.deleteArtwork = deleteArtwork;

  // Event Listeners
  document.addEventListener('DOMContentLoaded', () => {
    // Navigation buttons
    document.getElementById('navOverview')?.addEventListener('click', () => showPanel('overview'));
    document.getElementById('navUpload')?.addEventListener('click', () => showPanel('upload'));
    document.getElementById('navGallery')?.addEventListener('click', () => showPanel('gallery'));
    document.getElementById('navSettings')?.addEventListener('click', () => showPanel('settings'));

    // Auth form
    authForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        const { error } = await supa.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        showStatus(authStatus, 'Signed in successfully!', 'success');
      } catch (error) {
        showStatus(authStatus, error.message, 'error');
      }
    });

    // Upload form
    uploadForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const title = document.getElementById('title').value;
      const medium = document.getElementById('medium').value;
      const year = document.getElementById('year').value;
      const dimensions = document.getElementById('dimensions').value;
      const description = document.getElementById('description').value;
      const imageUrl = document.getElementById('imageUrl').value;
      const file = fileInput?.files[0];

      if (!title) {
        alert('Title is required');
        return;
      }

      if (!file && !imageUrl) {
        alert('Please select a file or provide an image URL');
        return;
      }

      try {
        if (progressContainer) progressContainer.hidden = false;
        
        let finalImageUrl = imageUrl;
        let fileSize = 0;

        if (file) {
          const optimizedFile = await optimizeImage(file);
          fileSize = optimizedFile.size;
          
          const fileName = `artwork_${Date.now()}_${file.name}`;
          
          // Upload file to Supabase Storage
          const { data, error: uploadError } = await supa.storage
            .from('artworks')
            .upload(fileName, optimizedFile, {
              onUploadProgress: (progress) => {
                const percent = (progress.loaded / progress.total) * 100;
                if (progressFill) progressFill.style.width = `${percent}%`;
                if (progressText) progressText.textContent = `${Math.round(percent)}%`;
              }
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supa.storage
            .from('artworks')
            .getPublicUrl(fileName);
          
          finalImageUrl = publicUrl;
        }

        const { error } = await supa
          .from('artworks')
          .insert({
            title,
            medium,
            year: year ? parseInt(year) : null,
            dimensions,
            description,
            image_url: finalImageUrl,
            file_size: fileSize
          });

        if (error) throw error;

        uploadForm.reset();
        if (progressContainer) progressContainer.hidden = true;
        if (previewContainer) previewContainer.hidden = true;
        
        alert('Artwork uploaded successfully!');
        
        if (galleryPanel && !galleryPanel.hidden) loadGalleryData();
        if (overviewPanel && !overviewPanel.hidden) loadOverviewData();

      } catch (error) {
        console.error('Upload error:', error);
        alert('Upload failed: ' + error.message);
        if (progressContainer) progressContainer.hidden = true;
      }
    });

    // Edit form
    editForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = document.getElementById('editId').value;
      const title = document.getElementById('editTitle').value;
      const medium = document.getElementById('editMedium').value;
      const year = document.getElementById('editYear').value;
      const dimensions = document.getElementById('editDimensions').value;
      const description = document.getElementById('editDescription').value;

      try {
        const { error } = await supa
          .from('artworks')
          .update({
            title,
            medium,
            year: year ? parseInt(year) : null,
            dimensions,
            description
          })
          .eq('id', id);

        if (error) throw error;

        if (editModal) editModal.hidden = true;
        loadGalleryData();
        loadOverviewData();

      } catch (error) {
        console.error('Update error:', error);
        alert('Update failed: ' + error.message);
      }
    });

    // File input and drag & drop
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (preview) preview.src = e.target.result;
          if (previewContainer) previewContainer.hidden = false;
        };
        reader.readAsDataURL(file);
      }
    });

    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      
      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find(file => file.type.startsWith('image/'));
      
      if (imageFile && fileInput) {
        const dt = new DataTransfer();
        dt.items.add(imageFile);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change'));
      }
    });

    dropZone?.addEventListener('click', () => fileInput?.click());

    // Modal controls
    closeEdit?.addEventListener('click', () => {
      if (editModal) editModal.hidden = true;
    });

    cancelEdit?.addEventListener('click', () => {
      if (editModal) editModal.hidden = true;
    });

    // Modal backdrop click and escape key handling
    editModal?.addEventListener('click', (e) => {
      if (e.target === editModal) {
        editModal.hidden = true;
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && editModal && !editModal.hidden) {
        editModal.hidden = true;
      }
    });

    // Settings controls
    signOut?.addEventListener('click', async () => {
      await supa.auth.signOut();
    });

    logoutBtn?.addEventListener('click', async () => {
      await supa.auth.signOut();
    });

    clearCache?.addEventListener('click', () => {
      if (confirm('Clear all cached data?')) {
        localStorage.clear();
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
          });
        }
        alert('Cache cleared');
      }
    });

    refreshGallery?.addEventListener('click', loadGalleryData);

    // Search and sort
    searchArtworks?.addEventListener('input', debounce(() => {
      // TODO: Implement search filtering
    }, 300));

    sortBy?.addEventListener('change', () => {
      // TODO: Implement sorting
    });

    // Auth state listener
    supa.auth.onAuthStateChange((event, newSession) => {
      session = newSession;
      toggleAuthUI();
    });

    // Initialize
    refreshSession();
  });

  // Utility function for debouncing
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

})();
