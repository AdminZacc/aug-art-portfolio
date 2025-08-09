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
    console.error('Supabase config missing:', cfg);
    if (authStatus) authStatus.textContent = 'Missing Supabase configuration';
    return;
  }
  
  console.log('Initializing Supabase client with config:', { url: cfg.url, hasAnonKey: !!cfg.anonKey });
  
  supa = window.supabase.createClient(cfg.url, cfg.anonKey, { 
    auth: { persistSession: true } 
  });

  // Storage helpers
  function buildPublicUrl(path) {
    const { data } = supa.storage.from('artworks').getPublicUrl(path);
    return data?.publicUrl;
  }

  async function uploadWithProgress(path, file, onProgress) {
    const { data: sess } = await supa.auth.getSession();
    const token = sess?.session?.access_token;
    return new Promise((resolve, reject) => {
      const base = cfg.url.replace(/\/+$/, '');
      const url = `${base}/storage/v1/object/artworks/${encodeURIComponent(path)}`;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', cfg.anonKey);
      xhr.setRequestHeader('x-upsert', 'false');
      if (file.type) xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && typeof onProgress === 'function') {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { resolve({ Key: path }); }
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(file);
    });
  }

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
    
    console.log('Toggling auth UI:', { authenticated, session });
    
    if (authSection) authSection.hidden = authenticated;
    if (dashboardNav) dashboardNav.hidden = !authenticated;
    if (logoutBtn) logoutBtn.hidden = !authenticated;
    
    if (authenticated) {
      console.log('User authenticated, showing overview panel');
      showPanel('overview');
    } else {
      console.log('User not authenticated, showing auth section');
    }
  }

  async function refreshSession() {
    try {
      console.log('Refreshing session...');
      const { data: { session: currentSession }, error } = await supa.auth.getSession();
      
      console.log('Session refresh result:', { session: currentSession, error });
      
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
      console.log('Loading overview data...');
      
      // Test storage access (RLS-friendly)
      try {
        const { data: list, error: listErr } = await supa.storage.from('artworks').list('', { limit: 1 });
        if (listErr) {
          console.warn('Storage list error (check bucket/policies):', listErr);
        } else {
          console.log('✅ Storage reachable, sample list:', list);
        }
      } catch (storageError) {
        console.error('Error checking storage:', storageError);
      }
      
      const { data: artworks, error } = await supa
        .from('artworks')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('Artworks query result:', { artworks, error });

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
    console.log('=== EDIT ARTWORK FUNCTION CALLED ===');
    console.log('Artwork ID:', id);
    console.log('Supabase client exists:', !!supa);
    console.log('Session exists:', !!session);
    
    if (!supa) {
      console.error('❌ Supabase client not initialized');
      alert('Error: Database connection not available');
      return;
    }
    
    if (!session) {
      console.error('❌ No active session');
      alert('Error: You must be logged in to edit artwork');
      return;
    }

    try {
      console.log('Making database query for artwork:', id);
      
      const { data: artwork, error } = await supa
        .from('artworks')
        .select('*')
        .eq('id', id)
        .single();

      console.log('Database query response:', { artwork, error });

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      if (!artwork) {
        console.error('No artwork found with ID:', id);
        alert('Artwork not found');
        return;
      }

      console.log('Found artwork:', artwork);

      // Check if edit form elements exist
      const editId = document.getElementById('editId');
      const editTitle = document.getElementById('editTitle');
      const editMedium = document.getElementById('editMedium');
      const editYear = document.getElementById('editYear');
      const editDimensions = document.getElementById('editDimensions');
      const editDescription = document.getElementById('editDescription');
      const editPreview = document.getElementById('editPreview');

      console.log('Edit form elements found:', {
        editId: !!editId,
        editTitle: !!editTitle,
        editMedium: !!editMedium,
        editYear: !!editYear,
        editDimensions: !!editDimensions,
        editDescription: !!editDescription,
        editPreview: !!editPreview
      });

      // Populate edit form
      if (editId) editId.value = artwork.id;
      if (editTitle) editTitle.value = artwork.title || '';
      if (editMedium) editMedium.value = artwork.medium || '';
      if (editYear) editYear.value = artwork.year || '';
      if (editDimensions) editDimensions.value = artwork.dimensions || '';
      if (editDescription) editDescription.value = artwork.description || '';
      if (editPreview && artwork.image_url) editPreview.src = artwork.image_url;

      console.log('Form populated with values');
      console.log('Opening edit modal...');
      
      if (editModal) {
        editModal.hidden = false;
        console.log('✅ Edit modal opened');
      } else {
        console.error('❌ Edit modal element not found');
        alert('Error: Edit modal not available');
      }

    } catch (error) {
      console.error('❌ Error in editArtwork function:', error);
      alert('Error loading artwork details: ' + error.message);
    }
  }

  async function deleteArtwork(id) {
    console.log('=== DELETE ARTWORK FUNCTION CALLED ===');
    console.log('Artwork ID:', id);
    
    if (!confirm('Are you sure you want to delete this artwork?')) {
      console.log('Delete cancelled by user');
      return;
    }

    if (!supa) {
      console.error('❌ Supabase client not initialized');
      alert('Error: Database connection not available');
      return;
    }
    
    if (!session) {
      console.error('❌ No active session');
      alert('Error: You must be logged in to delete artwork');
      return;
    }

    try {
      console.log('Deleting artwork from database...');
      
      const { error } = await supa
        .from('artworks')
        .delete()
        .eq('id', id);

      console.log('Delete response:', { error });

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      console.log('✅ Artwork deleted successfully');
      alert('Artwork deleted successfully!');
      
      // Refresh data
      loadGalleryData();
      loadOverviewData();

    } catch (error) {
      console.error('❌ Error deleting artwork:', error);
      alert('Error deleting artwork: ' + error.message);
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

      console.log('Auth form submitted with email:', email);

      try {
        const { data, error } = await supa.auth.signInWithPassword({ email, password });
        
        console.log('Auth response:', { data, error });
        
        if (error) throw error;
        
        showStatus(authStatus, 'Signed in successfully!', 'success');
      } catch (error) {
        console.error('Auth error:', error);
        showStatus(authStatus, error.message, 'error');
      }
    });

    // Auth option buttons
    signupBtn?.addEventListener('click', async () => {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      if (!email || !password) {
        showStatus(authStatus, 'Please enter email and password', 'error');
        return;
      }
      
      try {
        const { error } = await supa.auth.signUp({ email, password });
        if (error) throw error;
        showStatus(authStatus, 'Check your email for confirmation link', 'success');
      } catch (error) {
        showStatus(authStatus, error.message, 'error');
      }
    });

    magicLinkBtn?.addEventListener('click', async () => {
      const email = document.getElementById('email').value;
      
      if (!email) {
        showStatus(authStatus, 'Please enter your email', 'error');
        return;
      }
      
      try {
        const { error } = await supa.auth.signInWithOtp({ email });
        if (error) throw error;
        showStatus(authStatus, 'Magic link sent to your email', 'success');
      } catch (error) {
        showStatus(authStatus, error.message, 'error');
      }
    });

    resetPasswordBtn?.addEventListener('click', async () => {
      const email = document.getElementById('email').value;
      
      if (!email) {
        showStatus(authStatus, 'Please enter your email', 'error');
        return;
      }
      
      try {
        const { error } = await supa.auth.resetPasswordForEmail(email);
        if (error) throw error;
        showStatus(authStatus, 'Password reset email sent', 'success');
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
        if (progressContainer) {
          progressContainer.hidden = false;
          if (progressFill) progressFill.style.width = '0%';
          if (progressText) progressText.textContent = '0%';
        }

        let finalImageUrl = imageUrl?.trim();
        let fileSize = 0;

        if (file) {
          console.log('Starting file upload process...', file);
          const optimizedBlob = await optimizeImage(file);
          const uploadBlob = optimizedBlob || file;
          fileSize = uploadBlob.size;

          const safeName = file.name.replace(/\s+/g, '_');
          const path = `uploads/${Date.now()}_${safeName}`;
          const typedFile = uploadBlob instanceof File ? uploadBlob : new File([uploadBlob], safeName, { type: uploadBlob.type || 'image/jpeg' });

          await uploadWithProgress(path, typedFile, (pct) => {
            if (progressFill) progressFill.style.width = `${pct}%`;
            if (progressText) progressText.textContent = `${pct}%`;
          });

          finalImageUrl = buildPublicUrl(path);
          console.log('Generated public URL:', finalImageUrl);
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
  if (preview) preview.src = '';
        
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
      console.log('=== EDIT FORM SUBMIT EVENT ===');
      e.preventDefault();
      
      const id = document.getElementById('editId')?.value;
      const title = document.getElementById('editTitle')?.value;
      const medium = document.getElementById('editMedium')?.value;
      const year = document.getElementById('editYear')?.value;
      const dimensions = document.getElementById('editDimensions')?.value;
      const description = document.getElementById('editDescription')?.value;

      console.log('Form values collected:', { id, title, medium, year, dimensions, description });
      
      if (!supa) {
        console.error('❌ Supabase client not initialized');
        alert('Error: Database connection not available');
        return;
      }
      
      if (!session) {
        console.error('❌ No active session');
        alert('Error: You must be logged in to update artwork');
        return;
      }

      if (!id) {
        console.error('❌ No artwork ID found');
        alert('Error: No artwork ID available for update');
        return;
      }

      if (!title) {
        console.error('❌ Title is required');
        alert('Title is required');
        return;
      }

      try {
        const updateData = {
          title,
          medium,
          year: year ? parseInt(year) : null,
          dimensions,
          description
        };
        
        console.log('Updating artwork with data:', updateData);
        console.log('Artwork ID to update:', id);

        const { data, error } = await supa
          .from('artworks')
          .update(updateData)
          .eq('id', id)
          .select();

        console.log('Update database response:', { data, error });

        if (error) {
          console.error('Database update error:', error);
          throw error;
        }

        if (!data || data.length === 0) {
          console.warn('⚠️ No rows were updated - artwork may not exist or no changes made');
          alert('Warning: No changes were made. Please check if the artwork still exists.');
          return;
        }

        console.log('✅ Artwork updated successfully:', data[0]);
        alert('Artwork updated successfully!');

        // Close modal
        if (editModal) {
          editModal.hidden = true;
          console.log('Edit modal closed');
        }
        
        // Refresh the gallery and overview
        console.log('Refreshing gallery and overview data...');
        if (galleryPanel && !galleryPanel.hidden) loadGalleryData();
        if (overviewPanel && !overviewPanel.hidden) loadOverviewData();

      } catch (error) {
        console.error('❌ Update error:', error);
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

    // Show preview when entering a direct image URL
    document.getElementById('imageUrl')?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (!fileInput?.files?.length && /^https?:\/\//i.test(val)) {
        if (preview) preview.src = val;
        if (previewContainer) previewContainer.hidden = false;
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
      console.log('Auth state changed:', { event, newSession });
      session = newSession;
      toggleAuthUI();
    });

    // Initialize
    console.log('Initializing admin panel...');
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

  // Diagnostic function to test CRUD operations
  window.testCRUD = async function() {
    console.log('=== CRUD DIAGNOSTIC TEST ===');
    console.log('Supabase client:', !!supa);
    console.log('Session:', !!session);
    console.log('Session details:', session);
    
    if (!supa) {
      console.error('❌ Supabase client not available');
      return;
    }
    
    if (!session) {
      console.error('❌ No active session');
      return;
    }
    
    try {
      // Test basic query
      console.log('Testing basic artworks query...');
      const { data, error } = await supa
        .from('artworks')
        .select('id, title')
        .limit(5);
      
      console.log('Query result:', { data, error });
      
      if (error) {
        console.error('❌ Database query failed:', error);
        return;
      }
      
      console.log('✅ Database connection working');
      console.log('Available artworks:', data);
      
      // Test functions are available
      console.log('editArtwork function available:', typeof window.editArtwork);
      console.log('deleteArtwork function available:', typeof window.deleteArtwork);
      
    } catch (error) {
      console.error('❌ CRUD test failed:', error);
    }
  };

})();
