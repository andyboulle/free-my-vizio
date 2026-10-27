export function formatClock(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {hour: 'numeric', minute: '2-digit'}).format(date);
}

export function renderClock(home) {
  const clock = document.querySelector('#clock');
  if (!clock) return;
  clock.hidden = !home?.showClock;
  if (home?.showClock) clock.textContent = formatClock();
}

export function renderHome(home,activate){
  document.body.className=home.theme;
  document.documentElement.style.setProperty('--accent',home.accent);
  document.querySelector('#title').textContent=home.title;
  renderClock(home);
  const root=document.querySelector('#sections');
  root.replaceChildren();
  for(const section of home.sections){
    const row=document.createElement('section');
    row.className='section';
    const heading=document.createElement('h2');
    heading.textContent=section.title;
    row.append(heading);
    const tiles=document.createElement('div');
    tiles.className='row';
    for(const shortcut of section.shortcuts){
      const tile=document.createElement('button');
      tile.className='tile';
      tile.dataset.id=shortcut.id;
      if(shortcut.icon){
        const icon=document.createElement('img');
        icon.src=shortcut.icon;
        icon.alt='';
        icon.addEventListener('error',()=>icon.remove(),{once:true});
        tile.append(icon);
      }
      const label=document.createElement('span');
      label.textContent=shortcut.label;
      tile.append(label);
      tile.onclick=()=>activate(tile,shortcut.id);
      tiles.append(tile);
    }
    row.append(tiles);
    root.append(row);
  }
}
