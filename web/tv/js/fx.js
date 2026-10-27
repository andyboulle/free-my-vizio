const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function applyMotionPreference(home) {
  const reduce = Boolean(home?.appearance?.reduceMotion || home?.reduceMotion || reduced());
  document.documentElement.classList.toggle('reduce-motion', reduce);
  document.documentElement.style.setProperty('--motion-scale', reduce ? '0.2' : '1');
  return reduce;
}

export function installFxMonitor({onDowngrade = () => {}, windowMs = 5000} = {}) {
  if (globalThis.localStorage?.getItem('fmv.fx') === 'low') {
    document.body.classList.add('fx-low');
    return () => {};
  }
  let frames = 0, started = performance.now(), stopped = false;
  const tick = now => {
    if (stopped) return;
    frames++;
    if (now - started >= windowMs) {
      if (frames * 1000 / (now - started) < 45) {
        document.body.classList.add('fx-low');
        globalThis.localStorage?.setItem('fmv.fx', 'low');
        onDowngrade();
        return;
      }
      started = now; frames = 0;
    }
    requestAnimationFrame(tick);
  };
  const id = requestAnimationFrame(tick);
  return () => { stopped = true; cancelAnimationFrame(id); };
}
