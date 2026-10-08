import { categories, products } from './catalog.js';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
let service, serviceError, currentUser = null, profile = null, authMode = 'signin', sessionReady = false, busy = false, profileError = null, category = 'all';
let sessionGeneration = 0;
const views = ['home', 'auth', 'age', 'shop', 'about', 'contact', 'account'];
let wantedRoute = 'shop';
const firebaseReady = import('./firebase-service.js').then(module => {
  service = module;
  service.watchSession(async user => {
    // Form handlers finish profile writes before routing; ignore overlapping
    // profile loads from auth notifications while a form is being submitted.
    if (busy) { currentUser = user; return; }
    const generation = ++sessionGeneration;
    currentUser = user;
    profile = null;
    profileError = null;
    sessionReady = false;
    if (user) {
      try { profile = await service.getProfile(user); }
      catch (error) { profileError = error; }
    }
    if (generation !== sessionGeneration) return;
    sessionReady = true;
    updateAccount();
    if (!busy) route();
  });
  return module;
}).catch(error => {
  serviceError = error;
  sessionReady = true;
  if (location.hash === '#shop' || location.hash === '#account' || location.hash === '#auth') route();
  return null;
});

function authError(error) {
  const messages = {
    'auth/invalid-credential': 'The email or password is incorrect. Please try again.',
    'auth/invalid-login-credentials': 'The email or password is incorrect. Please try again.',
    'auth/wrong-password': 'The email or password is incorrect. Please try again.',
    'auth/user-not-found': 'The email or password is incorrect. Please try again.',
    'auth/email-already-in-use': 'An account already uses that email. Sign in or reset your password.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Please use a stronger password that meets your Firebase password policy.',
    'auth/password-does-not-meet-requirements': 'Please use a stronger password that meets your Firebase password policy.',
    'auth/operation-not-allowed': 'Email/password sign-in is not enabled yet. Please contact Tactical Aminos.',
    'auth/unauthorized-domain': 'This website address needs to be authorized in Firebase Authentication.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
    'auth/network-request-failed': 'Unable to connect. Check your internet connection and try again.',
    'permission-denied': 'Your account is signed in, but the member profile could not be saved or read. Please contact Tactical Aminos.',
    'unavailable': 'The account database is temporarily unavailable. Please try again.'
  };
  return messages[error?.code] || 'Account service unavailable. Check your connection and reload the page.';
}
function message(id, text, success = false) {
  $(id).textContent = text;
  $(id).classList.toggle('success', success);
}
function showView(view) {
  for (const key of views) $(key + 'View').hidden = key !== view;
  document.querySelectorAll('[data-route]').forEach(link => link.classList.toggle('active', link.dataset.route === view));
  const titles = { home: 'Research. Innovation. Results.', auth: 'Member access', shop: 'Research catalog', about: 'About', contact: 'Contact', account: 'My account', age: 'Member confirmation' };
  document.title = `Tactical Aminos | ${titles[view]}`;
}
function route() {
  const key = location.hash.slice(1) || 'home';
  if (key === 'shop' || key === 'account') {
    wantedRoute = key;
    if (!sessionReady) { showView('auth'); message('authMessage', 'Connecting to your account…'); return; }
    if (!currentUser) { showView('auth'); message('authMessage', serviceError ? authError(serviceError) : ''); return; }
    if (!profile?.ageConfirmed) { showView('age'); message('ageMessage', profileError ? authError(profileError) : ''); return; }
  }
  if (key === 'auth' && currentUser && sessionReady) {
    showView(profile?.ageConfirmed ? 'account' : 'age');
    if (profileError) message('ageMessage', authError(profileError));
    return;
  }
  showView(views.includes(key) ? key : 'home');
}
function updateAccount() {
  $('accountButton').textContent = currentUser ? 'My account ↗' : 'Member sign in ↗';
  $('signOutButton').hidden = !currentUser;
  $('accountName').textContent = profile?.name || currentUser?.displayName || 'member';
  $('accountEmail').textContent = currentUser?.email || '';
}
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  $('authHeading').textContent = signup ? 'Your next discovery.' : 'Welcome back.';
  $('authIntro').textContent = signup ? 'Create your member account. No application required.' : 'Sign in to access your account and the catalog.';
  $('signInTab').classList.toggle('active', !signup);
  $('signUpTab').classList.toggle('active', signup);
  for (const id of ['nameField', 'confirmField', 'ageField']) $(id).hidden = !signup;
  $('fullName').required = signup;
  $('confirmPassword').required = signup;
  $('ageConfirmed').required = signup;
  for (const id of ['fullName', 'confirmPassword', 'ageConfirmed']) $(id).disabled = !signup;
  $('password').autocomplete = signup ? 'new-password' : 'current-password';
  $('submitButton').textContent = signup ? 'Create account →' : 'Sign in →';
  $('resetPasswordButton').hidden = signup;
  message('authMessage', '');
}
function setBusy(value) {
  busy = value;
  for (const id of ['submitButton', 'signInTab', 'signUpTab', 'resetPasswordButton']) $(id).disabled = value;
  $('submitButton').textContent = value ? 'Please wait…' : authMode === 'signup' ? 'Create account →' : 'Sign in →';
}
async function requireService() {
  await firebaseReady;
  if (!service) throw serviceError;
  return service;
}
$('authForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const name = $('fullName').value.trim(), email = $('email').value.trim(), password = $('password').value;
  if (authMode === 'signup' && !name) return message('authMessage', 'Please enter your full name.');
  if (authMode === 'signup' && password !== $('confirmPassword').value) return message('authMessage', 'Your passwords do not match.');
  if (authMode === 'signup' && !$('ageConfirmed').checked) return message('authMessage', 'Please confirm you are 21 or older and accept research-only access.');
  setBusy(true);
  message('authMessage', '');
  try {
    const api = await requireService();
    if (authMode === 'signup') {
      currentUser = await api.signup(name, email, password);
      profile = await api.confirmMembership(currentUser);
    } else {
      currentUser = (await api.login(email, password)).user;
      profile = await api.getProfile(currentUser);
    }
    profileError = null;
    sessionReady = true;
    $('password').value = '';
    $('confirmPassword').value = '';
    updateAccount();
    location.hash = wantedRoute;
    route();
  } catch (error) {
    sessionReady = true;
    updateAccount();
    message('authMessage', authError(error));
  } finally { setBusy(false); }
});
$('ageForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentUser || !$('existingAgeConfirmed').checked || busy) return;
  const button = event.currentTarget.querySelector('button');
  busy = true;
  button.disabled = true;
  try {
    profile = await (await requireService()).confirmMembership(currentUser);
    profileError = null;
    updateAccount();
    location.hash = wantedRoute;
    route();
  } catch (error) { message('ageMessage', authError(error)); }
  finally { busy = false; button.disabled = false; }
});
$('resetPasswordButton').addEventListener('click', async () => {
  const email = $('email').value.trim();
  if (!email || !$('email').checkValidity()) return message('authMessage', 'Enter your email address above, then select Forgot your password.');
  setBusy(true);
  try {
    await (await requireService()).resetPassword(email);
    message('authMessage', 'If an account exists for that email, a password-reset link will be sent. Check your inbox and spam folder.', true);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') message('authMessage', 'If an account exists for that email, a password-reset link will be sent.', true);
    else message('authMessage', authError(error));
  } finally { setBusy(false); }
});
$('signOutButton').addEventListener('click', async () => {
  try {
    await (await requireService()).logout();
    currentUser = null;
    profile = null;
    $('productDialog').close();
    updateAccount();
    location.hash = 'home';
    route();
  } catch (error) { showView('auth'); message('authMessage', authError(error)); }
});
$('accountButton').addEventListener('click', () => { location.hash = currentUser ? 'account' : 'auth'; route(); });
$('signInTab').addEventListener('click', () => setAuthMode('signin'));
$('signUpTab').addEventListener('click', () => setAuthMode('signup'));
$('passwordToggle').addEventListener('click', () => {
  const show = $('password').type === 'password';
  $('password').type = show ? 'text' : 'password';
  $('passwordToggle').textContent = show ? 'Hide' : 'Show';
  $('passwordToggle').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  $('passwordToggle').setAttribute('aria-pressed', String(show));
});
document.querySelectorAll('[data-open-shop]').forEach(button => button.addEventListener('click', () => { location.hash = 'shop'; route(); }));
window.addEventListener('hashchange', () => { route(); window.scrollTo({ top: 0, behavior: 'instant' }); });

