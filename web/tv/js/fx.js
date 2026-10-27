const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function applyMotionPreference(home) {
  const reduce = Boolean(home?.appearance?.reduceMotion || home?.reduceMotion || reduced());
  document.documentElement.classList.toggle('reduce-motion', reduce);
  document.documentElement.style.setProperty('--motion-scale', reduce ? '0.2' : '1');
  document.body.classList.toggle('fx-enhanced', home?.appearance?.effects === 'enhanced');
  document.body.classList.add('fx-lite');
  return reduce;
}

export function installFxMonitor() { return () => {}; }
