/**
 * auth.js — Viralify Firebase Authentication
 * ============================================
 * Handles all auth flows: Sign In, Sign Up, Google OAuth,
 * Password Reset, Email Verification, Session Management
 *
 * Dependencies: firebase-app-compat.js, firebase-auth-compat.js (CDN)
 *               firebase-config.js (gitignored, holds real API keys)
 */

// ─────────────────────────────────────────────────────────────
// SECTION 1: Firebase Readiness Check
// Detects whether firebase-config.js has real values configured
// ─────────────────────────────────────────────────────────────

/** @type {boolean} True if Firebase config has been populated with real values */
window.FIREBASE_READY = false;

(function initFirebase() {
  // Check if FIREBASE_CONFIG exists and has real API key
  if (
    typeof FIREBASE_CONFIG === 'undefined' ||
    !FIREBASE_CONFIG.apiKey ||
    FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY'
  ) {
    console.warn('[Viralify Auth] Firebase not configured. Auth disabled.');
    showFirebaseWarning();
    return;
  }

  try {
    // Initialize Firebase App (compat SDK)
    firebase.initializeApp(FIREBASE_CONFIG);

    // Get Auth instance with persistent session (Firebase SDK default)
    window.Auth = firebase.auth();

    // Mark Firebase as ready for other modules to use
    window.FIREBASE_READY = true;

    console.log('[Viralify Auth] Firebase initialized successfully.');

    // Start listening to auth state changes
    setupAuthStateObserver();
  } catch (err) {
    console.error('[Viralify Auth] Firebase initialization failed:', err);
    showFirebaseWarning('Firebase initialization error: ' + err.message);
  }
})();

// ─────────────────────────────────────────────────────────────
// SECTION 2: Auth State Observer
// Central routing logic — determines which view to show
// ─────────────────────────────────────────────────────────────

function setupAuthStateObserver() {
  Auth.onAuthStateChanged(async (user) => {
    if (!user) {
      // No user signed in → show sign in view
      showView('signin');
      return;
    }

    if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
      // Email/password user who hasn't verified their email yet
      // Hard gate: show verification holding screen only
      showVerificationScreen(user.email);
      return;
    }

    // User is signed in and verified (or signed in via Google)
    // Redirect to main dashboard
    console.log('[Viralify Auth] User authenticated:', user.displayName || user.email);
    redirectToDashboard();
  });
}

// ─────────────────────────────────────────────────────────────
// SECTION 3: Authentication Functions
// ─────────────────────────────────────────────────────────────

/**
 * Sign in with Google OAuth (popup, with redirect fallback)
 * Handles both sign-in and sign-up — Firebase creates user if new
 */
async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  // Request email and profile scopes
  provider.addScope('profile');
  provider.addScope('email');

  try {
    const result = await Auth.signInWithPopup(provider);
    const user = result.user;

    // Check if this is a new user (first sign in)
    const isNewUser = result.additionalUserInfo?.isNewUser;
    if (isNewUser) {
      // FR-016: Fresh start — clear anonymous localStorage data
      localStorage.clear();
      console.log('[Viralify Auth] New user — localStorage cleared for fresh start.');
    }

    // onAuthStateChanged will handle redirect
    return { success: true, user };
  } catch (err) {
    console.error('[Viralify Auth] Google sign in error:', err);
    return { success: false, error: firebaseErrorToMessage(err.code, err.message) };
  }
}

/**
 * Sign up with email and password
 * @param {string} name - User's full display name
 * @param {string} email - Email address
 * @param {string} password - Password (validated client-side before calling)
 */
async function signUpWithEmail(name, email, password) {
  try {
    // FR-016: Fresh start — clear any anonymous data before creating account
    localStorage.clear();

    // Create the user account
    const result = await Auth.createUserWithEmailAndPassword(email, password);
    const user = result.user;

    // Set display name from the form
    await user.updateProfile({ displayName: name });

    // FR-018: Send email verification
    await user.sendEmailVerification();

    console.log('[Viralify Auth] Account created for:', email);
    // onAuthStateChanged will show verification screen
    return { success: true, user };
  } catch (err) {
    console.error('[Viralify Auth] Sign up error:', err);
    return { success: false, error: firebaseErrorToMessage(err.code, err.message) };
  }
}

