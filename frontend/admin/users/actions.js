(() => {
  const root = document.getElementById('rows');
  if (!root) return;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const toast = msg => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 3500);
  };

  const action = async (id, path, options = {}) => {
    const r = await fetch('/api/admin/users/' + encodeURIComponent(id) + '/' + path, {
      method: options.method || 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Action failed (' + r.status + ').');
    return d;
  };

  function rowValues(id) {
    const item = root.querySelector('[data-id="' + CSS.escape(id) + '"]');
    const row = item?.closest('tr');
    if (!row) return { username: '', xp: 0, level: 1 };
    const cells = row.querySelectorAll('td');
    const userCell = cells[0];
    const username = userCell?.querySelector('strong')?.textContent?.trim() || '';
    const xp = Number((cells[3]?.textContent || '0').replace(/[^0-9.-]/g, '')) || 0;
    const level = Number((cells[4]?.textContent || '1').replace(/[^0-9.-]/g, '')) || 1;
    return { username, xp, level };
  }

  function addControls() {
    root.querySelectorAll('.menu-panel').forEach(panel => {
      if (panel.querySelector('[data-extra-action]')) return;
      const item = panel.querySelector('[data-action="view"]');
      if (!item) return;
      const id = item.dataset.id;
      panel.insertAdjacentHTML('beforeend',
        '<button class="menu-item" type="button" data-extra-action="edit" data-id="' + esc(id) + '">Edit user</button>' +
        '<button class="menu-item" type="button" data-extra-action="block" data-id="' + esc(id) + '">Block user</button>'
      );
    });
  }

  async function editUser(id) {
    try {
      const current = rowValues(id);
      const username = prompt('Username:', current.username);
      if (username === null) return;
      const xpValue = prompt('XP:', String(current.xp));
      if (xpValue === null) return;
      const levelValue = prompt('Level:', String(current.level));
      if (levelValue === null) return;

      const xp = Number(xpValue);
      const level = Number(levelValue);
      if (!Number.isFinite(xp) || xp < 0 || !Number.isFinite(level) || level < 1) {
        toast('Error: XP or level is invalid.');
        return;
      }
      if (username.trim().length < 2) {
        toast('Error: username must contain at least 2 characters.');
        return;
      }

      const result = await action(id, 'edit', {
        method: 'PUT',
        body: {
          username: username.trim(),
          xp: Math.floor(xp),
          level: Math.floor(level),
        },
      });
      toast(result.message || 'User updated successfully.');
      if (typeof window.load === 'function') window.load();
      else location.reload();
    } catch (e) {
      toast('Error: ' + e.message);
    }
  }

  async function blockUser(id) {
    if (!confirm('Block this user?\n\nThe user will be prevented from signing in and all current sessions will be revoked.')) return;
    try {
      const result = await action(id, 'block');
      toast(result.message || 'User blocked successfully.');
      if (typeof window.load === 'function') window.load();
      else location.reload();
    } catch (e) {
      toast('Error: ' + e.message);
    }
  }

  root.addEventListener('click', e => {
    const item = e.target.closest('[data-extra-action]');
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll('.menu.open').forEach(x => x.classList.remove('open'));
    const id = item.dataset.id;
    if (item.dataset.extraAction === 'edit') editUser(id);
    if (item.dataset.extraAction === 'block') blockUser(id);
  });

  new MutationObserver(addControls).observe(root, { childList: true, subtree: true });
  addControls();
})();
