/* VentureLens - React SPA (Babel Standalone in-browser JSX) */

// ============================================================
// API UTILITY
// ============================================================
async function apiFetch(path, options = {}) {
  const res = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const err = new Error(data.error || 'Request failed'); err.field = data.field; err.status = res.status; throw err; }
  return data;
}

// ============================================================
// TOAST CONTEXT
// ============================================================
const ToastContext = React.createContext(null);
function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);
  const addToast = React.useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  return (
    React.createElement(ToastContext.Provider, { value: addToast },
      children,
      React.createElement('div', { className: 'toast-container' },
        toasts.map(t => React.createElement('div', { key: t.id, className: 'toast toast-' + t.type }, t.message))
      )
    )
  );
}

// ============================================================
// AUTH CONTEXT
// ============================================================
const AuthContext = React.createContext(null);
function AuthProvider({ children }) {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    apiFetch('/api/auth/me').then(d => setUser(d.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);
  const login = (userData) => setUser(userData);
  const logout = async () => { try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch(e){} setUser(null); navigate('/login'); };
  return React.createElement(AuthContext.Provider, { value: { user, loading, login, logout } }, children);
}

// ============================================================
// ROUTER
// ============================================================
const RouterContext = React.createContext(null);
let _navigate;
function navigate(path) { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); }
_navigate = navigate;
function Router({ children }) {
  const [path, setPath] = React.useState(window.location.pathname);
  React.useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  return React.createElement(RouterContext.Provider, { value: { path, navigate } }, children);
}

// ============================================================
// NAVBAR
// ============================================================
function NavBar() {
  const { user, logout } = React.useContext(AuthContext);
  const { path } = React.useContext(RouterContext);
  if (!user) return null;
  const isFounder = user.role === 'Founder';
  const link = (href, label) => React.createElement('a', { href, className: 'navbar-link' + (path === href ? ' active' : ''), onClick: (e) => { e.preventDefault(); navigate(href); } }, label);
  return React.createElement('nav', { className: 'navbar', role: 'navigation', 'aria-label': 'Main navigation' },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center' } },
      React.createElement('a', { href: '/', className: 'navbar-brand', onClick: (e)=>{ e.preventDefault(); navigate(isFounder?'/dashboard':'/discover'); } }, 'VentureLens'),
      React.createElement('span', { className: 'navbar-tagline' }, 'See Beyond the Pitch')
    ),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
      React.createElement('nav', { className: 'navbar-nav' },
        isFounder ? [
          link('/dashboard', 'Dashboard'),
          link('/profile', 'My Profile'),
          link('/evidence', 'Evidence'),
          link('/questions', 'Questions')
        ] : [
          link('/discover', 'Discover'),
          link('/my-questions', 'My Questions')
        ]
      ),
      React.createElement('span', { className: 'navbar-user' }, user.name),
      React.createElement('button', { className: 'btn-logout', onClick: logout }, 'Sign out')
    )
  );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================
function Spinner() { return React.createElement('div', { className: 'spinner', role: 'status', 'aria-label': 'Loading' }); }
function LoadingState({ message = 'Loading...' }) { return React.createElement('div', { className: 'loading-state' }, React.createElement(Spinner), message); }
function EmptyState({ icon, title, text, action }) { return React.createElement('div', { className: 'empty-state' }, icon && React.createElement('div', { className: 'empty-state-icon', 'aria-hidden': 'true' }, icon), React.createElement('div', { className: 'empty-state-title' }, title), text && React.createElement('p', { className: 'empty-state-text' }, text), action && React.createElement('div', { style: { marginTop: 16 } }, action)); }
function Badge({ status }) {
  const cls = { 'Open': 'badge-open', 'Answered': 'badge-answered', 'Closed': 'badge-closed', 'Missing': 'badge-missing', 'Provided': 'badge-provided', 'Awaiting Review': 'badge-awaiting', 'Outdated': 'badge-outdated', 'Published': 'badge-published', 'Unpublished': 'badge-unpublished' }[status] || '';
  return React.createElement('span', { className: 'badge ' + cls }, status);
}
function FormGroup({ label, error, hint, required, children }) {
  return React.createElement('div', { className: 'form-group' },
    React.createElement('label', { className: 'form-label' }, label, required && React.createElement('span', { className: 'required', 'aria-hidden': 'true' }, '*')),
    children,
    hint && !error && React.createElement('div', { className: 'form-hint' }, hint),
    error && React.createElement('div', { className: 'form-error', role: 'alert' }, error)
  );
}

// ============================================================
// AUTH SCREENS
// ============================================================
function RegisterScreen() {
  const { login } = React.useContext(AuthContext);
  const addToast = React.useContext(ToastContext);
  const [form, setForm] = React.useState({ name: '', email: '', password: '', role: 'Founder' });
  const [errors, setErrors] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setErrors({}); setLoading(true);
    try {
      const data = await apiFetch('/api/auth/register', { method: 'POST', body: form });
      login(data.user);
      navigate(data.user.role === 'Founder' ? '/dashboard' : '/discover');
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
      else addToast(err.message, 'error');
    } finally { setLoading(false); }
  };
  return React.createElement('div', { className: 'auth-page' },
    React.createElement('div', { className: 'auth-card' },
      React.createElement('div', { className: 'auth-logo' }, React.createElement('div', { className: 'auth-logo-text' }, 'VentureLens'), React.createElement('div', { className: 'auth-logo-tagline' }, 'See Beyond the Pitch')),
      React.createElement('h1', { className: 'auth-title' }, 'Create your account'),
      React.createElement('form', { onSubmit: submit, noValidate: true },
        React.createElement(FormGroup, { label: 'Full name', required: true, error: errors.name }, React.createElement('input', { className: 'form-control' + (errors.name ? ' error' : ''), type: 'text', value: form.name, onChange: set('name'), autoComplete: 'name', maxLength: 100 })),
        React.createElement(FormGroup, { label: 'Email address', required: true, error: errors.email }, React.createElement('input', { className: 'form-control' + (errors.email ? ' error' : ''), type: 'email', value: form.email, onChange: set('email'), autoComplete: 'email', maxLength: 254 })),
        React.createElement(FormGroup, { label: 'Password', required: true, error: errors.password, hint: 'At least 8 characters' }, React.createElement('input', { className: 'form-control' + (errors.password ? ' error' : ''), type: 'password', value: form.password, onChange: set('password'), autoComplete: 'new-password', maxLength: 128 })),
        React.createElement(FormGroup, { label: 'I am a', required: true, error: errors.role },
          React.createElement('select', { className: 'form-control', value: form.role, onChange: set('role') },
            React.createElement('option', { value: 'Founder' }, 'Founder — building a startup'),
            React.createElement('option', { value: 'Investor' }, 'Investor — reviewing opportunities')
          )
        ),
        React.createElement('button', { type: 'submit', className: 'btn btn-primary btn-full btn-lg', disabled: loading }, loading ? React.createElement(React.Fragment, null, React.createElement(Spinner), ' Creating account...') : 'Create account')
      ),
      React.createElement('div', { className: 'auth-footer' }, 'Already have an account? ', React.createElement('a', { href: '/login', onClick: (e) => { e.preventDefault(); navigate('/login'); } }, 'Sign in'))
    )
  );
}

