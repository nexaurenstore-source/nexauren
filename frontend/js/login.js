(() => {
  'use strict';
  const form = document.getElementById('login-form');
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const message = document.getElementById('message');
  const setMessage = (text, error = false) => { message.textContent = text; message.setAttribute('aria-live','polite'); message.dataset.state = error ? 'error' : 'ok'; };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    button.disabled = true;
    button.setAttribute('aria-busy','true');
    setMessage('Entrando…');
    try {
      const response = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify({email,password}) });
      const text = await response.text();
      let data; try { data = JSON.parse(text); } catch { throw new Error('O servidor retornou uma resposta inválida.'); }
      if (!response.ok || !data.ok) throw new Error(data.message || 'Email ou senha incorretos.');
      setMessage('Login concluído. Abrindo sua conta…');
      window.location.assign('/pages/account.html');
    } catch (error) {
      setMessage(error.message || 'Não foi possível entrar.', true);
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  });
})();