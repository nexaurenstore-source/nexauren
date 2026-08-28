(() => {
  'use strict';

  const input = document.querySelector('#tool-search');
  const grid = document.querySelector('#home-tools');
  const featuredGrid = document.querySelector('#home-featured');
  const popularGrid = document.querySelector('#home-popular');
  const count = document.querySelector('#search-result-count');

  if (!input || !grid) return;

  let tools = [];
  let selected = -1;

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));

  const normalize = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const isDiscoverable = tool => String(tool?.status || 'active').toLowerCase() === 'active';
  const discoverableTools = () => tools.filter(isDiscoverable);

  const searchableValues = tool => [
    tool.name, tool.description, tool.studio, tool.studioName,
    tool.slug, tool.id, ...(Array.isArray(tool.tags) ? tool.tags : [])
  ].map(normalize).filter(Boolean);

  const matches = query => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return discoverableTools();
    const parts = normalizedQuery.split(/\s+/).filter(Boolean);
    return discoverableTools().filter(tool => {
      const values = searchableValues(tool);
      return parts.every(part => values.some(value => value.includes(part)));
    });
  };

  const toolIcon = tool => {
    const value = String(tool?.icon || '').trim();
    return !value || /^(\/|https?:\/\/|assets\/|\.\.\/|\.\/)/i.test(value) ? '🔧' : value;
  };

  const studioName = tool => tool.studioName || 'Studio';

  const toolCard = tool => `
    <article class="card tool-card-item">
      <div class="tool-card-content">
        <span class="tool-category">${escapeHTML(studioName(tool))}</span>
        <div class="tool-card-title-row">
          <span class="tool-card-icon">${escapeHTML(toolIcon(tool))}</span>
          <h3>${escapeHTML(tool.name)}</h3>
        </div>
        <p>${escapeHTML(tool.description)}</p>
        <a class="card-link" href="${escapeHTML(tool.url)}" data-tool-id="${escapeHTML(tool.id)}" data-tool-name="${escapeHTML(tool.name)}">Open tool →</a>
      </div>
    </article>`;

  let suggestions = document.querySelector('#tool-search-suggestions');
  if (!suggestions) {
    suggestions = document.createElement('div');
    suggestions.id = 'tool-search-suggestions';
    suggestions.className = 'tool-search-suggestions';
    suggestions.setAttribute('role', 'listbox');
    input.parentElement.appendChild(suggestions);
  }

  const renderSuggestions = query => {
    const found = matches(query);
    selected = -1;
    suggestions.innerHTML = found.slice(0, 8).map((tool, index) => `
      <a role="option" id="tool-suggestion-${index}" class="tool-suggestion"
         href="${escapeHTML(tool.url)}" data-tool-id="${escapeHTML(tool.id)}" data-tool-name="${escapeHTML(tool.name)}">
        <span class="suggestion-icon">${escapeHTML(toolIcon(tool))}</span>
        <span><strong>${escapeHTML(tool.name)}</strong><small>${escapeHTML(studioName(tool))}</small></span>
      </a>`).join('');

    suggestions.hidden = !query.trim() || !found.length;
    if (count) {
      count.textContent = query.trim()
        ? (found.length ? `${found.length} result${found.length === 1 ? '' : 's'} found` : 'No results')
        : `${discoverableTools().length} active tools`;
    }

    grid.innerHTML = query.trim()
      ? (found.length ? found.map(toolCard).join('') : '<div class="empty"><strong>No tools found.</strong><br>Try another name, studio or tag.</div>')
      : discoverableTools().slice(0, 8).map(toolCard).join('');
  };

  const selectSuggestion = index => {
    const items = [...suggestions.querySelectorAll('.tool-suggestion')];
    items.forEach(item => item.classList.remove('selected'));
    if (items[index]) {
      items[index].classList.add('selected');
      selected = index;
      input.setAttribute('aria-activedescendant', `tool-suggestion-${index}`);
    }
  };

  input.setAttribute('aria-controls', 'tool-search-suggestions');
  input.setAttribute('aria-autocomplete', 'list');
  input.addEventListener('input', event => renderSuggestions(event.target.value));
  input.addEventListener('focus', () => renderSuggestions(input.value));
  input.addEventListener('keydown', event => {
    const items = [...suggestions.querySelectorAll('.tool-suggestion')];
    if (event.key === 'ArrowDown' && items.length) {
      event.preventDefault(); selectSuggestion(Math.min(selected + 1, items.length - 1));
    } else if (event.key === 'ArrowUp' && items.length) {
      event.preventDefault(); selectSuggestion(Math.max(selected - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (selected >= 0 && items[selected]) window.location.href = items[selected].href;
      else if (input.value.trim()) window.location.href = `/search/?q=${encodeURIComponent(input.value.trim())}`;
    } else if (event.key === 'Escape') {
      input.value = ''; renderSuggestions(''); suggestions.hidden = true; input.blur();
    }
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.search-wrap')) suggestions.hidden = true;
  });

  const registry = window.NexaurenRegistry;
  if (!registry) {
    grid.innerHTML = '<div class="empty">Tool registry is unavailable. Please refresh the page.</div>';
    return;
  }

  registry.loadTools()
    .then(loadedTools => {
      tools = loadedTools;
      const live = discoverableTools();
      if (featuredGrid) {
        featuredGrid.innerHTML = live.filter(tool => tool.featured === true).slice(0, 6).map(toolCard).join('')
          || '<div class="empty">No studio tools yet.</div>';
      }
      if (popularGrid) {
        popularGrid.innerHTML = live.filter(tool => tool.popular === true).slice(0, 8).map(toolCard).join('')
          || '<div class="empty">No popular studio tools yet.</div>';
      }
      renderSuggestions(input.value);
    })
    .catch(() => {
      grid.innerHTML = '<div class="empty">Unable to load tools right now. Please refresh the page.</div>';
      if (featuredGrid) featuredGrid.innerHTML = '';
      if (popularGrid) popularGrid.innerHTML = '';
    });
})();