function LoginScreen() {
  const { login } = React.useContext(AuthContext);
  const addToast = React.useContext(ToastContext);
  const [form, setForm] = React.useState({ email: '', password: '' });
  const [errors, setErrors] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setErrors({}); setLoading(true);
    try {
      const data = await apiFetch('/api/auth/login', { method: 'POST', body: form });
      login(data.user);
      navigate(data.user.role === 'Founder' ? '/dashboard' : '/discover');
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
      else setErrors({ general: err.message });
    } finally { setLoading(false); }
  };
  return React.createElement('div', { className: 'auth-page' },
    React.createElement('div', { className: 'auth-card' },
      React.createElement('div', { className: 'auth-logo' }, React.createElement('div', { className: 'auth-logo-text' }, 'VentureLens'), React.createElement('div', { className: 'auth-logo-tagline' }, 'See Beyond the Pitch')),
      React.createElement('h1', { className: 'auth-title' }, 'Welcome back'),
      errors.general && React.createElement('div', { className: 'alert alert-error', role: 'alert' }, errors.general),
      React.createElement('form', { onSubmit: submit, noValidate: true },
        React.createElement(FormGroup, { label: 'Email address', required: true, error: errors.email }, React.createElement('input', { className: 'form-control' + (errors.email ? ' error' : ''), type: 'email', value: form.email, onChange: set('email'), autoComplete: 'email', maxLength: 254 })),
        React.createElement(FormGroup, { label: 'Password', required: true, error: errors.password }, React.createElement('input', { className: 'form-control' + (errors.password ? ' error' : ''), type: 'password', value: form.password, onChange: set('password'), autoComplete: 'current-password', maxLength: 128 })),
        React.createElement('button', { type: 'submit', className: 'btn btn-primary btn-full btn-lg', disabled: loading }, loading ? React.createElement(React.Fragment, null, React.createElement(Spinner), ' Signing in...') : 'Sign in')
      ),
      React.createElement('div', { className: 'auth-footer' }, 'New to VentureLens? ', React.createElement('a', { href: '/register', onClick: (e) => { e.preventDefault(); navigate('/register'); } }, 'Create an account'))
    )
  );
}

// ============================================================
// FOUNDER DASHBOARD
// ============================================================
function FounderDashboard() {
  const { user } = React.useContext(AuthContext);
  const addToast = React.useContext(ToastContext);
  const [profile, setProfile] = React.useState(null);
  const [readiness, setReadiness] = React.useState(null);
  const [readinessError, setReadinessError] = React.useState(null);
  const [profileLoading, setProfileLoading] = React.useState(true);
  React.useEffect(() => {
    apiFetch('/api/profiles/mine').then(d => {
      setProfile(d.profile);
      if (d.profile) {
        return apiFetch('/api/readiness/' + d.profile._id).then(r => setReadiness(r)).catch(err => setReadinessError(err.message));
      }
    }).catch(err => addToast(err.message, 'error')).finally(() => setProfileLoading(false));
  }, []);
  if (profileLoading) return React.createElement('div', { className: 'page-container' }, React.createElement(LoadingState));
  return React.createElement('div', { className: 'page-container' },
    React.createElement('div', { className: 'page-header' },
      React.createElement('h1', { className: 'page-title' }, 'Founder Dashboard'),
      React.createElement('p', { className: 'page-subtitle' }, 'Welcome back, ' + user.name + '. Track your fundraising readiness below.')
    ),
    !profile ? React.createElement('div', { className: 'card' },
      React.createElement(EmptyState, { icon: '+', title: 'No business profile yet', text: 'Create your business profile to start tracking readiness.', action: React.createElement('button', { className: 'btn btn-primary', onClick: () => navigate('/profile/new') }, 'Create profile') })
    ) : React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'dashboard-grid' },
        React.createElement('div', { className: 'readiness-widget' },
          readiness ? [
            React.createElement('div', { key: 'score', className: 'readiness-score' }, readiness.completenessPercentage + '%'),
            React.createElement('div', { key: 'label', className: 'readiness-label' }, 'Profile Completeness'),
            React.createElement('div', { key: 'bar', className: 'readiness-bar' }, React.createElement('div', { className: 'readiness-bar-fill', style: { width: readiness.completenessPercentage + '%' } })),
            React.createElement('div', { key: 'formula', className: 'readiness-formula' }, 'Score = ' + readiness.completedCount + ' of ' + readiness.totalSections + ' sections completed')
          ] : readinessError ? React.createElement('div', { className: 'alert alert-error' }, 'Could not load readiness score: ' + readinessError) : React.createElement(Spinner)
        ),
        React.createElement('div', { className: 'card' },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 } },
            React.createElement('h2', { className: 'card-title', style: { marginBottom: 0 } }, profile.businessName),
            React.createElement(Badge, { status: profile.publicationStatus })
          ),
          React.createElement('p', { style: { color: 'var(--color-text-secondary)', fontSize: '0.9rem' } }, profile.description),
          React.createElement('div', { style: { display: 'flex', gap: 10, marginTop: 16 } },
            React.createElement('button', { className: 'btn btn-secondary btn-sm', onClick: () => navigate('/profile') }, 'Edit Profile'),
            React.createElement('button', { className: 'btn btn-secondary btn-sm', onClick: () => navigate('/evidence') }, 'Manage Evidence')
          )
        )
      ),
      readiness && readiness.incompleteItems.length > 0 && React.createElement('div', { className: 'card', style: { marginTop: 0 } },
        React.createElement('h2', { className: 'card-title' }, 'What to complete next'),
        React.createElement('div', { className: 'incomplete-list' },
          readiness.incompleteItems.map(item => React.createElement('div', { key: item.section, className: 'incomplete-item' },
            React.createElement('div', { className: 'incomplete-dot', 'aria-hidden': 'true' }),
            React.createElement('div', null,
              React.createElement('div', { className: 'incomplete-section' }, item.section.replace(/([A-Z])/g, ' ').trim()),
              React.createElement('div', { className: 'incomplete-guidance' }, item.guidance)
            )
          ))
        )
      )
    )
  );
}

// ============================================================
// PROFILE FORM SCREEN
// ============================================================
const PROFILE_FIELDS = [ { key: 'businessName', label: 'Business Name', required: true, maxLength: 200 }, { key: 'description', label: 'Description', required: true, maxLength: 2000, textarea: true }, { key: 'industry', label: 'Industry', maxLength: 200 }, { key: 'stage', label: 'Stage', maxLength: 100 }, { key: 'businessModel', label: 'Business Model', maxLength: 500, textarea: true }, { key: 'problemStatement', label: 'Problem Statement', maxLength: 1000, textarea: true }, { key: 'solutionStatement', label: 'Solution Statement', maxLength: 1000, textarea: true }, { key: 'targetCustomers', label: 'Target Customers', maxLength: 500 }, { key: 'revenueContext', label: 'Revenue Context', maxLength: 500, textarea: true }, { key: 'fundingGoal', label: 'Funding Goal (USD)', type: 'number' }, { key: 'useOfFunds', label: 'Use of Funds', maxLength: 1000, textarea: true }, { key: 'milestones', label: 'Key Milestones', maxLength: 1000, textarea: true } ];
function ProfileFormScreen() {
  const addToast = React.useContext(ToastContext);
  const [profile, setProfile] = React.useState(null);
  const [form, setForm] = React.useState({});
  const [errors, setErrors] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);
  React.useEffect(() => {
    apiFetch('/api/profiles/mine').then(d => {
      setProfile(d.profile);
      if (d.profile) { const f = {}; PROFILE_FIELDS.forEach(pf => f[pf.key] = d.profile[pf.key] != null ? d.profile[pf.key] : ''); setForm(f); }
      else { const f = {}; PROFILE_FIELDS.forEach(pf => f[pf.key] = ''); setForm(f); }
    }).catch(err => addToast(err.message, 'error')).finally(() => setLoading(false));
  }, []);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setErrors({}); setSaving(true);
    try {
      const method = profile ? 'PUT' : 'POST';
      const url = profile ? '/api/profiles/' + profile._id : '/api/profiles';
      const d = await apiFetch(url, { method, body: form });
      setProfile(d.profile); addToast('Profile saved successfully', 'success');
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
      else addToast(err.message, 'error');
    } finally { setSaving(false); }
  };
  const togglePublication = async () => {
    if (!profile) return; setToggling(true);
    try {
      const d = await apiFetch('/api/profiles/' + profile._id + '/toggle-publication', { method: 'PUT' });
      setProfile(d.profile); addToast('Publication status updated', 'success');
    } catch (err) { addToast(err.message, 'error'); } finally { setToggling(false); }
  };
  if (loading) return React.createElement('div', { className: 'page-container' }, React.createElement(LoadingState));
  return React.createElement('div', { className: 'page-container' },
    React.createElement('div', { className: 'page-header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 } },
      React.createElement('div', null,
        React.createElement('h1', { className: 'page-title' }, profile ? 'Edit Business Profile' : 'Create Business Profile'),
        React.createElement('p', { className: 'page-subtitle' }, 'All fields help investors understand your business.')
      ),
      profile && React.createElement('div', { className: 'publication-toggle' },
        React.createElement('span', { className: 'publication-toggle-label' }, 'Status: ', React.createElement(Badge, { status: profile.publicationStatus })),
        React.createElement('button', { className: 'btn btn-sm ' + (profile.publicationStatus === 'Published' ? 'btn-secondary' : 'btn-primary'), onClick: togglePublication, disabled: toggling }, profile.publicationStatus === 'Published' ? 'Unpublish' : 'Publish')
      )
    ),
    React.createElement('div', { className: 'card' },
      React.createElement('form', { onSubmit: submit, noValidate: true },
        PROFILE_FIELDS.map(pf =>
          React.createElement(FormGroup, { key: pf.key, label: pf.label, required: pf.required, error: errors[pf.key] },
            pf.textarea ?
              React.createElement('textarea', { className: 'form-control' + (errors[pf.key] ? ' error' : ''), value: form[pf.key] || '', onChange: set(pf.key), maxLength: pf.maxLength, rows: 3 }) :
              React.createElement('input', { className: 'form-control' + (errors[pf.key] ? ' error' : ''), type: pf.type || 'text', value: form[pf.key] || '', onChange: set(pf.key), maxLength: pf.maxLength })
          )
        ),
        React.createElement('div', { style: { display: 'flex', gap: 10, marginTop: 8 } },
          React.createElement('button', { type: 'submit', className: 'btn btn-primary', disabled: saving }, saving ? React.createElement(React.Fragment, null, React.createElement(Spinner), ' Saving...') : 'Save Profile'),
          React.createElement('button', { type: 'button', className: 'btn btn-ghost', onClick: () => navigate('/dashboard') }, 'Cancel')
        )
      )
    )
  );
}

