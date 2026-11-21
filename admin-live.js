// Coalesce live change signals and wait until editing is safe before reloading.
export function createLiveUpdates({refresh,canApply,status,delay=600,schedule=setTimeout,cancel=clearTimeout}) {
  let pending=false,running=false,stopped=false,timer=null,version=0;
  async function flush(){
    timer=null;if(stopped||!pending||running)return;
    if(!canApply()){status('Updates waiting — finish or save your edits.');return;}
    const current=version;pending=false;running=true;status('Updating…');
    try{await refresh();if(!stopped){if(version!==current)pending=true;status(pending?'Updates waiting…':'Live updates on');}}
    catch{if(!stopped){pending=true;status('Live update failed. Use Refresh or retry when connected.');}}
    finally{running=false;if(!stopped&&pending&&version!==current)wake();}
  }
  function wake(){if(!stopped&&pending&&!running){if(timer!==null)cancel(timer);timer=schedule(flush,delay);}}
  return {notify(){if(stopped)return;pending=true;version++;wake();},wake,stop(){stopped=true;pending=false;if(timer!==null)cancel(timer);}};
}
