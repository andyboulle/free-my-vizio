export function createIdleTimer({minutes = 5, onIdle, enabled = true} = {}) {
  let timer = 0;
  let delay = minutes;
  let active = enabled;
  const reset = () => {
    clearTimeout(timer);
    if (active && delay > 0) timer = setTimeout(onIdle, delay * 60 * 1000);
  };
  return {start: reset, reset, configure(next = {}) { if (next.minutes !== undefined) delay = next.minutes; if (next.enabled !== undefined) active = next.enabled; reset(); }, stop() { active = false; clearTimeout(timer); }};
}