// ============================================================
// EVIDENCE COVERAGE MAP
// ============================================================
const EVIDENCE_CATEGORIES = ['Financial Documents', 'Legal and Compliance', 'Product and Technology', 'Market Research', 'Team and Operations', 'Customer and Traction', 'Investor Materials'];
const EVIDENCE_STATUSES = ['Missing', 'Provided', 'Awaiting Review', 'Outdated'];
function EvidenceModal({ record, profileId, onSave, onClose }) {
  const [form, setForm] = React.useState(record || { title: '', category: EVIDENCE_CATEGORIES[0], relatedSection: '', description: '', documentReference: '', status: 'Missing' });
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setErrors({}); setSaving(true);
    try {
      const url = record ? '/api/evidence/' + record._id : '/api/evidence';
      const body = record ? form : { ...form, profileId };
      const d = await apiFetch(url, { method: record ? 'PUT' : 'POST', body });
      onSave(d.record, !!record);
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
    } finally { setSaving(false); }
  };
  return React.createElement('div', { className: 'modal-overlay', onClick: (e) => e.target === e.currentTarget && onClose() },
    React.createElement('div', { className: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-title' },
      React.createElement('div', { className: 'modal-header' },
        React.createElement('h2', { id: 'modal-title', className: 'modal-title' }, record ? 'Edit Evidence Record' : 'Add Evidence Record'),
        React.createElement('button', { className: 'modal-close', onClick: onClose, 'aria-label': 'Close' }, 'x')
      ),
      React.createElement('form', { onSubmit: submit },
        React.createElement(FormGroup, { label: 'Title', required: true, error: errors.title }, React.createElement('input', { className: 'form-control' + (errors.title ? ' error' : ''), value: form.title, onChange: set('title'), maxLength: 200 })),
        React.createElement(FormGroup, { label: 'Category', required: true, error: errors.category }, React.createElement('select', { className: 'form-control', value: form.category, onChange: set('category') }, EVIDENCE_CATEGORIES.map(c => React.createElement('option', { key: c, value: c }, c)))),
        React.createElement(FormGroup, { label: 'Related Section', required: true, error: errors.relatedSection }, React.createElement('input', { className: 'form-control' + (errors.relatedSection ? ' error' : ''), value: form.relatedSection, onChange: set('relatedSection'), maxLength: 200 })),
        React.createElement(FormGroup, { label: 'Status', required: true, error: errors.status }, React.createElement('select', { className: 'form-control', value: form.status, onChange: set('status') }, EVIDENCE_STATUSES.map(s => React.createElement('option', { key: s, value: s }, s)))),
        React.createElement(FormGroup, { label: 'Description', error: errors.description }, React.createElement('textarea', { className: 'form-control', value: form.description || '', onChange: set('description'), rows: 3, maxLength: 1000 })),
        React.createElement(FormGroup, { label: 'Document Reference', hint: 'Reference code, filename, or URL — no file uploads in v1', error: errors.documentReference }, React.createElement('input', { className: 'form-control', value: form.documentReference || '', onChange: set('documentReference'), maxLength: 500 })),
        React.createElement('div', { className: 'modal-footer' },
          React.createElement('button', { type: 'button', className: 'btn btn-secondary', onClick: onClose }, 'Cancel'),
          React.createElement('button', { type: 'submit', className: 'btn btn-primary', disabled: saving }, saving ? React.createElement(React.Fragment, null, React.createElement(Spinner), ' Saving...') : 'Save')
        )
      )
    )
  );
}
function EvidenceCoverageMap() {
  const addToast = React.useContext(ToastContext);
  const [profile, setProfile] = React.useState(null);
  const [records, setRecords] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [modal, setModal] = React.useState(null);
  const [confirmDelete, setConfirmDelete] = React.useState(null);
  React.useEffect(() => {
    apiFetch('/api/profiles/mine').then(d => {
      setProfile(d.profile);
      if (d.profile) return apiFetch('/api/evidence/' + d.profile._id).then(r => setRecords(r.records));
    }).catch(e => addToast(e.message, 'error')).finally(() => setLoading(false));
  }, []);
  const onSave = (record, isEdit) => {
    setRecords(prev => isEdit ? prev.map(r => r._id === record._id ? record : r) : [...prev, record]);
    setModal(null); addToast(isEdit ? 'Record updated' : 'Record added', 'success');
  };
  const deleteRecord = async (id) => {
    try { await apiFetch('/api/evidence/' + id, { method: 'DELETE' }); setRecords(prev => prev.filter(r => r._id !== id)); setConfirmDelete(null); addToast('Record deleted', 'success'); }
    catch (err) { addToast(err.message, 'error'); }
  };
  if (loading) return React.createElement('div', { className: 'page-container' }, React.createElement(LoadingState));
  if (!profile) return React.createElement('div', { className: 'page-container' }, React.createElement('div', { className: 'alert alert-error' }, 'Please create your business profile first.'));
  return React.createElement('div', { className: 'page-container' },
    React.createElement('div', { className: 'page-header' },
      React.createElement('h1', { className: 'page-title' }, 'Evidence Coverage Map'),
      React.createElement('p', { className: 'page-subtitle' }, 'Track which claims in your profile have supporting documentation. Evidence records do not constitute independent verification.')
    ),
    EVIDENCE_CATEGORIES.map(cat => {
      const catRecords = records.filter(r => r.category === cat);
      return React.createElement('div', { key: cat, className: 'evidence-category' },
        React.createElement('div', { className: 'evidence-category-header' },
          React.createElement('div', { className: 'evidence-category-title' }, cat),
          React.createElement('div', { className: 'evidence-category-meta' },
            React.createElement('span', { className: 'evidence-count' }, catRecords.length + ' record' + (catRecords.length !== 1 ? 's' : '')),
            React.createElement('button', { className: 'btn btn-sm btn-primary', onClick: () => setModal({ cat }) }, '+ Add Record')
          )
        ),
        catRecords.length === 0 ? React.createElement('div', { style: { padding: '20px 20px', color: 'var(--color-text-secondary)', fontSize: '0.875rem' } }, 'No evidence records in this category.') :
        React.createElement('table', { className: 'evidence-table' },
          React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, 'Title'), React.createElement('th', null, 'Section'), React.createElement('th', null, 'Status'), React.createElement('th', null, 'Actions'))),
          React.createElement('tbody', null, catRecords.map(r =>
            React.createElement('tr', { key: r._id },
              React.createElement('td', null, React.createElement('div', { className: 'evidence-title' }, r.title), r.documentReference && React.createElement('div', { className: 'evidence-docref' }, 'Ref: ' + r.documentReference)),
              React.createElement('td', null, r.relatedSection),
              React.createElement('td', null, React.createElement(Badge, { status: r.status })),
              React.createElement('td', null, React.createElement('div', { className: 'evidence-actions' }, React.createElement('button', { className: 'btn btn-sm btn-secondary', onClick: () => setModal({ record: r }) }, 'Edit'), React.createElement('button', { className: 'btn btn-sm btn-danger', onClick: () => setConfirmDelete(r._id) }, 'Delete')))
            )
          ))
        )
      );
    }),
    modal && React.createElement(EvidenceModal, { record: modal.record, profileId: profile._id, onSave, onClose: () => setModal(null) }),
    confirmDelete && React.createElement('div', { className: 'modal-overlay' }, React.createElement('div', { className: 'modal' },
      React.createElement('div', { className: 'confirm-dialog' },
        React.createElement('p', null, 'Delete this evidence record? This action cannot be undone.'),
        React.createElement('div', { style: { display: 'flex', justifyContent: 'center', gap: 10 } },
          React.createElement('button', { className: 'btn btn-secondary', onClick: () => setConfirmDelete(null) }, 'Cancel'),
          React.createElement('button', { className: 'btn btn-danger', onClick: () => deleteRecord(confirmDelete) }, 'Delete')
        )
      )
    ))
  );
}

