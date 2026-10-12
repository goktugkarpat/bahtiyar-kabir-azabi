/* Loading-time GPU completion check. Poll without blocking the browser thread. */
(() => {
 'use strict';const B=window.BABA=window.BABA||{};
 async function wait(renderer,pause=()=>new Promise(resolve=>setTimeout(resolve,8)),timeout=15000){
  const gl=renderer.getContext(),start=performance.now();
  if(!gl.fenceSync||!gl.clientWaitSync)return {ready:true,supported:false,ms:0};
  if(gl.isContextLost())return {ready:false,reason:'context-lost',ms:0};
  const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
  if(!fence)return {ready:false,reason:'no-fence',ms:0};
  gl.flush();
  try{while(!gl.isContextLost()){
   const status=gl.clientWaitSync(fence,0,0),ms=performance.now()-start;
   if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)return {ready:true,supported:true,ms};
   if(status===gl.WAIT_FAILED)return {ready:false,reason:'wait-failed',ms};
   if(ms>=timeout)return {ready:false,reason:'timeout',ms};
   await pause();
  }return {ready:false,reason:'context-lost',ms:performance.now()-start};}
  finally{if(!gl.isContextLost())gl.deleteSync(fence);}
 }
 B.GraphicsReady={wait};
})();