function vial(product) {
  const title = product.name.length > 19 ? 'RESEARCH BLEND' : product.name;
  return `<svg class="vial-illustration" viewBox="0 0 300 260" aria-hidden="true"><defs><linearGradient id="glass-${product.id}" x1="0" x2="1"><stop stop-color="#fff" stop-opacity=".35"/><stop offset=".3" stop-color="#fff" stop-opacity=".85"/><stop offset=".65" stop-color="#b3c8f0" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity=".85"/></linearGradient></defs><ellipse cx="150" cy="236" rx="65" ry="11" fill="#163987" opacity=".18"/><rect x="119" y="29" width="62" height="40" rx="8" fill="#a5b6d5"/><rect x="112" y="20" width="76" height="23" rx="5" fill="#1648ed"/><path d="M119 65q-19 13-19 35v117q0 13 13 13h74q13 0 13-13V100q0-22-19-35Z" fill="url(#glass-${product.id})" stroke="#bacce9" stroke-width="2"/><rect x="101" y="104" width="98" height="99" rx="3" fill="#fff"/><text x="150" y="123" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="900" fill="#1a2440">TACTICAL</text><text x="150" y="137" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="900" fill="#1648ed">AMINOS</text><path d="M111 146h78" stroke="#1648ed"/><text x="150" y="167" text-anchor="middle" font-family="Arial,sans-serif" font-size="${title.length > 12 ? 9 : 17}" font-weight="900" fill="#151b2c">${escape(title)}</text><rect x="113" y="174" width="74" height="18" rx="3" fill="#1648ed"/><text x="150" y="187" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#fff">${escape(product.strength)}</text><rect x="101" y="199" width="98" height="10" fill="#133087"/></svg>`;
}
function renderProducts() {
  const query = $('productSearch').value.trim().toLowerCase();
  const filtered = products.filter(product => (category === 'all' || product.category === category) && `${product.name} ${product.strength}`.toLowerCase().includes(query));
  $('productCount').textContent = `${filtered.length} products`;
  $('emptySearch').hidden = filtered.length !== 0;
  $('productGrid').innerHTML = filtered.map(product => `<article class="product-card"><div class="product-art">${vial(product)}<span class="strength-tag">${escape(product.strength)}</span><span class="stock-tag">Stock pending</span></div><div class="product-copy"><p class="eyebrow">${escape(categories.find(item => item.id === product.category).name)}</p><h2>${escape(product.name)} <span>${escape(product.strength)}</span></h2><p class="product-description">Product description coming soon.</p><div class="product-card-bottom"><strong>${money(product.price)}</strong><button class="button button-small" data-product-id="${product.id}">View product</button></div></div></article>`).join('');
  $('categoryButtons').innerHTML = categories.map(item => `<button class="chip ${category === item.id ? 'selected' : ''}" data-category="${item.id}" aria-pressed="${category === item.id}">${escape(item.name)}</button>`).join('');
}
$('categoryButtons').addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  category = button.dataset.category;
  renderProducts();
});
$('productSearch').addEventListener('input', renderProducts);
$('productGrid').addEventListener('click', event => {
  const button = event.target.closest('[data-product-id]');
  if (!button || !currentUser || !profile?.ageConfirmed) return;
  const product = products.find(item => item.id === button.dataset.productId);
  $('productDialogContent').innerHTML = `<div class="dialog-art">${vial(product)}</div><p class="eyebrow">TACTICAL AMINOS · RESEARCH CATALOG</p><h2>${escape(product.name)}</h2><p>${escape(product.strength)} · ${money(product.price)}</p><p class="muted">Product description and inventory coming soon.</p><button class="button full-width" disabled>Ordering coming soon</button><p class="dialog-disclaimer">For laboratory research only. Not intended for human or animal use.</p>`;
  $('productDialog').showModal();
});
$('closeProductDialog').addEventListener('click', () => $('productDialog').close());
$('productDialog').addEventListener('click', event => { if (event.target === $('productDialog')) $('productDialog').close(); });
$('year').textContent = new Date().getFullYear();
setAuthMode('signin');
renderProducts();
route();