// ============================================================
// FOUNDER QUESTION INBOX
// ============================================================
function FounderQuestionInbox() {
  const addToast = React.useContext(ToastContext);
  const [profile, setProfile] = React.useState(null);
  const [questions, setQuestions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [responses, setResponses] = React.useState({});
  const [submitting, setSubmitting] = React.useState({});
  React.useEffect(() => {
    apiFetch('/api/profiles/mine').then(d => {
      setProfile(d.profile);
      if (d.profile) return apiFetch('/api/questions/profile/' + d.profile._id).then(r => setQuestions(r.questions));
    }).catch(e => addToast(e.message, 'error')).finally(() => setLoading(false));
  }, []);
  const respond = async (questionId) => {
    const text = responses[questionId] || '';
    if (!text.trim()) return;
    setSubmitting(s => ({ ...s, [questionId]: true }));
    try {
      const d = await apiFetch('/api/questions/' + questionId + '/respond', { method: 'POST', body: { responseText: text } });
      setQuestions(prev => prev.map(q => q._id === questionId ? d.question : q));
      setResponses(r => ({ ...r, [questionId]: '' }));
      addToast('Response submitted', 'success');
    } catch (err) { addToast(err.message, 'error'); } finally { setSubmitting(s => ({ ...s, [questionId]: false })); }
  };
  const close = async (questionId) => {
    try {
      const d = await apiFetch('/api/questions/' + questionId + '/close', { method: 'POST' });
      setQuestions(prev => prev.map(q => q._id === questionId ? d.question : q));
      addToast('Question closed', 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };
  if (loading) return React.createElement('div', { className: 'page-container' }, React.createElement(LoadingState));
  if (!profile) return React.createElement('div', { className: 'page-container' }, React.createElement('div', { className: 'alert alert-error' }, 'Please create your business profile first.'));
  return React.createElement('div', { className: 'page-container' },
    React.createElement('div', { className: 'page-header' },
      React.createElement('h1', { className: 'page-title' }, 'Question Inbox'),
      React.createElement('p', { className: 'page-subtitle' }, 'Investor questions about ' + profile.businessName + '. Only visible to you and the investor who submitted each question.')
    ),
    questions.length === 0 ? React.createElement(EmptyState, { title: 'No questions yet', text: 'Investors can ask questions once your profile is published.' }) :
    React.createElement('div', { className: 'question-list' },
      questions.map(q => {
        const investorName = (q.investor && q.investor.name) || 'Investor';
        return React.createElement('article', { key: q._id, className: 'question-card' },
          React.createElement('div', { className: 'question-card-header' },
            React.createElement('div', null,
              React.createElement('div', { className: 'question-meta' }, 'From ', React.createElement('strong', null, investorName), ' · ' + new Date(q.createdAt).toLocaleDateString()),
              q.sectionReference && React.createElement('div', { className: 'question-section' }, 'Re: ' + q.sectionReference)
            ),
            React.createElement(Badge, { status: q.status })
          ),
          React.createElement('p', { className: 'question-text' }, q.text),
          q.status === 'Open' && React.createElement('div', { className: 'response-form' },
            React.createElement('div', { className: 'response-form-title' }, 'Your response'),
            React.createElement('textarea', { className: 'form-control', value: responses[q._id] || '', onChange: (e) => setResponses(r => ({ ...r, [q._id]: e.target.value })), maxLength: 2000, rows: 4, placeholder: 'Type your response here...' }),
            React.createElement('div', { className: 'question-card-actions' },
              React.createElement('button', { className: 'btn btn-primary btn-sm', onClick: () => respond(q._id), disabled: submitting[q._id] || !(responses[q._id] || '').trim() }, submitting[q._id] ? React.createElement(React.Fragment, null, React.createElement(Spinner), ' Submitting...') : 'Submit Response'),
              React.createElement('button', { className: 'btn btn-secondary btn-sm', onClick: () => close(q._id) }, 'Close Question')
            )
          ),
          q.status === 'Answered' && React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'question-response' },
              React.createElement('div', { className: 'question-response-label' }, 'Your Response'),
              React.createElement('div', { className: 'question-response-text' }, q.responseText),
              q.responseAt && React.createElement('div', { className: 'question-response-date' }, 'Sent ' + new Date(q.responseAt).toLocaleDateString())
            ),
            React.createElement('div', { className: 'question-card-actions' },
              React.createElement('button', { className: 'btn btn-secondary btn-sm', onClick: () => close(q._id) }, 'Close Question')
            )
          ),
          q.status === 'Closed' && React.createElement('div', { className: 'question-response' }, React.createElement('div', { className: 'question-response-label' }, 'Closed'), q.responseText && React.createElement('div', { className: 'question-response-text' }, q.responseText))
        );
      })
    )
  );
}

// ============================================================
// INVESTOR SCREENS
// ============================================================
function InvestorDiscovery() {
  const addToast = React.useContext(ToastContext);
  const [profiles, setProfiles] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    apiFetch('/api/profiles').then(d => setProfiles(d.profiles)).catch(e => addToast(e.message, 'error')).finally(() => setLoading(false));
  }, []);
  if (loading) return React.createElement('div', { className: 'page-container' }, React.createElement(LoadingState));
  return React.createElement('div', { className: 'page-container' },
    React.createElement('div', { className: 'page-header' },
      React.createElement('h1', { className: 'page-title' }, 'Discover Startups'),
      React.createElement('p', { className: 'page-subtitle' }, 'Browse business profiles made available for investor review. Presence in this directory is not an endorsement.')
    ),
    profiles.length === 0 ? React.createElement(EmptyState, { title: 'No profiles available', text: 'No startup profiles are currently published for investor review.' }) :
    React.createElement('div', { className: 'card-grid' },
      profiles.map(p => React.createElement('article', { key: p._id, className: 'profile-card', onClick: () => navigate('/profiles/' + p._id), role: 'button', tabIndex: 0, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/profiles/' + p._id); } },
        React.createElement('div', { className: 'profile-card-name' }, p.businessName),
        React.createElement('div', { className: 'profile-card-meta' },
          p.industry && React.createElement('span', { className: 'profile-card-tag' }, p.industry),
          p.stage && React.createElement('span', { className: 'profile-card-tag' }, p.stage),
          p.fundingGoal && React.createElement('span', { className: 'profile-card-tag' }, 'Goal: $' + Number(p.fundingGoal).toLocaleString())
        ),
        React.createElement('p', { style: { fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } }, p.description)
      ))
    )
  );
}

