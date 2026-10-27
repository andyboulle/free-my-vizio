const params = new URLSearchParams(location.search);
if (params.get('debug') === '1') {
  globalThis.__fmvDebugStarted = performance.now();
  const overlay = document.createElement('output');
  overlay.id = 'debug-overlay';
  document.body.append(overlay);
  let frames = 0; let last = performance.now(); let fps = 0; const started = last;
  const tick = (now) => {
    frames++;
    if (now - last >= 1000) { fps = frames * 1000 / (now - last); frames = 0; last = now; }
    const first = globalThis.__fmvFirstRender;
    overlay.textContent = `FPS ${fps.toFixed(0)} · fx-${document.body.classList.contains('fx-low') ? 'low' : 'high'} · first ${first ? `${first.toFixed(0)} ms` : '…'} · frame ${performance.now().toFixed(1)} ms`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