/**
 * Sign in with email and password
 * @param {string} email
 * @param {string} password
 */
async function signInWithEmail(email, password) {
  try {
    const result = await Auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged handles routing
    return { success: true, user: result.user };
  } catch (err) {
    console.error('[Viralify Auth] Sign in error:', err);
    return { success: false, error: firebaseErrorToMessage(err.code, err.message) };
  }
}

/**
 * Send a password reset email
 * @param {string} email
 */
async function sendPasswordReset(email) {
  try {
    await Auth.sendPasswordResetEmail(email);
    return { success: true };
  } catch (err) {
    console.error('[Viralify Auth] Password reset error:', err);
    return { success: false, error: firebaseErrorToMessage(err.code, err.message) };
  }
}

/**
 * Resend verification email to the currently signed-in user
 */
async function resendVerification() {
  const user = Auth.currentUser;
  if (!user) return { success: false, error: 'No user is signed in.' };

  try {
    await user.sendEmailVerification();
    return { success: true };
  } catch (err) {
    console.error('[Viralify Auth] Resend verification error:', err);
    return { success: false, error: firebaseErrorToMessage(err.code, err.message) };
  }
}

/**
 * Sign out the current user and redirect to auth page
 */
async function doSignOut() {
  try {
    await Auth.signOut();
    console.log('[Viralify Auth] User signed out.');
    // Reload to reset state — onAuthStateChanged will show signin view
    window.location.reload();
  } catch (err) {
    console.error('[Viralify Auth] Sign out error:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 4: Error Message Mapper
// Converts Firebase error codes to user-friendly messages
// ─────────────────────────────────────────────────────────────

/**
 * @param {string} code - Firebase error code (e.g. 'auth/wrong-password')
 * @param {string} [fallback] - Raw error message as fallback
 * @returns {string} Human-readable error message
 */
function firebaseErrorToMessage(code, fallback) {
  const errorMap = {
    'auth/email-already-in-use':
      'An account already exists with this email. Please sign in instead.',
    'auth/wrong-password':
      'Incorrect password. Please try again or reset your password.',
    'auth/invalid-credential':
      'Invalid email or password. Please check your credentials and try again.',
    'auth/user-not-found':
      'No account found with this email address. Please sign up first.',
    'auth/weak-password':
      'Password is too weak. Use at least 8 characters with uppercase, numbers, and symbols.',
    'auth/popup-closed-by-user':
      'Sign-in popup was closed. Please try again.',
    'auth/cancelled-popup-request':
      'Sign-in was cancelled. Please try again.',
    'auth/account-exists-with-different-credential':
      'An account already exists with this email using a different sign-in method. Try signing in with Google or email/password instead.',
    'auth/too-many-requests':
      'Too many failed attempts. Your account has been temporarily locked. Please try again later or reset your password.',
    'auth/network-request-failed':
      'Network error. Please check your internet connection and try again.',
    'auth/invalid-email':
      'Please enter a valid email address.',
    'auth/user-disabled':
      'This account has been disabled. Please contact support.',
    'auth/requires-recent-login':
      'This action requires a recent sign-in. Please sign out and sign in again.',
    'auth/popup-blocked':
      'Popup was blocked by your browser. Please allow popups for this site and try again.',
  };

  return errorMap[code] || fallback || 'An unexpected error occurred. Please try again.';
}

// ─────────────────────────────────────────────────────────────
// SECTION 5: View Management
// Smooth fade transitions between Sign In / Sign Up / Forgot / Verify
// ─────────────────────────────────────────────────────────────

/**
 * Switch between auth views with a fade animation
 * @param {'signin' | 'signup' | 'forgot' | 'verify'} viewName
 */
function showView(viewName) {
  const views = document.querySelectorAll('.auth-view');
  views.forEach((v) => v.classList.remove('active'));

  const target = document.getElementById('view-' + viewName);
  if (target) {
    target.classList.add('active');
  }

  // Update page title for accessibility
  const titles = {
    signin: 'Sign In — Viralify',
    signup: 'Create Account — Viralify',
    forgot: 'Reset Password — Viralify',
    verify: 'Verify Email — Viralify',
  };
  document.title = titles[viewName] || 'Viralify';
}

/**
 * Show the email verification holding screen
 * @param {string} email - The email address to display
 */
function showVerificationScreen(email) {
  const badge = document.getElementById('verify-email-display');
  if (badge) badge.textContent = email || '—';
  showView('verify');
}

// ─────────────────────────────────────────────────────────────
// SECTION 6: Password Strength Meter
// ─────────────────────────────────────────────────────────────

/**
 * Calculate password strength score 0–4
 * @param {string} password
 * @returns {{ score: number, level: string }}
 */
function getPasswordStrength(password) {
  if (!password) return { score: 0, level: '' };

  let score = 0;
  if (password.length >= 8) score++;               // Minimum length
  if (/[A-Z]/.test(password)) score++;              // Uppercase
  if (/[0-9]/.test(password)) score++;              // Number
  if (/[^A-Za-z0-9]/.test(password)) score++;       // Special character

  const levels = ['', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  return { score, level: levels[score] };
}

/**
 * Update the visual strength meter segments and label
 * @param {string} password
 */
function updateStrengthMeter(password) {
  const { score, level } = getPasswordStrength(password);
  const segments = ['seg-1', 'seg-2', 'seg-3', 'seg-4'];
  const levelClass = level.toLowerCase().replace(' ', '-');
  const label = document.getElementById('strength-label');

  segments.forEach((id, idx) => {
    const seg = document.getElementById(id);
    if (!seg) return;
    // Remove all level classes
    seg.classList.remove('weak', 'fair', 'strong', 'very-strong');
    // Apply if this segment is within the score
    if (idx < score && levelClass) {
      seg.classList.add(levelClass);
    }
  });

  if (label) {
    label.textContent = level ? `Password strength: ${level}` : '';
    label.className = 'strength-label ' + (levelClass || '');
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 7: Form Validation
// ─────────────────────────────────────────────────────────────

/**
 * Show an inline field error
 * @param {string} errorElementId - ID of the .field-error element
 * @param {string} message - Error message text
 * @param {string} fieldId - ID of the input field to mark as error
 */
function showFieldError(errorElementId, message, fieldId) {
  const errorEl = document.getElementById(errorElementId);
  if (errorEl) {
    errorEl.querySelector('.error-text').textContent = message;
    errorEl.classList.add('visible');
  }
  if (fieldId) {
    const field = document.getElementById(fieldId);
    if (field) field.classList.add('error');
  }
}

/**
 * Clear an inline field error
 * @param {string} errorElementId
 * @param {string} fieldId
 */
function clearFieldError(errorElementId, fieldId) {
  const errorEl = document.getElementById(errorElementId);
  if (errorEl) {
    errorEl.querySelector('.error-text').textContent = '';
    errorEl.classList.remove('visible');
  }
  if (fieldId) {
    const field = document.getElementById(fieldId);
    if (field) field.classList.remove('error');
  }
}

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate password meets minimum requirements
 * @param {string} password
 * @returns {{ valid: boolean, message: string }}
 */
function validatePassword(password) {
  if (password.length < 8) return { valid: false, message: 'Password must be at least 8 characters.' };
  if (!/[A-Z]/.test(password)) return { valid: false, message: 'Add at least one uppercase letter.' };
  if (!/[0-9]/.test(password)) return { valid: false, message: 'Add at least one number.' };
  if (!/[^A-Za-z0-9]/.test(password)) return { valid: false, message: 'Add at least one special character (e.g. !@#$).' };
  return { valid: true, message: '' };
}

// ─────────────────────────────────────────────────────────────
// SECTION 8: Button Loading State Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Set a button to loading state (shows spinner, disables button)
 * @param {HTMLButtonElement} btn
 */
function setLoading(btn) {
  btn.classList.add('loading');
  btn.disabled = true;
}

/**
 * Remove loading state from a button
 * @param {HTMLButtonElement} btn
 */
function clearLoading(btn) {
  btn.classList.remove('loading');
  btn.disabled = false;
}

// ─────────────────────────────────────────────────────────────
// SECTION 9: Redirect Helper
// ─────────────────────────────────────────────────────────────

/** Redirect to the main dashboard */
function redirectToDashboard() {
  window.location.replace('index.html');
}

/** Show Firebase not configured warning banner */
function showFirebaseWarning(message) {
  const el = document.getElementById('firebase-warning');
  if (el) {
    if (message) {
      el.querySelector('div').innerHTML = `<strong>Firebase error:</strong> ${message}`;
    }
    el.classList.add('visible');
  }
  // Still show the sign in view (forms will be non-functional)
  showView('signin');
}

// ─────────────────────────────────────────────────────────────
// SECTION 10: DOM Event Wiring
// Runs after DOM is ready
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // ── Navigation Links ──
  const gotoSignup = document.getElementById('goto-signup');
  const gotoSignin = document.getElementById('goto-signin');
  const gotoSigninFromForgot = document.getElementById('goto-signin-from-forgot');
  const forgotLink = document.getElementById('forgot-link');

  if (gotoSignup) {
    gotoSignup.addEventListener('click', () => showView('signup'));
    gotoSignup.addEventListener('keydown', (e) => { if (e.key === 'Enter') showView('signup'); });
  }
  if (gotoSignin) {
    gotoSignin.addEventListener('click', () => showView('signin'));
    gotoSignin.addEventListener('keydown', (e) => { if (e.key === 'Enter') showView('signin'); });
  }
  if (gotoSigninFromForgot) {
    gotoSigninFromForgot.addEventListener('click', () => showView('signin'));
    gotoSigninFromForgot.addEventListener('keydown', (e) => { if (e.key === 'Enter') showView('signin'); });
  }
  if (forgotLink) {
    forgotLink.addEventListener('click', () => showView('forgot'));
    forgotLink.addEventListener('keydown', (e) => { if (e.key === 'Enter') showView('forgot'); });
  }

  // ── Password Show/Hide Toggles ──
  setupPasswordToggle('signin-password', 'signin-pw-toggle', 'signin-pw-icon');
  setupPasswordToggle('signup-password', 'signup-pw-toggle', 'signup-pw-icon');
  setupPasswordToggle('signup-confirm', 'signup-confirm-toggle', 'signup-confirm-icon');

  function setupPasswordToggle(inputId, btnId, iconId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!btn || !input || !icon) return;

    btn.addEventListener('click', () => {
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      icon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
      btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
  }

  // ── Sign In Form ──
  const signinForm = document.getElementById('signin-form');
  const signinEmail = document.getElementById('signin-email');
  const signinPassword = document.getElementById('signin-password');
  const signinBtn = document.getElementById('signin-btn');

  // Blur validation
  signinEmail?.addEventListener('blur', () => {
    const val = signinEmail.value.trim();
    if (val && !isValidEmail(val)) {
      showFieldError('signin-email-error', 'Please enter a valid email address.', 'signin-email');
    } else {
      clearFieldError('signin-email-error', 'signin-email');
    }
  });

  signinEmail?.addEventListener('input', () => clearFieldError('signin-email-error', 'signin-email'));
  signinPassword?.addEventListener('input', () => clearFieldError('signin-password-error', 'signin-password'));

  signinForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.FIREBASE_READY) return;

    // Clear previous errors
    clearFieldError('signin-email-error', 'signin-email');
    clearFieldError('signin-password-error', 'signin-password');
    clearFieldError('signin-general-error', null);

    const email = signinEmail.value.trim();
    const password = signinPassword.value;
    let hasError = false;

    if (!email) {
      showFieldError('signin-email-error', 'Email is required.', 'signin-email');
      hasError = true;
    } else if (!isValidEmail(email)) {
      showFieldError('signin-email-error', 'Please enter a valid email address.', 'signin-email');
      hasError = true;
    }

    if (!password) {
      showFieldError('signin-password-error', 'Password is required.', 'signin-password');
      hasError = true;
    }

    if (hasError) return;

    setLoading(signinBtn);
    const result = await signInWithEmail(email, password);
    clearLoading(signinBtn);

    if (!result.success) {
      showFieldError('signin-general-error', result.error, null);
    }
    // Success: onAuthStateChanged will handle redirect
  });

  // ── Sign In — Google ──
  const signinGoogleBtn = document.getElementById('signin-google-btn');
  signinGoogleBtn?.addEventListener('click', async () => {
    if (!window.FIREBASE_READY) return;
    setLoading(signinGoogleBtn);
    const result = await signInWithGoogle();
    clearLoading(signinGoogleBtn);
    if (!result.success) {
      showFieldError('signin-general-error', result.error, null);
    }
  });

  // ── Sign Up Form ──
  const signupForm = document.getElementById('signup-form');
  const signupName = document.getElementById('signup-name');
  const signupEmail = document.getElementById('signup-email');
  const signupPassword = document.getElementById('signup-password');
  const signupConfirm = document.getElementById('signup-confirm');
  const signupBtn = document.getElementById('signup-btn');
  const termsCheckbox = document.getElementById('terms-checkbox');

  // Real-time password strength meter
  signupPassword?.addEventListener('input', () => {
    updateStrengthMeter(signupPassword.value);
    clearFieldError('signup-password-error', 'signup-password');
  });

  // Blur validations
  signupName?.addEventListener('blur', () => {
    if (!signupName.value.trim()) {
      showFieldError('signup-name-error', 'Full name is required.', 'signup-name');
    } else {
      clearFieldError('signup-name-error', 'signup-name');
    }
  });
  signupName?.addEventListener('input', () => clearFieldError('signup-name-error', 'signup-name'));

  signupEmail?.addEventListener('blur', () => {
    const val = signupEmail.value.trim();
    if (val && !isValidEmail(val)) {
      showFieldError('signup-email-error', 'Please enter a valid email address.', 'signup-email');
    } else {
      clearFieldError('signup-email-error', 'signup-email');
    }
  });
  signupEmail?.addEventListener('input', () => clearFieldError('signup-email-error', 'signup-email'));

  signupPassword?.addEventListener('blur', () => {
    const pw = signupPassword.value;
    if (pw) {
      const validation = validatePassword(pw);
      if (!validation.valid) {
        showFieldError('signup-password-error', validation.message, 'signup-password');
      }
    }
  });

  signupConfirm?.addEventListener('input', () => {
    clearFieldError('signup-confirm-error', 'signup-confirm');
    if (signupConfirm.value && signupPassword?.value !== signupConfirm.value) {
      showFieldError('signup-confirm-error', 'Passwords do not match.', 'signup-confirm');
    }
  });

  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.FIREBASE_READY) return;

    // Clear all errors
    ['signup-name-error', 'signup-email-error', 'signup-password-error', 'signup-confirm-error', 'terms-error', 'signup-general-error'].forEach(
      (id) => clearFieldError(id, id.replace('-error', ''))
    );

    const name = signupName.value.trim();
    const email = signupEmail.value.trim();
    const password = signupPassword.value;
    const confirm = signupConfirm.value;
    let hasError = false;

    if (!name) {
      showFieldError('signup-name-error', 'Full name is required.', 'signup-name');
      hasError = true;
    }
    if (!email) {
      showFieldError('signup-email-error', 'Email is required.', 'signup-email');
      hasError = true;
    } else if (!isValidEmail(email)) {
      showFieldError('signup-email-error', 'Please enter a valid email address.', 'signup-email');
      hasError = true;
    }
    if (!password) {
      showFieldError('signup-password-error', 'Password is required.', 'signup-password');
      hasError = true;
    } else {
      const validation = validatePassword(password);
      if (!validation.valid) {
        showFieldError('signup-password-error', validation.message, 'signup-password');
        hasError = true;
      }
    }
    if (password && confirm && password !== confirm) {
      showFieldError('signup-confirm-error', 'Passwords do not match.', 'signup-confirm');
      hasError = true;
    }
    if (!confirm) {
      showFieldError('signup-confirm-error', 'Please confirm your password.', 'signup-confirm');
      hasError = true;
    }
    if (!termsCheckbox?.checked) {
      showFieldError('terms-error', 'You must accept the Terms of Service to continue.', null);
      hasError = true;
    }

    if (hasError) return;

    setLoading(signupBtn);
    const result = await signUpWithEmail(name, email, password);
    clearLoading(signupBtn);

    if (!result.success) {
      showFieldError('signup-general-error', result.error, null);
    }
    // Success: onAuthStateChanged will show verification screen
  });

  // ── Sign Up — Google ──
  const signupGoogleBtn = document.getElementById('signup-google-btn');
  signupGoogleBtn?.addEventListener('click', async () => {
    if (!window.FIREBASE_READY) return;
    setLoading(signupGoogleBtn);
    const result = await signInWithGoogle();
    clearLoading(signupGoogleBtn);
    if (!result.success) {
      showFieldError('signup-general-error', result.error, null);
    }
  });

  // ── Forgot Password Form ──
  const forgotForm = document.getElementById('forgot-form');
  const forgotEmail = document.getElementById('forgot-email');
  const forgotBtn = document.getElementById('forgot-btn');

  forgotEmail?.addEventListener('blur', () => {
    const val = forgotEmail.value.trim();
    if (val && !isValidEmail(val)) {
      showFieldError('forgot-email-error', 'Please enter a valid email address.', 'forgot-email');
    } else {
      clearFieldError('forgot-email-error', 'forgot-email');
    }
  });
  forgotEmail?.addEventListener('input', () => clearFieldError('forgot-email-error', 'forgot-email'));

  forgotForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.FIREBASE_READY) return;

    clearFieldError('forgot-email-error', 'forgot-email');
    clearFieldError('forgot-general-error', null);

    const email = forgotEmail.value.trim();

    if (!email) {
      showFieldError('forgot-email-error', 'Email is required.', 'forgot-email');
      return;
    }
    if (!isValidEmail(email)) {
      showFieldError('forgot-email-error', 'Please enter a valid email address.', 'forgot-email');
      return;
    }

    setLoading(forgotBtn);
    const result = await sendPasswordReset(email);
    clearLoading(forgotBtn);

    if (result.success) {
      // Show success state
      document.getElementById('forgot-form-wrapper').style.display = 'none';
      const successEl = document.getElementById('forgot-success');
      successEl.classList.add('visible');
      document.getElementById('forgot-sent-email').textContent = email;
    } else {
      showFieldError('forgot-general-error', result.error, null);
    }
  });

  // ── Verification Screen ──
  const verifyResendBtn = document.getElementById('verify-resend-btn');
  const verifyCheckBtn = document.getElementById('verify-check-btn');
  const verifySignoutLink = document.getElementById('verify-signout-link');

  verifyResendBtn?.addEventListener('click', async () => {
    if (!window.FIREBASE_READY) return;
    setLoading(verifyResendBtn);
    const result = await resendVerification();
    clearLoading(verifyResendBtn);

    const successMsg = document.getElementById('verify-resend-success');
    if (result.success) {
      successMsg.classList.add('visible');
      // Hide success message after 5 seconds
      setTimeout(() => successMsg.classList.remove('visible'), 5000);
    } else {
      console.error('[Viralify Auth] Resend failed:', result.error);
    }
  });

  verifyCheckBtn?.addEventListener('click', async () => {
    if (!window.FIREBASE_READY) return;
    // Force reload user from Firebase to get updated emailVerified status
    const user = Auth.currentUser;
    if (user) {
      await user.reload();
      if (user.emailVerified) {
        redirectToDashboard();
      } else {
        // Pulse the envelope to indicate they need to verify first
        const icon = document.querySelector('.verify-icon');
        icon?.classList.add('pulse');
        setTimeout(() => icon?.classList.remove('pulse'), 600);
      }
    }
  });

  verifySignoutLink?.addEventListener('click', () => doSignOut());
  verifySignoutLink?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSignOut(); });

}); // end DOMContentLoaded
