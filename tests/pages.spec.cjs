const {test,expect}=require('@playwright/test');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
let server,origin;
test.beforeAll(async()=>{
 execFileSync(process.execPath,['scripts/build-pages.mjs']);
 const root=path.resolve('dist');
 server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const prefix=['/acco-note/','/other/'].find(p=>url.pathname.startsWith(p));if(!prefix){res.writeHead(404).end();return;}const rel=decodeURIComponent(url.pathname.slice(prefix.length))||'index.html',file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}const type={'.js':'text/javascript','.html':'text/html','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)];res.writeHead(200,{'Content-Type':type||'application/octet-stream','Cache-Control':'no-store'});res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve));});
async function ready(page,prefix){await page.goto(origin+prefix);await page.waitForSelector('.toolbar');await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});}
test('Pages subpath installs correct scope and supports offline save and reopen',async({page,context})=>{
 const failures=[];page.on('response',r=>{if(r.status()>=400)failures.push(r.url());});await ready(page,'/acco-note/');
 const info=await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready,m=await (await fetch('manifest.webmanifest')).json();return {scope:r.scope,manifest:m,cache:await caches.keys()};});
 expect(info.scope).toBe(origin+'/acco-note/');expect(info.manifest.start_url).toBe('./');expect(info.manifest.scope).toBe('./');expect(info.cache.some(k=>k.startsWith('acco-note-shell-%2Facco-note%2F-v1-')&&!k.includes('__BUILD_ID__'))).toBe(true);
 await context.setOffline(true);await page.reload();await page.locator('.heading [data-action=add]').click();await page.locator('[name=title]').fill('Pages 오프라인 기록');await page.locator('[name=amount]').fill('1200');await page.locator('#edit-form [type=submit]').click();await expect(page.locator('.ledger-table')).toContainText('Pages 오프라인 기록');await page.locator('#edit-form [data-action=close]').click();await page.reload();await expect(page.locator('.ledger-table')).toContainText('Pages 오프라인 기록');expect(failures).toEqual([]);await context.setOffline(false);
});
test('separate project workers retain each others cache namespace',async({page,context})=>{
 await ready(page,'/acco-note/');const other=await context.newPage();await ready(other,'/other/');const names=await page.evaluate(()=>caches.keys());expect(names.some(k=>k.startsWith('acco-note-shell-%2Facco-note%2F-v1-'))).toBe(true);expect(names.some(k=>k.startsWith('acco-note-shell-%2Fother%2F-v1-'))).toBe(true);await context.setOffline(true);await page.reload();await expect(page.locator('.toolbar')).toBeVisible();await context.setOffline(false);await other.close();
});
