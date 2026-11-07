const {chromium}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 await fs.mkdir('artifacts/ui-audit',{recursive:true});
 const report=[];
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>errors.push(`Request failed: ${r.url()}`));
  page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()}: ${r.url()}`);});
  async function inspect(name){
   const layout=await page.evaluate(()=>({
    overflow:document.documentElement.scrollWidth>innerWidth,
    tiny:[...document.querySelectorAll('main *,nav *')].filter(el=>el.getClientRects().length&&el.childNodes.length&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&parseFloat(getComputedStyle(el).fontSize)<12).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,30)})),
    fields:[...document.querySelectorAll('#inline-panel input,#inline-panel select,#inline-panel textarea')].filter(el=>el.getClientRects().length).map(el=>({type:el.type,font:getComputedStyle(el).fontSize,height:Math.round(el.getBoundingClientRect().height)})),
    skip:{active:document.activeElement?.className,top:document.querySelector('.skip').getBoundingClientRect().top},
   }));
   const accessibility=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
   await page.screenshot({path:`artifacts/ui-audit/${width}-${name}.png`});
   report.push({width,name,...layout,accessibility,errors:[...errors]});
  }
  async function base(route){await page.goto('http://127.0.0.1:4173/preview.html#'+route);}
  await base('ledger');await inspect('ledger');
  await page.locator('[data-action=filters]').click();await inspect('filters');
  await page.locator('[data-action=add]').click();await inspect('add');
  await page.locator('[data-date]').click();await inspect('datepicker');await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');await page.locator('[data-detail="0"] .row-detail-button').click();await inspect('detail');
  await page.locator('[data-action=edit]').click();await inspect('edit');
  await page.keyboard.press('Escape');await page.locator('[data-detail="0"] .row-detail-button').click();await page.locator('[data-action=refund]').click();await inspect('refund');
  await page.keyboard.press('Escape');await page.locator('[data-action=bulk-toggle]').click();await inspect('bulk');
  await page.locator('[data-detail="0"] input').click();await page.locator('[data-action=bulk-delete]').click();await inspect('bulk-confirm');
  await page.locator('[data-view=calendar]').click();await inspect('calendar');
  await page.locator('[data-ledger-tab]').last().click();await inspect('statistics');
  await base('budget');await inspect('budget');await page.locator('[data-action=budget-form]').first().click();await inspect('budget-form');
  await base('savings');await inspect('savings');await page.locator('[data-action=goal-form]').click();await inspect('goal-form');
  await page.keyboard.press('Escape');await page.locator('[data-goal="0"]').click();await inspect('goal-detail');await page.locator('[data-action=saving-entry]').click();await inspect('saving-entry');
  await base('manage');await inspect('recurring');await page.locator('[data-action=recurring-form]').click();await inspect('recurring-form');await page.keyboard.press('Escape');
  await page.locator('[data-manage-tab]').nth(1).click();await inspect('categories');await page.locator('[data-action=category-form]').first().click();await inspect('category-form');await page.keyboard.press('Escape');
  await page.locator('[data-manage-tab]').nth(2).click();await inspect('payments');
  await page.locator('[data-payment="2"]').click();await inspect('payment-empty');await page.keyboard.press('Escape');
  await page.locator('[data-payment="0"]').click();await inspect('payment-detail');await page.keyboard.press('Escape');
  await page.locator('[data-action=payment-form]').click();await inspect('payment-form');await page.keyboard.press('Escape');
  await page.locator('[data-manage-tab]').nth(3).click();await inspect('backup');await page.locator('[data-action=restore]').click();await inspect('restore');
  await context.close();console.log(`Audited ${width}px`);
 }
 await fs.writeFile('artifacts/ui-audit/report.json',JSON.stringify(report,null,2));
 const failures=report.filter(r=>r.overflow||r.tiny.length||r.accessibility.length||r.errors.length);
 await fs.writeFile('artifacts/ui-audit/report.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>아코 노트 UI 점검</title><style>body{font:14px/1.6 system-ui,sans-serif;background:#f3f6fb;color:#24334e;max-width:1080px;margin:24px auto;padding:0 16px}table{width:100%;border-collapse:collapse;background:white}th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #dfe7f1}a{color:#345b8e}.table{overflow:auto}h1{font-size:24px}small{color:#586a83}</style><h1>아코 노트 UI 점검 결과</h1><p>${report.length}개 화면·크기 조합 / 검사 실패 ${failures.length}개</p><p>Edge ${browser.version()} · ${new Date().toISOString()}<br>가로 넘침, 최소 12px 글자, 스크립트·리소스 오류, axe WCAG A/AA 자동 검사를 확인했습니다. 자동 검사는 전체 접근성 적합성을 보증하지 않습니다.</p><p><a href="report.json">상세 검사 데이터</a></p><div class="table"><table><thead><tr><th>화면</th><th>너비</th><th>가로 넘침</th><th>12px 미만</th><th>접근성 규칙 오류</th><th>실행·리소스 오류</th></tr></thead><tbody>${report.map(r=>`<tr><td><a href="${r.width}-${r.name}.png">${r.name}</a></td><td>${r.width}px</td><td>${r.overflow?'있음':'없음'}</td><td>${r.tiny.length}</td><td>${r.accessibility.length}</td><td>${r.errors.length}</td></tr>`).join('')}</tbody></table></div><p>화면명을 누르면 해당 상태의 캡처를 볼 수 있습니다.</p></html>`);
 console.log(JSON.stringify(report.filter(r=>r.overflow||r.tiny.length||r.accessibility.length||r.errors.length).map(({width,name,overflow,tiny,accessibility,errors})=>({width,name,overflow,tiny,accessibility:accessibility.map(v=>({id:v.id,count:v.nodes.length})),errors})),null,2));
 await browser.close();
 if(report.some(r=>r.overflow||r.tiny.length||r.accessibility.length||r.errors.length))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