function InvestorProfileDetail() {
  const addToast = React.useContext(ToastContext);
  const { path } = React.useContext(RouterContext);
  const profileId = path.split('/').pop();
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [qForm, setQForm] = React.useState({ text: '', sectionReference: '' });
  const [qErrors, setQErrors] = React.useState({});
  const [qSubmitting, setQSubmitting] = React.useState(false);
  React.useEffect(() => {
    apiFetch('/api/profiles/' + profileId).then(d => setProfile(d.profile)).catch(e => { addToast(e.message, 'error'); navigate('/discover'); }).finally(() => setLoading(false));
  }, [profileId]);
  const submitQuestion = async (e) => {
    e.preventDefault(); setQErrors({}); setQSubmitting(true);
    try {
      await apiFetch('/api/questions', { method: 'POST', body: { profileId, text: qForm.text, sectionReference: qForm.sectionReference } });
      setQForm({ text: '', sectionReference: '' });
      addToast('Question submitted successfully', 'success');
    } catch (err) {
      if (err.field) setQErrors({ [err.field]: err.message });
      else addToast(err.message, 'error');
    } finally { setQSubmitting(false); }
  };
  if (loading) return React.createElement('div', { className: 'page-container' }, React.createElement(LoadingState));
  if (!profile) return null;
  const fieldRow = (label, value) => value ? React.createElement('div', { className: 'profile-field' }, React.createElement('div', { className: 'profile-field-label' }, label), React.createElement('div', { className: 'profile-field-value' }, value)) : null;
  return React.createElement('div', { className: 'page-container' },
    React.createElement('button', { className: 'btn btn-ghost btn-sm', onClick: () => navigate('/discover'), style: { marginBottom: 16 } }, 'Back to Discover'),
    React.createElement('div', { className: 'page-header' },
      React.createElement('h1', { className: 'page-title' }, profile.businessName),
      React.createElement('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 } }, profile.industry && React.createElement('span', { className: 'profile-card-tag' }, profile.industry), profile.stage && React.createElement('span', { className: 'profile-card-tag' }, profile.stage))
    ),
    React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'profile-detail-section' }, React.createElement('div', { className: 'profile-detail-section-title' }, 'Overview'), fieldRow('Description', profile.description), fieldRow('Industry', profile.industry), fieldRow('Stage', profile.stage)),
      React.createElement('div', { className: 'profile-detail-section' }, React.createElement('div', { className: 'profile-detail-section-title' }, 'Business'), fieldRow('Business Model', profile.businessModel), fieldRow('Problem', profile.problemStatement), fieldRow('Solution', profile.solutionStatement), fieldRow('Target Customers', profile.targetCustomers)),
      React.createElement('div', { className: 'profile-detail-section' }, React.createElement('div', { className: 'profile-detail-section-title' }, 'Financials and Funding'), fieldRow('Revenue Context', profile.revenueContext), fieldRow('Funding Goal', profile.fundingGoal ? '$' + Number(profile.fundingGoal).toLocaleString() : null), fieldRow('Use of Funds', profile.useOfFunds), fieldRow('Milestones', profile.milestones))
    ),
    React.createElement('div', { className: 'investor-question-form' },
      React.createElement('h3', null, 'Ask a Question'),
      React.createElement('p', { style: { fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 16 } }, 'Your question will only be visible to you and this startup.'),
      React.createElement('form', { onSubmit: submitQuestion, noValidate: true },
        React.createElement(FormGroup, { label: 'Question', required: true, error: qErrors.text }, React.createElement('textarea', { className: 'form-control' + (qErrors.text ? ' error' : ''), value: qForm.text, onChange: (e) => setQForm(f => ({ ...f, text: e.target.value })), maxLength: 1000, rows: 3, placeholder: 'What would you like to know about this startup?' })),
        React.createElement(FormGroup, { label: 'Related Section (optional)', error: qErrors.sectionReference }, React.createElement('input', { className: 'form-control', value: qForm.sectionReference, onChange: (e) => setQForm(f => ({ ...f, sectionReference: e.target.value })), maxLength: 100, placeholder: 'e.g., Revenue Context' })),
        React.createElement('button', { type: 'submit', className: 'btn btn-primary', disabled: qSubmitting || !qForm.text.trim() }, qSubmitting ? React.createElement(React.Fragment, null, React.createElement(Spinner), ' Submitting...') : 'Submit Question')
      )
    )
  );
}

