const params = new URLSearchParams(location.search);
if (params.get('debug') === '1') {
  const overlay = document.createElement('output');
  overlay.id = 'debug-overlay';
  document.body.append(overlay);
  let frames = 0; let last = performance.now(); let fps = 0;
  const tick = (now) => {
    frames++;
    if (now - last >= 1000) { fps = frames * 1000 / (now - last); frames = 0; last = now; }
    overlay.textContent = `FPS ${fps.toFixed(0)} · frame ${performance.now().toFixed(1)} ms`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
