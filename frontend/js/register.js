(() => {
  'use strict';
  const form = document.getElementById('register-form');
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const message = document.getElementById('message');
  const setMessage = (text, error = false) => { message.textContent = text; message.setAttribute('aria-live','polite'); message.dataset.state = error ? 'error' : 'ok'; };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmation = document.getElementById('confirm-password').value;
    if (password !== confirmation) { setMessage('As senhas não coincidem.', true); return; }
    button.disabled = true;
    button.setAttribute('aria-busy','true');
    setMessage('Criando sua conta…');
    try {
      const response = await fetch('/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify({name,email,password}) });
      const text = await response.text();
      let data; try { data = JSON.parse(text); } catch { throw new Error('O servidor retornou uma resposta inválida.'); }
      if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível criar a conta.');
      setMessage('Conta criada. Abrindo sua conta…');
      window.location.assign('/pages/account.html');
    } catch (error) {
      setMessage(error.message || 'Não foi possível criar a conta.', true);
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  });
})();