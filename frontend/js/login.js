(() => {
  'use strict';

  const form = document.getElementById('login-form');
  if (!form) return;

  const email = document.getElementById('email');
  const password = document.getElementById('password');
  const button = document.getElementById('login-button');
  const message = document.getElementById('login-message');

  const setMessage = (text, type = '') => {
    if (!message) return;
    message.textContent = text;
    message.className = `auth-message ${type}`.trim();
  };

  const setLoading = loading => {
    if (!button) return;
    button.disabled = loading;
    button.setAttribute('aria-busy', String(loading));
    button.textContent = loading ? 'Signing in…' : 'Sign in';
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    setMessage('');

    const emailValue = email.value.trim().toLowerCase();
    const passwordValue = password.value;

    if (!emailValue || !/^\S+@\S+\.\S+$/.test(emailValue)) {
      setMessage('Please enter a valid email.', 'error');
      email.focus();
      return;
    }

    if (!passwordValue) {
      setMessage('Please enter your password.', 'error');
      password.focus();
      return;
    }

    setLoading(true);
    setMessage('Signing in…');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ email: emailValue, password: passwordValue })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.authenticated) {
        throw new Error(data?.error || data?.message || `Authentication failed (${response.status}).`);
      }

      const next = new URLSearchParams(location.search).get('next');
      const destination = next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')
        ? next
        : '/dashboard/';

      setMessage('Login successful. Opening your account…', 'success');
      window.location.assign(destination);
    } catch (error) {
      setMessage(error.message || 'Unable to sign in. Please try again.', 'error');
      setLoading(false);
    }
  });
})();
