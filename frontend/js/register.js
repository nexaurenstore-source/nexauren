(() => {
  'use strict';

  const form = document.getElementById('register-form');
  if (!form) return;

  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const button = document.getElementById('register-button');
  const message = document.getElementById('register-message');
  const errors = {
    name: document.getElementById('name-error'),
    email: document.getElementById('email-error'),
    password: document.getElementById('password-error'),
    confirm: document.getElementById('confirm-password-error')
  };

  const clearErrors = () => {
    Object.values(errors).forEach(el => { if (el) el.textContent = ''; });
    if (message) { message.textContent = ''; message.className = 'auth-message'; }
  };

  const showMessage = (text, type = 'error') => {
    if (!message) return;
    message.textContent = text;
    message.className = `auth-message ${type}`;
  };

  const setLoading = loading => {
    if (!button) return;
    button.disabled = loading;
    button.setAttribute('aria-busy', String(loading));
    button.textContent = loading ? 'Creating account…' : 'Create account';
  };

  const validate = () => {
    let valid = true;
    const name = nameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const confirm = confirmPasswordInput.value;

    if (!name || name.length > 100) { errors.name.textContent = 'Please enter a valid name.'; valid = false; }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) { errors.email.textContent = 'Please enter a valid email.'; valid = false; }
    if (password.length < 8 || password.length > 200) { errors.password.textContent = 'Password must contain between 8 and 200 characters.'; valid = false; }
    if (confirm !== password) { errors.confirm.textContent = 'Passwords do not match.'; valid = false; }
    return valid;
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearErrors();
    if (!validate()) return;

    setLoading(true);
    showMessage('Creating your account…', '');

    const name = nameInput.value.trim();
    const baseUsername = name.toLowerCase().replace(/[^a-z0-9_.-]+/g, '').slice(0, 24);
    const username = (baseUsername || 'user') + '-' + Math.random().toString(36).slice(2, 7);

    try {
      const response = await fetch('/api/account/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({
          username,
          email: emailInput.value.trim().toLowerCase(),
          password: passwordInput.value
        })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.authenticated) {
        throw new Error(result?.error || result?.message || `Registration failed (${response.status}).`);
      }

      showMessage('Account created successfully. Opening your dashboard…', 'success');
      passwordInput.value = '';
      confirmPasswordInput.value = '';
      setTimeout(() => { window.location.assign('/dashboard/'); }, 350);
    } catch (error) {
      showMessage(error.message || 'Unable to connect to Nexauren. Please try again.', 'error');
      setLoading(false);
    }
  });

  confirmPasswordInput.addEventListener('input', () => {
    if (confirmPasswordInput.value === passwordInput.value) errors.confirm.textContent = '';
  });
})();
