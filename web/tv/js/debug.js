const params = new URLSearchParams(location.search);
if (params.get('fx') === 'none') document.documentElement.classList.add('fx-none');
export function summarizeFrameTimes(times) {
  const sorted = [...times].sort((a,b) => a-b);
  return { min1sFps: times.length ? Math.min(...times) : 0, p95: sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * .95) - 1)] : 0, longFrames: times.filter(value => value > 50).length };
}
if (params.get('debug') === '1') {
  globalThis.__fmvDebugStarted = performance.now();
  const overlay = document.createElement('output'); overlay.id = 'debug-overlay'; document.body.append(overlay);
  let last = performance.now(), frames = 0, previous = last, samples = [], oneSecond = [];
  const tick = now => {
    const delta = now - previous; previous = now; samples.push(delta); oneSecond.push(now);
    samples = samples.filter((_, i) => i >= Math.max(0, samples.length - 600)); oneSecond = oneSecond.filter(value => now - value < 1000);
    frames++;
    if (now - last >= 500) {
      const stats = summarizeFrameTimes(samples); const fps = oneSecond.length;
      overlay.textContent = `FPS ${fps} · min 1-s ${stats.min1sFps ? (1000 / stats.min1sFps).toFixed(0) : '…'} · p95 ${stats.p95.toFixed(1)} ms · >50 ${stats.longFrames} · ${document.body.classList.contains('fx-enhanced')?'enhanced':'lite'} · first ${globalThis.__fmvFirstRender ? `${globalThis.__fmvFirstRender.toFixed(0)} ms` : '…'}`;
      if (params.get('debug') === '1') fetch('/api/tv/debug-metrics?debug=1', {method:'POST',headers:{'Content-Type':'application/json','X-FMV-Token':new URLSearchParams(location.hash.slice(1)).get('k') || ''},body:JSON.stringify({fps,min1sFps:fps,p95:stats.p95,longFrames:stats.longFrames,tier:document.body.classList.contains('fx-enhanced')?'enhanced':'lite',firstRenderMs:globalThis.__fmvFirstRender||null})}).catch(()=>{});
      last = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
