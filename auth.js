(function(){
  const cfg = window.SUPABASE_CONFIG;
  const set = (el,msg)=>{ if(el) el.textContent = msg||''; };
  if (!cfg || !cfg.url || !cfg.anonKey) {
    console.warn('Missing config.js');
    return;
  }
  const supa = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true } });

  // Tabs
  const tabs = [
    { btn: 'tabSignIn', pane: 'paneSignIn' },
    { btn: 'tabSignUp', pane: 'paneSignUp' },
    { btn: 'tabMagic', pane: 'paneMagic' },
    { btn: 'tabReset', pane: 'paneReset' },
  ];
  function showPane(id){
    tabs.forEach(t=>{
      const b = document.getElementById(t.btn);
      const p = document.getElementById(t.pane);
      const active = t.pane === id;
      if (b) { b.classList.toggle('active', active); b.setAttribute('aria-selected', active?'true':'false'); }
      if (p) p.hidden = !active;
    });
  }
  tabs.forEach(t=>{
    const b = document.getElementById(t.btn);
    b && b.addEventListener('click', ()=> showPane(t.pane));
  });
  showPane('paneSignIn');

  // Sign In
  const signinForm = document.getElementById('signinForm');
  const signinStatus = document.getElementById('signinStatus');
  signinForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    set(signinStatus,'Signing in...');
    const email = document.getElementById('signinEmail').value.trim();
    const password = document.getElementById('signinPassword').value;
    try {
      const { error } = await supa.auth.signInWithPassword({ email, password });
      if (error) throw error;
      set(signinStatus, 'Signed in ✓');
      setTimeout(()=>{ window.location.href = './admin.html'; }, 500);
    } catch (err) {
      console.error(err);
      set(signinStatus, err.message || 'Failed');
    }
  });

  // Sign Up
  const signupForm = document.getElementById('signupForm');
  const signupStatus = document.getElementById('signupStatus');
  signupForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    set(signupStatus,'Creating account...');
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    try {
      const { error } = await supa.auth.signUp({ email, password });
      if (error) throw error;
      set(signupStatus, 'Check your email to verify, then sign in.');
      showPane('paneSignIn');
    } catch (err) {
      console.error(err);
      set(signupStatus, err.message || 'Failed');
    }
  });

  // Magic Link
  const magicForm = document.getElementById('magicForm');
  const magicStatus = document.getElementById('magicStatus');
  magicForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    set(magicStatus,'Sending magic link...');
    const email = document.getElementById('magicEmail').value.trim();
    try {
      const { error } = await supa.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/aug-art-portfolio/admin.html' } });
      if (error) throw error;
      set(magicStatus, 'Check your email for the link.');
    } catch (err) {
      console.error(err);
      set(magicStatus, err.message || 'Failed');
    }
  });

  // Reset Password
  const resetForm = document.getElementById('resetForm');
  const resetStatus = document.getElementById('resetStatus');
  resetForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    set(resetStatus,'Sending reset email...');
    const email = document.getElementById('resetEmail').value.trim();
    try {
      const { error } = await supa.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/aug-art-portfolio/auth.html' });
      if (error) throw error;
      set(resetStatus, 'If the email exists, a reset link has been sent.');
    } catch (err) {
      console.error(err);
      set(resetStatus, err.message || 'Failed');
    }
  });
})();
