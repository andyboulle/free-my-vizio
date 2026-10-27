export function installKeys(onMove,onActivate,onBack, now=()=>performance.now()){
  let pending=null,lastMove=0,raf=0;
  const flush=()=>{raf=0;if(!pending)return;const direction=pending;pending=null;lastMove=now();onMove(direction);};
  document.addEventListener('keydown',e=>{
    const dirs={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
    if(dirs[e.key]||[37,38,39,40].includes(e.keyCode)){
      e.preventDefault(); if(e.repeat && now()-lastMove<110)return;
      pending=dirs[e.key]||({37:'left',38:'up',39:'right',40:'down'})[e.keyCode];
      if(!raf)raf=requestAnimationFrame(flush);
    } else if(e.key==='Enter'||e.keyCode===13){e.preventDefault();if(!e.repeat)onActivate();}
    else if(e.key==='Backspace'||e.keyCode===8){e.preventDefault();onBack();}
  });
}