// ============================================================
// INVESTOR QUESTION HISTORY
// ============================================================
function InvestorQuestionHistory() {
  const addToast = React.useContext(ToastContext);
  const [questions, setQuestions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    apiFetch('/api/questions/mine')
      .then(d => setQuestions(d.questions || []))
      .catch(e => addToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const close = async (questionId) => {
    try {
      await apiFetch('/api/questions/' + questionId + '/close', { method: 'POST' });
      setQuestions(prev => prev.map(q => q._id === questionId ? { ...q, status: 'Closed' } : q));
      addToast('Question closed', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  if (loading) return React.createElement('div', { className: 'page-container' }, React.createElement(LoadingState));

  return React.createElement('div', { className: 'page-container' },
    React.createElement('div', { className: 'page-header' },
      React.createElement('h1', { className: 'page-title' }, 'My Questions'),
      React.createElement('p', { className: 'page-subtitle' }, 'Questions you have submitted to startup founders across published profiles.')
    ),
    questions.length === 0 ? React.createElement(EmptyState, { title: 'No questions submitted', text: 'You have not submitted any questions to startups yet.', action: React.createElement('button', { className: 'btn btn-primary', onClick: () => navigate('/discover') }, 'Browse Startups') }) :
    React.createElement('div', { className: 'questions-list' },
      questions.map(q => {
        const startupName = (q.profile && q.profile.businessName) || 'Startup Profile';
        return React.createElement('div', { key: q._id, className: 'question-card' },
          React.createElement('div', { className: 'question-card-header' },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
              React.createElement('span', { className: 'question-investor' }, startupName),
              q.sectionReference && React.createElement('span', { className: 'badge badge-section' }, q.sectionReference)
            ),
            React.createElement(Badge, { status: q.status })
          ),
          React.createElement('div', { className: 'question-text' }, q.text),
          q.status === 'Answered' && React.createElement('div', { className: 'question-response' },
            React.createElement('div', { className: 'question-response-label' }, 'Founder Response'),
            React.createElement('div', { className: 'question-response-text' }, q.responseText),
            q.responseAt && React.createElement('div', { className: 'question-response-date' }, 'Answered ' + new Date(q.responseAt).toLocaleDateString())
          ),
          q.status === 'Open' && React.createElement('div', { className: 'question-no-response', style: { color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: 8 } }, 'No response from founder yet.'),
          q.status === 'Closed' && React.createElement('div', { className: 'question-response' },
            React.createElement('div', { className: 'question-response-label' }, 'Question Closed'),
            q.responseText && React.createElement('div', { className: 'question-response-text' }, q.responseText)
          ),
          q.status !== 'Closed' && React.createElement('div', { className: 'question-card-actions', style: { marginTop: 12 } },
            React.createElement('button', { className: 'btn btn-secondary btn-sm', onClick: () => close(q._id) }, 'Close Question')
          )
        );
      })
    )
  );
}

// ============================================================
// ERROR AND FALLBACK SCREENS
// ============================================================
function NotFoundScreen() {
  const { user } = React.useContext(AuthContext);
  return React.createElement('div', { className: 'page-container' },
    React.createElement(EmptyState, {
      icon: '404',
      title: 'Page Not Found',
      text: 'The page you requested does not exist or has been moved.',
      action: React.createElement('button', { className: 'btn btn-primary', onClick: () => navigate(user ? (user.role === 'Founder' ? '/dashboard' : '/discover') : '/login') }, 'Go to Home')
    })
  );
}

function UnauthorizedScreen() {
  const { user } = React.useContext(AuthContext);
  return React.createElement('div', { className: 'page-container' },
    React.createElement(EmptyState, {
      icon: '403',
      title: 'Access Denied',
      text: 'You do not have permission to view this page with your current account role.',
      action: React.createElement('button', { className: 'btn btn-primary', onClick: () => navigate(user ? (user.role === 'Founder' ? '/dashboard' : '/discover') : '/login') }, 'Go to Dashboard')
    })
  );
}

// ============================================================
// LANDING PAGE (STARTUP MARKETPLACE AESTHETIC)
// ============================================================
function LandingPage() {
  const { user } = React.useContext(AuthContext);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const scrollTo = (id) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    React.createElement('div', { className: 'landing-page' },
      // Navigation Bar
      React.createElement('header', { className: 'landing-nav' },
        React.createElement('div', { className: 'landing-nav-container' },
          React.createElement('a', { href: '/', className: 'landing-brand', onClick: (e) => { e.preventDefault(); scrollTo('hero'); } },
            React.createElement('div', { className: 'landing-brand-logo' }, 'VL'),
            React.createElement('span', { className: 'landing-brand-name' }, 'VentureLens')
          ),
          React.createElement('ul', { className: 'landing-nav-links' },
            React.createElement('li', null, React.createElement('a', { href: '#hero', onClick: (e) => { e.preventDefault(); scrollTo('hero'); } }, 'Home')),
            React.createElement('li', null, React.createElement('a', { href: '#how-it-works', onClick: (e) => { e.preventDefault(); scrollTo('how-it-works'); } }, 'How It Works')),
            React.createElement('li', null, React.createElement('a', { href: '#features', onClick: (e) => { e.preventDefault(); scrollTo('features'); } }, 'Features')),
            React.createElement('li', null, React.createElement('a', { href: '#for-founders', onClick: (e) => { e.preventDefault(); scrollTo('for-founders'); } }, 'For Founders')),
            React.createElement('li', null, React.createElement('a', { href: '#for-investors', onClick: (e) => { e.preventDefault(); scrollTo('for-investors'); } }, 'For Investors'))
          ),
          React.createElement('div', { className: 'landing-nav-actions' },
            user ? (
              React.createElement('button', {
                className: 'btn-nav-signup',
                onClick: () => navigate(user.role === 'Founder' ? '/dashboard' : '/discover')
              }, 'Go to Dashboard →')
            ) : (
              React.createElement(React.Fragment, null,
                React.createElement('a', { href: '/login', className: 'btn-nav-login', onClick: (e) => { e.preventDefault(); navigate('/login'); } }, 'Log In'),
                React.createElement('a', { href: '/register', className: 'btn-nav-signup', onClick: (e) => { e.preventDefault(); navigate('/register'); } }, 'Get Started →')
              )
            ),
            React.createElement('button', {
              className: 'btn-mobile-toggle',
              'aria-label': 'Toggle Menu',
              onClick: () => setMobileMenuOpen(!mobileMenuOpen)
            }, '☰')
          )
        ),
        // Mobile dropdown
        mobileMenuOpen && React.createElement('div', { className: 'landing-mobile-menu open' },
          React.createElement('a', { href: '#hero', onClick: (e) => { e.preventDefault(); scrollTo('hero'); } }, 'Home'),
          React.createElement('a', { href: '#how-it-works', onClick: (e) => { e.preventDefault(); scrollTo('how-it-works'); } }, 'How It Works'),
          React.createElement('a', { href: '#features', onClick: (e) => { e.preventDefault(); scrollTo('features'); } }, 'Features'),
          React.createElement('a', { href: '#for-founders', onClick: (e) => { e.preventDefault(); scrollTo('for-founders'); } }, 'For Founders'),
          React.createElement('a', { href: '#for-investors', onClick: (e) => { e.preventDefault(); scrollTo('for-investors'); } }, 'For Investors'),
          !user ? [
            React.createElement('a', { key: 'm-login', href: '/login', onClick: (e) => { e.preventDefault(); navigate('/login'); } }, 'Log In'),
            React.createElement('a', { key: 'm-reg', href: '/register', onClick: (e) => { e.preventDefault(); navigate('/register'); } }, 'Get Started')
          ] : (
            React.createElement('a', { href: user.role === 'Founder' ? '/dashboard' : '/discover', onClick: (e) => { e.preventDefault(); navigate(user.role === 'Founder' ? '/dashboard' : '/discover'); } }, 'Go to Dashboard')
          )
        )
      ),

      // Hero Section
      React.createElement('section', { id: 'hero', className: 'hero-section' },
        React.createElement('div', { className: 'landing-container' },
          React.createElement('div', { className: 'hero-grid' },
            React.createElement('div', { className: 'hero-content' },
              React.createElement('div', { className: 'hero-eyebrow' },
                React.createElement('span', { className: 'hero-eyebrow-dot' }),
                'A clearer path to fundraising readiness'
              ),
              React.createElement('h1', { className: 'hero-headline' }, 'Your business story deserves more than a pitch.'),
              React.createElement('p', { className: 'hero-supporting' },
                'VentureLens helps founders organize their business information, understand their fundraising readiness, and present supporting evidence—while giving investors a clearer way to explore businesses and ask meaningful questions.'
              ),
              React.createElement('div', { className: 'hero-actions' },
                React.createElement('button', {
                  className: 'btn-hero-primary',
                  onClick: () => navigate(user ? (user.role === 'Founder' ? '/dashboard' : '/discover') : '/register')
                }, 'Get Started →'),
                React.createElement('button', {
                  className: 'btn-hero-secondary',
                  onClick: () => {
                    if (user && user.role === 'Investor') navigate('/discover');
                    else if (user && user.role === 'Founder') navigate('/dashboard');
                    else navigate('/register');
                  }
                }, 'Explore Businesses')
              )
            ),
            // Product Preview Mockup
            React.createElement('div', { className: 'hero-preview' },
              React.createElement('div', { className: 'preview-card' },
                React.createElement('div', { className: 'preview-badge-live' }, '● Live Preview'),
                React.createElement('div', { className: 'preview-header' },
                  React.createElement('div', null,
                    React.createElement('div', { className: 'preview-company-name' }, 'Aura Robotics Inc.'),
                    React.createElement('div', { className: 'preview-meta' }, 'Pre-Seed • Industrial Automation • $1.25M Target')
                  ),
                  React.createElement('span', { className: 'badge badge-published' }, 'Published')
                ),
                React.createElement('div', { className: 'preview-score-box' },
                  React.createElement('div', { className: 'preview-score-header' },
                    React.createElement('span', { className: 'preview-score-title' }, 'Fundraising Readiness Score'),
                    React.createElement('span', { className: 'preview-score-pct' }, '85%')
                  ),
                  React.createElement('div', { className: 'preview-progress-bar' },
                    React.createElement('div', { className: 'preview-progress-fill' })
                  ),
                  React.createElement('div', { className: 'preview-score-sub' }, '11 of 13 Core Diligence Sections Completed')
                ),
                React.createElement('div', { className: 'preview-chips' },
                  React.createElement('span', { className: 'preview-chip done' }, '✓ Problem & Solution'),
                  React.createElement('span', { className: 'preview-chip done' }, '✓ Target Market'),
                  React.createElement('span', { className: 'preview-chip done' }, '✓ Unit Economics'),
                  React.createElement('span', { className: 'preview-chip done' }, '✓ Cap Table'),
                  React.createElement('span', { className: 'preview-chip' }, '⋯ IP Claims (Pending)')
                ),
                React.createElement('div', { className: 'preview-qa-box' },
                  React.createElement('div', { className: 'preview-qa-label' }, 'Direct Diligence Inquiries'),
                  React.createElement('div', { className: 'preview-qa-q' }, 'Q: "Can you detail your unit economics at 5,000 units/mo?"'),
                  React.createElement('div', { className: 'preview-qa-a' }, 'A: "COGS drops from $420 to $185 at volume, delivering a 68% gross margin..."')
                )
              )
            )
          )
        )
      ),

      // Value Proposition Section
      React.createElement('section', { className: 'landing-section' },
        React.createElement('div', { className: 'landing-container' },
          React.createElement('div', { className: 'section-header-center' },
            React.createElement('div', { className: 'section-tag' }, 'Why VentureLens'),
            React.createElement('h2', { className: 'section-title' }, 'Fundraising conversations start with clarity.'),
            React.createElement('p', { className: 'section-subtitle' },
              'Replace scattered pitch decks and disjointed email threads with a standardized due-diligence workspace.'
            )
          ),
          React.createElement('div', { className: 'value-grid' },
            React.createElement('div', { className: 'value-card' },
              React.createElement('div', { className: 'value-icon' }, '📋'),
              React.createElement('h3', { className: 'value-title' }, 'Structured Founder Workspace'),
              React.createElement('p', { className: 'value-desc' },
                'Founders can organize their 13-point business information, evaluate completeness with deterministic readiness scoring, and eliminate guesswork before meeting investors.'
              )
            ),
            React.createElement('div', { className: 'value-card' },
              React.createElement('div', { className: 'value-icon' }, '🔍'),
              React.createElement('h3', { className: 'value-title' }, 'Transparent Business Discovery'),
              React.createElement('p', { className: 'value-desc' },
                'Investors can explore published startup profiles filtered by industry, stage, and funding goals with instant visibility into supporting evidence coverage.'
              )
            ),
            React.createElement('div', { className: 'value-card' },
              React.createElement('div', { className: 'value-icon' }, '💬'),
              React.createElement('h3', { className: 'value-title' }, 'Direct Diligence Q&A'),
              React.createElement('p', { className: 'value-desc' },
                'Both parties can participate in a structured question-and-response workflow tied directly to profile sections, creating a clean audit trail.'
              )
            )
          )
        )
      ),

      // How It Works Section
      React.createElement('section', { id: 'how-it-works', className: 'landing-section how-section' },
        React.createElement('div', { className: 'landing-container' },
          React.createElement('div', { className: 'section-header-center' },
            React.createElement('div', { className: 'section-tag' }, 'Streamlined Journeys'),
            React.createElement('h2', { className: 'section-title' }, 'How VentureLens Works'),
            React.createElement('p', { className: 'section-subtitle' },
              'A purpose-built due diligence workflow designed for founders and investors.'
            )
          ),
          React.createElement('div', { className: 'how-grid' },
            // Founder Track
            React.createElement('div', { className: 'how-track-card' },
              React.createElement('div', { className: 'how-track-badge founder' }, 'For Founders'),
              React.createElement('h3', { className: 'how-track-title' }, 'From Raw Pitch to Diligence Ready'),
              React.createElement('div', { className: 'how-steps-list' },
                React.createElement('div', { className: 'how-step-item' },
                  React.createElement('div', { className: 'how-step-num' }, '1'),
                  React.createElement('div', { className: 'how-step-content' },
                    React.createElement('h4', null, 'Build your business profile'),
                    React.createElement('p', null, 'Fill out 13 structured sections covering problem, solution, market size, business model, and funding requirements.')
                  )
                ),
                React.createElement('div', { className: 'how-step-item' },
                  React.createElement('div', { className: 'how-step-num' }, '2'),
                  React.createElement('div', { className: 'how-step-content' },
                    React.createElement('h4', null, 'Organize readiness and evidence'),
                    React.createElement('p', null, 'Track your readiness score in real-time and map documentary support across legal, financial, and product categories.')
                  )
                ),
                React.createElement('div', { className: 'how-step-item' },
                  React.createElement('div', { className: 'how-step-num' }, '3'),
                  React.createElement('div', { className: 'how-step-content' },
                    React.createElement('h4', null, 'Publish and respond to inquiries'),
                    React.createElement('p', null, 'Toggle public visibility when ready and handle diligence questions from prospective investors in one organized inbox.')
                  )
                )
              )
            ),
            // Investor Track
            React.createElement('div', { className: 'how-track-card' },
              React.createElement('div', { className: 'how-track-badge investor' }, 'For Investors'),
              React.createElement('h3', { className: 'how-track-title' }, 'Efficient Discovery & Deep Diligence'),
              React.createElement('div', { className: 'how-steps-list' },
                React.createElement('div', { className: 'how-step-item' },
                  React.createElement('div', { className: 'how-step-num' }, '1'),
                  React.createElement('div', { className: 'how-step-content' },
                    React.createElement('h4', null, 'Discover published business profiles'),
                    React.createElement('p', null, 'Browse curated startup profiles with instant filtering by sector, stage, and capital need.')
                  )
                ),
                React.createElement('div', { className: 'how-step-item' },
                  React.createElement('div', { className: 'how-step-num' }, '2'),
                  React.createElement('div', { className: 'how-step-content' },
                    React.createElement('h4', null, 'Review available information and evidence'),
                    React.createElement('p', null, 'Inspect comprehensive business claims and check documentary evidence coverage before scheduling calls.')
                  )
                ),
                React.createElement('div', { className: 'how-step-item' },
                  React.createElement('div', { className: 'how-step-num' }, '3'),
                  React.createElement('div', { className: 'how-step-content' },
                    React.createElement('h4', null, 'Ask targeted diligence questions'),
                    React.createElement('p', null, 'Submit structured inquiries tied to specific claims and maintain a complete audit history of answers.')
                  )
                )
              )
            )
          )
        )
      ),

      // Feature Showcase Section
      React.createElement('section', { id: 'features', className: 'landing-section' },
        React.createElement('div', { className: 'landing-container' },
          React.createElement('div', { className: 'section-header-center' },
            React.createElement('div', { className: 'section-tag' }, 'Platform Capabilities'),
            React.createElement('h2', { className: 'section-title' }, 'Built for Due Diligence Excellence'),
            React.createElement('p', { className: 'section-subtitle' },
              'Everything founders and investors need to conduct thorough, organized evaluation.'
            )
          ),
          React.createElement('div', { className: 'features-grid' },
            React.createElement('div', { className: 'feature-card' },
              React.createElement('div', { className: 'feature-icon-box' }, '🎯'),
              React.createElement('h3', { className: 'feature-title' }, 'Fundraising Readiness'),
              React.createElement('p', { className: 'feature-desc' },
                'Understand which profile sections are complete and receive actionable guidance for missing information with a 13-point deterministic scoring model.'
              )
            ),
            React.createElement('div', { className: 'feature-card' },
              React.createElement('div', { className: 'feature-icon-box' }, '📁'),
              React.createElement('h3', { className: 'feature-title' }, 'Evidence Coverage'),
              React.createElement('p', { className: 'feature-desc' },
                'Track supporting documentation across key operational domains and identify missing, outdated, or awaiting-review records without file upload risks.'
              )
            ),
            React.createElement('div', { className: 'feature-card' },
              React.createElement('div', { className: 'feature-icon-box' }, '🌐'),
              React.createElement('h3', { className: 'feature-title' }, 'Business Discovery'),
              React.createElement('p', { className: 'feature-desc' },
                'Explore published startup profiles and find vetted businesses with comprehensive industry, stage, and funding filters.'
              )
            ),
            React.createElement('div', { className: 'feature-card' },
              React.createElement('div', { className: 'feature-icon-box' }, '❓'),
              React.createElement('h3', { className: 'feature-title' }, 'Investor Questions'),
              React.createElement('p', { className: 'feature-desc' },
                'Enable structured questions and responses between investors and founders with distinct Open, Answered, and Closed workflow stages.'
              )
            ),
            React.createElement('div', { className: 'feature-card' },
              React.createElement('div', { className: 'feature-icon-box' }, '⚙️'),
              React.createElement('h3', { className: 'feature-title' }, 'Profile Management'),
              React.createElement('p', { className: 'feature-desc' },
                'Let founders maintain their business information with complete privacy control over when their profile is published or unpublished.'
              )
            ),
            React.createElement('div', { className: 'feature-card' },
              React.createElement('div', { className: 'feature-icon-box' }, '📜'),
              React.createElement('h3', { className: 'feature-title' }, 'Question History'),
              React.createElement('p', { className: 'feature-desc' },
                'Allow users to revisit authorized questions and responses, creating a permanent diligence record for investment evaluation.'
              )
            )
          )
        )
      ),

      // Separate Audience Sections
      React.createElement('section', { className: 'landing-section' },
        React.createElement('div', { className: 'landing-container' },
          React.createElement('div', { className: 'audience-grid' },
            // For Founders
            React.createElement('div', { id: 'for-founders', className: 'audience-card founder' },
              React.createElement('div', null,
                React.createElement('div', { className: 'audience-tag' }, 'Founder Workspace'),
                React.createElement('h3', { className: 'audience-title' }, 'Ready to present your business with confidence?'),
                React.createElement('p', { className: 'audience-desc' },
                  'Present your business clearly, organize supporting information, and understand which parts of your fundraising profile need attention.'
                )
              ),
              React.createElement('button', {
                className: 'btn-audience',
                onClick: () => navigate(user && user.role === 'Founder' ? '/dashboard' : '/register')
              }, 'Build Your Profile →')
            ),
            // For Investors
            React.createElement('div', { id: 'for-investors', className: 'audience-card investor' },
              React.createElement('div', null,
                React.createElement('div', { className: 'audience-tag' }, 'Investor Portal'),
                React.createElement('h3', { className: 'audience-title' }, 'Looking for structured startup diligence?'),
                React.createElement('p', { className: 'audience-desc' },
                  'Explore published businesses, review available information, and start meaningful due-diligence conversations.'
                )
              ),
              React.createElement('button', {
                className: 'btn-audience',
                onClick: () => navigate(user && user.role === 'Investor' ? '/discover' : '/register')
              }, 'Explore Businesses →')
            )
          )
        )
      ),

      // Final Call to Action
      React.createElement('section', { className: 'cta-section' },
        React.createElement('div', { className: 'cta-box' },
          React.createElement('h2', { className: 'cta-headline' }, 'Bring more clarity to your next fundraising conversation.'),
          React.createElement('p', { className: 'cta-sub' },
            'Organize your business information or discover businesses that interest you.'
          ),
          React.createElement('div', { className: 'cta-buttons' },
            React.createElement('button', {
              className: 'btn-hero-primary',
              onClick: () => navigate(user ? (user.role === 'Founder' ? '/dashboard' : '/discover') : '/register')
            }, 'Get Started →'),
            React.createElement('button', {
              className: 'btn-hero-secondary',
              onClick: () => {
                if (user && user.role === 'Investor') navigate('/discover');
                else if (user && user.role === 'Founder') navigate('/dashboard');
                else navigate('/register');
              }
            }, 'Explore Businesses')
          )
        )
      ),

      // Footer
      React.createElement('footer', { className: 'landing-footer' },
        React.createElement('div', { className: 'landing-container' },
          React.createElement('div', { className: 'footer-top' },
            React.createElement('div', { className: 'footer-brand-col' },
              React.createElement('div', { className: 'footer-brand-title' }, 'VentureLens'),
              React.createElement('p', { className: 'footer-desc' },
                'A fundraising-readiness and due-diligence workspace empowering startup founders and angel/seed investors.'
              )
            ),
            React.createElement('div', null,
              React.createElement('div', { className: 'footer-col-title' }, 'Platform'),
              React.createElement('ul', { className: 'footer-links' },
                React.createElement('li', null, React.createElement('a', { href: '#how-it-works', onClick: (e) => { e.preventDefault(); scrollTo('how-it-works'); } }, 'How It Works')),
                React.createElement('li', null, React.createElement('a', { href: '#features', onClick: (e) => { e.preventDefault(); scrollTo('features'); } }, 'Features')),
                React.createElement('li', null, React.createElement('a', { href: '#for-founders', onClick: (e) => { e.preventDefault(); scrollTo('for-founders'); } }, 'For Founders')),
                React.createElement('li', null, React.createElement('a', { href: '#for-investors', onClick: (e) => { e.preventDefault(); scrollTo('for-investors'); } }, 'For Investors'))
              )
            ),
            React.createElement('div', null,
              React.createElement('div', { className: 'footer-col-title' }, 'Account'),
              React.createElement('ul', { className: 'footer-links' },
                React.createElement('li', null, React.createElement('a', { href: '/login', onClick: (e) => { e.preventDefault(); navigate('/login'); } }, 'Sign In')),
                React.createElement('li', null, React.createElement('a', { href: '/register', onClick: (e) => { e.preventDefault(); navigate('/register'); } }, 'Create Account')),
                user && React.createElement('li', null, React.createElement('a', { href: user.role === 'Founder' ? '/dashboard' : '/discover', onClick: (e) => { e.preventDefault(); navigate(user.role === 'Founder' ? '/dashboard' : '/discover'); } }, 'Dashboard'))
              )
            ),
            React.createElement('div', null,
              React.createElement('div', { className: 'footer-col-title' }, 'Capabilities'),
              React.createElement('ul', { className: 'footer-links' },
                React.createElement('li', null, React.createElement('span', { style: { color: '#94a3b8' } }, '13-Point Scoring')),
                React.createElement('li', null, React.createElement('span', { style: { color: '#94a3b8' } }, 'Evidence Mapping')),
                React.createElement('li', null, React.createElement('span', { style: { color: '#94a3b8' } }, 'Direct Diligence Q&A')),
                React.createElement('li', null, React.createElement('span', { style: { color: '#94a3b8' } }, 'RBAC Security'))
              )
            )
          ),
          React.createElement('div', { className: 'footer-bottom' },
            React.createElement('div', null, '© ' + new Date().getFullYear() + ' VentureLens. All rights reserved.'),
            React.createElement('div', null, 'Fundraising Readiness & Due Diligence Platform')
          )
        )
      )
    )
  );
}

// ============================================================
// APPLICATION ROOT & ROUTER GUARD
// ============================================================
function App() {
  const { user, loading } = React.useContext(AuthContext);
  const { path } = React.useContext(RouterContext);

  if (loading) {
    return React.createElement('div', { className: 'app-loading', style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-navy)', color: 'var(--color-white)' } },
      React.createElement(LoadingState, { message: 'Loading VentureLens...' })
    );
  }

  // Public Landing Page at root /
  if (path === '/') {
    return React.createElement(LandingPage);
  }

  // Public unauthenticated auth routes
  if (path === '/login') {
    if (user) {
      navigate(user.role === 'Founder' ? '/dashboard' : '/discover');
      return null;
    }
    return React.createElement(LoginScreen);
  }

  if (path === '/register') {
    if (user) {
      navigate(user.role === 'Founder' ? '/dashboard' : '/discover');
      return null;
    }
    return React.createElement(RegisterScreen);
  }

  // Auth Guard for protected application routes
  if (!user) {
    navigate('/login');
    return null;
  }

  // Role routing
  let content = null;
  const isFounder = user.role === 'Founder';
  const isInvestor = user.role === 'Investor';

  if (path === '/dashboard') {
    content = isFounder ? React.createElement(FounderDashboard) : React.createElement(UnauthorizedScreen);
  } else if (path === '/profile' || path === '/profile/new' || path === '/profile/edit') {
    content = isFounder ? React.createElement(ProfileFormScreen) : React.createElement(UnauthorizedScreen);
  } else if (path === '/evidence') {
    content = isFounder ? React.createElement(EvidenceCoverageMap) : React.createElement(UnauthorizedScreen);
  } else if (path === '/questions') {
    content = isFounder ? React.createElement(FounderQuestionInbox) : React.createElement(UnauthorizedScreen);
  } else if (path === '/discover') {
    content = isInvestor ? React.createElement(InvestorDiscovery) : React.createElement(UnauthorizedScreen);
  } else if (path.startsWith('/profiles/')) {
    content = isInvestor ? React.createElement(InvestorProfileDetail) : React.createElement(UnauthorizedScreen);
  } else if (path === '/my-questions') {
    content = isInvestor ? React.createElement(InvestorQuestionHistory) : React.createElement(UnauthorizedScreen);
  } else if (path === '/unauthorized') {
    content = React.createElement(UnauthorizedScreen);
  } else {
    content = React.createElement(NotFoundScreen);
  }

  return React.createElement('div', { className: 'app-wrapper' },
    React.createElement(NavBar),
    React.createElement('main', { id: 'main-content', role: 'main' }, content)
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  React.createElement(ToastProvider, null,
    React.createElement(Router, null,
      React.createElement(AuthProvider, null,
        React.createElement(App, null)
      )
    )
  )
);

