(() => {
  const root = document.getElementById('rows');
  if (!root) return;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = msg => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 3500);
  };
  const details = async id => {
    const r = await fetch('/api/admin/users/' + encodeURIComponent(id) + '/details', { credentials:'include', cache:'no-store', headers:{Accept:'application/json'} });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Unable to load user.');
    return d;
  };
  const action = async (id, path, options = {}) => {
    const r = await fetch('/api/admin/users/' + encodeURIComponent(id) + '/' + path, {
      method: options.method || 'POST', credentials:'include', cache:'no-store',
      headers:{'Content-Type':'application/json',Accept:'application/json'},
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Action failed (' + r.status + ').');
    return d;
  };

  function addControls() {
    root.querySelectorAll('.menu-panel').forEach(panel => {
      if (panel.querySelector('[data-extra-action]')) return;
      const item = panel.querySelector('[data-action="view"]');
      if (!item) return;
      const id = item.dataset.id;
      panel.insertAdjacentHTML('beforeend',
        '<button class="menu-item" type="button" data-extra-action="edit" data-id="' + esc(id) + '">Edit user</button>' +
        '<button class="menu-item" type="button" data-extra-action="block" data-id="' + esc(id) + '">Block / unblock</button>'
      );
    });
  }

  async function editUser(id) {
    try {
      const d = await details(id), u = d.user || {}, p = d.progress || {};
      const username = prompt('Username:', u.username || '');
      if (username === null) return;
      const xpValue = prompt('XP:', String(Number(p.xp || 0)));
      if (xpValue === null) return;
      const levelValue = prompt('Level:', String(Number(p.level || 1)));
      if (levelValue === null) return;
      const xp = Number(xpValue), level = Number(levelValue);
      if (!Number.isFinite(xp) || xp < 0 || !Number.isFinite(level) || level < 1) {
        toast('Error: XP or level is invalid.');
        return;
      }
      const result = await action(id, 'edit', { method:'PUT', body:{ username:username.trim(), xp:Math.floor(xp), level:Math.floor(level) } });
      toast(result.message || 'User updated successfully.');
      if (typeof window.load === 'function') window.load();
      else location.reload();
    } catch (e) { toast('Error: ' + e.message); }
  }

  async function toggleBlock(id) {
    try {
      const d = await details(id);
      const blocked = !!d.user?.blocked;
      const label = blocked ? 'Unblock this user' : 'Block this user';
      if (!confirm(label + '?\n\n' + (blocked ? 'The user will be allowed to sign in again.' : 'The user will be prevented from signing in and all current sessions will be revoked.'))) return;
      const result = await action(id, blocked ? 'unblock' : 'block');
      toast(result.message || 'User status updated.');
      if (typeof window.load === 'function') window.load();
      else location.reload();
    } catch (e) { toast('Error: ' + e.message); }
  }

  root.addEventListener('click', e => {
    const item = e.target.closest('[data-extra-action]');
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll('.menu.open').forEach(x => x.classList.remove('open'));
    const id = item.dataset.id;
    if (item.dataset.extraAction === 'edit') editUser(id);
    if (item.dataset.extraAction === 'block') toggleBlock(id);
  });

  new MutationObserver(addControls).observe(root, { childList:true, subtree:true });
  addControls();
})();
