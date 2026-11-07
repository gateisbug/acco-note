(()=>{
 let deferred,ready=false,registration;
 globalThis.updateInstallUI=()=>{const b=document.querySelector('#install-button'),s=document.querySelector('#offline-status');if(b){b.hidden=!deferred;b.onclick=async()=>{if(!deferred)return;await deferred.prompt();await deferred.userChoice;deferred=null;updateInstallUI();};}if(s)s.textContent=ready?(navigator.onLine?'오프라인 재실행 준비 완료':'오프라인 · 기록은 이 기기에 저장됩니다'):'오프라인 사용 준비 중';};
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;updateInstallUI();});
 window.addEventListener('appinstalled',()=>{deferred=null;updateInstallUI();});
 window.addEventListener('online',updateInstallUI);window.addEventListener('offline',updateInstallUI);
 function offerUpdate(){if(document.querySelector('#pwa-update'))return;const el=document.createElement('aside');el.id='pwa-update';el.className='pwa-banner';el.innerHTML='<span>새 버전이 준비되었습니다. 입력을 저장한 후 업데이트해 주세요.</span> <button class="button">업데이트</button>';el.querySelector('button').onclick=()=>{registration.waiting?.postMessage('ACTIVATE_UPDATE');};document.body.append(el);}
 if('serviceWorker' in navigator&&location.protocol!=='file:'){
  navigator.serviceWorker.register('/sw.js').then(async r=>{registration=r;if(r.waiting)offerUpdate();r.addEventListener('updatefound',()=>{const w=r.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)offerUpdate();});});await navigator.serviceWorker.ready;ready=true;updateInstallUI();}).catch(()=>{const s=document.querySelector('#offline-status');if(s)s.textContent='오프라인 준비 실패 · 연결 후 다시 열어 주세요.';});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(document.querySelector('#pwa-update'))location.reload();});
 }
})();
