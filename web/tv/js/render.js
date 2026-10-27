export function formatClock(date = new Date(), format = 'auto') {
  const options = { hour: 'numeric', minute: '2-digit', hour12: format === '12h' ? true : format === '24h' ? false : undefined };
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

export function renderClock(home) {
  const clock = document.querySelector('#clock');
  if (!clock) return;
  const settings = home?.clock || {};
  const visible = home && (settings.showClock ?? home.showClock ?? true);
  clock.hidden = !visible;
  if (visible) clock.textContent = formatClock(new Date(), settings.format || 'auto');
  const date = document.querySelector('#date');
  if (date) {
    date.hidden = !visible || settings.showDate === false;
    if (!date.hidden) date.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  }
}

import {cacheBrandColor,deriveBrandColor,getCachedBrandColor,resolveBrandColor} from '../../shared/brand-colors.js';

function deriveIconColor(icon, shortcut, tile) {
  const id = shortcut.catalogId ?? shortcut.appId;
  const cached = getCachedBrandColor(id);
  if (cached) { tile.style?.setProperty('--brand', cached); return; }
  if (!id || typeof document.createElement !== 'function') return;
  icon.addEventListener?.('load', () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 24;
    const context = canvas.getContext?.('2d');
    if (!context) return;
    context.drawImage(icon, 0, 0, 24, 24);
    const color = deriveBrandColor(context.getImageData(0, 0, 24, 24));
    if (color) tile.style?.setProperty('--brand', cacheBrandColor(id, color));
  }, {once: true});
}

export function renderHome(home, activate, backdrop) {
  document.body.className = home?.theme || 'cinematic';
  document.documentElement.style.setProperty('--accent', home?.accent || '#4aa8ff');
  const title = document.querySelector('#title');
  if (title) title.textContent = home?.title || 'Living Room';
  renderClock(home);
  const root = document.querySelector('#rails') || document.querySelector('#sections');
  if (!root) return;
  root.replaceChildren();
  const sections = (home?.sections || []).filter(section => section.shortcuts?.length);
  if (!sections.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = home?.setup ? 'Finish setup on the admin page to add shortcuts.' : 'No shortcuts yet. Add one from the admin page.';
    root.append(empty);
  }
  for (const section of sections) {
    const row = document.createElement('section');
    row.className = 'rail';
    row.dataset.row = sections.indexOf(section);
    const heading = document.createElement('h2');
    heading.textContent = section.title;
    row.append(heading);
    const track = document.createElement('div');
    track.className = 'row';
    for (const shortcut of section.shortcuts) {
      const tile = document.createElement('button');
      tile.className = `tile tile-${shortcut.kind || 'system'}`;
      tile.dataset.id = shortcut.id;
      tile.dataset.kind = shortcut.kind || 'system';
      tile.dataset.available = String(shortcut.available !== false);
      tile.style?.setProperty('--brand', resolveBrandColor(shortcut, home?.accent || '#4aa8ff'));
      const brand = resolveBrandColor(shortcut, home?.accent || '#4aa8ff').replace('#', '');
      const rgb = [0,2,4].map(i => Number.parseInt(brand.slice(i, i + 2), 16)).join(' ');
      tile.style?.setProperty('--brand-glow', `rgb(${rgb} / .55)`);
      if (shortcut.available === false) {
        tile.classList?.add('unavailable');
        tile.setAttribute?.('aria-label', `${shortcut.label}, unavailable`);
      }
      if(shortcut.icon){
        const icon = document.createElement('img');
        icon.src = shortcut.icon;
        icon.alt='';
        icon.addEventListener('error',()=>icon.remove(),{once:true});
        deriveIconColor(icon, shortcut, tile);
        tile.append(icon);
      } else if (shortcut.kind === 'input' || shortcut.kind === 'system') {
        const icon = document.createElement('img');
        const iconName = shortcut.kind === 'input' ? (shortcut.cname?.startsWith('av') ? 'icon-av' : shortcut.cname?.startsWith('cast') ? 'icon-cast' : 'icon-hdmi') : (shortcut.action === 'power-off' ? 'icon-power' : 'icon-home');
        icon.src = `/shared/icons/${iconName}.svg`;
        icon.alt = '';
        tile.append(icon);
      }
      const label = document.createElement('span');
      label.textContent=shortcut.label;
      tile.append(label);
      if (shortcut.available === false) {
        const badge = document.createElement('small');
        badge.className = 'unavailable-badge';
        badge.textContent = 'Unavailable';
        tile.append(badge);
      }
      tile.onclick = () => activate(tile, shortcut.id);
      tile.addEventListener?.('focus', () => backdrop?.setBrand(shortcut, home?.accent));
      track.append(tile);
    }
    row.append(track);
    const fade = document.createElement('i');
    fade.className = 'rail-fade';
    fade.hidden = true;
    row.append(fade);
    root.append(row);
    track._fmvGeometry = {
      width: track.clientWidth || 1152,
      scrollWidth: track.scrollWidth || [...track.children].reduce((sum, item) => sum + item.offsetWidth, 0),
      cards: [...track.children].map(card => ({ card, left: card.offsetLeft, right: card.offsetLeft + card.offsetWidth }))
    };
  }
}
