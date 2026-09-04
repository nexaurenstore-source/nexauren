/* Nexauren Integration Center — backend bridge
 * Credentials are sent only to the authenticated Worker endpoint and are never persisted by the builder.
 */
(function () {
  'use strict';

  const api = '/api/integrations';
  const providerByName = () => {
    const out = {};
    (window.NexaurenIntegrations?.providers || []).forEach((p) => { out[p.name] = p; });
    return out;
  };

  async function load() {
    try {
      const res = await fetch(api, { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      for (const item of (data.integrations || [])) {
        if (item?.provider) window.NexaurenIntegrations?.connect(item.provider);
      }
    } catch (error) {
      console.warn('[integrations] Could not load connections.', error);
    }
  }

  async function saveFromForm() {
    const form = document.getElementById('nxIntForm');
    const content = document.getElementById('nxIntContent');
    if (!form || !content) return;
    const heading = content.querySelector('.nx-int-detail h3');
    const provider = providerByName()[heading?.textContent?.trim() || ''];
    if (!provider) return;

    const credentials = {};
    provider.fields.forEach((field, index) => {
      const input = form.querySelector(`[name="f${index}"]`);
      if (input) credentials[field] = input.value;
    });

    const checkbox = form.querySelector('input[type="checkbox"]');
    if (checkbox && !checkbox.checked) return;

    try {
      const res = await fetch(api, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          provider: provider.id,
          category: provider.kind,
          label: provider.name,
          auth_type: provider.method,
          credentials,
          metadata: { source: 'website-builder' },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Connection failed (${res.status})`);
      }
      form.querySelectorAll('input').forEach((input) => {
        if (input.type !== 'checkbox') input.value = '';
      });
    } catch (error) {
      alert(error?.message || 'Não foi possível guardar a ligação.');
    }
  }

  async function disconnect(id) {
    if (!id) return;
    try {
      const res = await fetch(`${api}/${encodeURIComponent(id)}`, {
        method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Disconnect failed (${res.status})`);
      }
    } catch (error) {
      alert(error?.message || 'Não foi possível desligar a ligação.');
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-save-connection]')) saveFromForm();
    const disconnectButton = event.target.closest('[data-disconnect]');
    if (disconnectButton) disconnect(disconnectButton.dataset.disconnect);
  }, true);

  const boot = setInterval(() => {
    if (window.NexaurenIntegrations) {
      clearInterval(boot);
      load();
    }
  }, 200);
  setTimeout(() => clearInterval(boot), 10000);
})();
