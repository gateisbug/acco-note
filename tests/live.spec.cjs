const {test,expect}=require('@playwright/test');
const path=require('node:path');
const fs=require('node:fs/promises');
const AxeBuilder=require('@axe-core/playwright').default;
async function ready(page){await page.goto('/');await expect(page.locator('.ledger-table')).toBeVisible();}
async function add(page,title,amount='12000',kind='expense'){
 await page.locator('.heading [data-action=add]').click();await page.getByLabel('수입/지출',{exact:true}).selectOption(kind);
 await page.getByLabel('내역명',{exact:true}).fill(title);await page.getByLabel('금액',{exact:true}).fill(amount);
 await page.locator('#edit-form button[type=submit]').click();await expect(page.getByRole('status').filter({hasText:'저장했습니다.'})).toBeVisible();
 await page.locator('#edit-form [data-action=close]').click();
}
test('live transaction persistence, validation, refund, filtering and deletion',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
 await page.locator('.heading [data-action=add]').click();await page.locator('#edit-form button[type=submit]').click();await expect(page.locator('#form-error')).toBeVisible();
 await page.locator('#edit-form [data-action=close]').click();
 await add(page,'점심 <img src=x>','12000');await add(page,'월급','3000000','income');
 await expect(page.locator('.summary')).toContainText('2,988,000');await page.reload();await expect(page.locator('.ledger-table tbody tr')).toHaveCount(2);
 await page.getByLabel('내역 검색').fill('점심');await expect(page.locator('.ledger-table tbody tr')).toHaveCount(1);await expect(page.locator('.ledger-table img')).toHaveCount(0);
 await page.locator('.ledger-table [data-row]').click();await page.locator('[data-action=transaction-edit]').click();
 await page.getByLabel('금액',{exact:true}).fill('15000');await page.locator('#edit-form button[type=submit]').click();await expect(page.locator('.summary')).toContainText('-15,000');
 await page.locator('.ledger-table [data-row]').click();await page.locator('[data-action=refund-form]').click();
 await page.getByLabel('환불 금액').fill('16000');await page.locator('#edit-form button[type=submit]').click();await expect(page.locator('#form-error')).toContainText('초과');
 await page.getByLabel('환불 금액').fill('3000');await page.locator('#edit-form button[type=submit]').click();await expect(page.locator('.summary')).toContainText('-12,000');
 await expect(page.locator('.ledger-table tbody tr')).toHaveCount(2);await page.getByLabel('내역 검색').fill('');
 await page.locator('[data-action=bulk]').click();await page.locator('[data-action=select-all]').check();await page.locator('[data-action=delete-selected]').click();
 await page.locator('#confirmation [data-action=confirm]').click();await expect(page.locator('.ledger-table tbody tr')).toHaveCount(0);await page.reload();await expect(page.locator('.ledger-table tbody tr')).toHaveCount(0);expect(errors).toEqual([]);
});
test('budget, payment card, savings running balance and backup roundtrip',async({page})=>{
 await ready(page);await page.getByRole('navigation').getByRole('link',{name:'관리',exact:true}).click();await page.locator('[data-manage-tab]').nth(2).click();
 await page.locator('[data-action=payment-form]').click();await page.getByLabel('이름',{exact:true}).fill('A 카드');await page.getByLabel('유형',{exact:true}).selectOption('credit_card');await page.getByLabel('결제일',{exact:true}).selectOption('14');await page.locator('#edit-form button[type=submit]').click();await expect(page.locator('.payment-card')).toContainText('매월 14일');
 await page.getByRole('navigation').getByRole('link',{name:'내역',exact:true}).click();await page.locator('.heading [data-action=add]').click();await page.getByLabel('내역명',{exact:true}).fill('카드 지출');await page.getByLabel('금액',{exact:true}).fill('12000');await page.getByLabel('결제수단',{exact:true}).selectOption({label:'A 카드'});await page.getByLabel('카테고리',{exact:true}).last().selectOption({label:'식비'});await page.locator('#edit-form button[type=submit]').click();await page.locator('#edit-form [data-action=close]').click();
 await page.getByRole('navigation').getByRole('link',{name:'예산',exact:true}).click();await page.locator('[data-action=budget-form]').click();await page.getByLabel('전체 예산',{exact:true}).fill('10000');await page.locator('#edit-form button[type=submit]').click();await expect(page.locator('.budget-hero')).toContainText('-2,000');await expect(page.locator('.budget-hero')).toContainText('120%');
 await page.getByRole('navigation').getByRole('link',{name:'저축',exact:true}).click();await page.locator('.heading [data-action=goal-form]').click();await page.getByLabel('목표명').fill('비상금');await page.getByLabel('목표 금액').fill('100000');await page.locator('#edit-form button[type=submit]').click();await page.locator('[data-goal]').click();await page.locator('[data-action=entry-form]').click();await page.getByLabel('금액',{exact:true}).fill('50000');await page.locator('#edit-form button[type=submit]').click();await expect(page.locator('.saving-banner')).toContainText('50,000');
 await page.locator('[data-goal]').click();await page.locator('[data-action=entry-form]').click();await page.getByLabel('유형',{exact:true}).selectOption('withdrawal');await page.getByLabel('금액',{exact:true}).fill('60000');await page.locator('#edit-form button[type=submit]').click();await expect(page.locator('#form-error')).toContainText('음수');
 await page.getByLabel('금액',{exact:true}).fill('10000');await page.locator('#edit-form button[type=submit]').click();await expect(page.locator('.saving-banner')).toContainText('40,000');
 await page.getByRole('navigation').getByRole('link',{name:'관리',exact:true}).click();await page.locator('[data-manage-tab]').last().click();
 const event=page.waitForEvent('download');await page.locator('[data-action=export]').click();const download=await event;const file=path.join(test.info().outputDir,'backup.json');await download.saveAs(file);const json=JSON.parse(await fs.readFile(file,'utf8'));expect(json.data.transactions).toHaveLength(1);expect(json.data.savingsEntries).toHaveLength(2);
 const bad=structuredClone(json);bad.schemaVersion=99;await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await expect(page.locator('#app-error')).toContainText('지원하지');
 await page.locator('#import-file').setInputFiles(file);await page.locator('[data-action=import-confirm]').click();await page.locator('#confirmation [data-action=confirm]').click();await expect(page.locator('[data-action=recovery]')).toBeVisible();await page.reload();await page.getByRole('navigation').getByRole('link',{name:'저축',exact:true}).click();await expect(page.locator('.saving-banner')).toContainText('40,000');
});
test('recurrence creation confirmation, skip persistence and multi-tab conflict',async({page,context})=>{
 await ready(page);await page.getByRole('navigation').getByRole('link',{name:'관리',exact:true}).click();await page.locator('[data-action=rule-form]').click();await page.getByLabel('내역명',{exact:true}).fill('정기 구독');await page.getByLabel('금액',{exact:true}).fill('5000');await page.locator('#edit-form button[type=submit]').click();await expect(page.locator('#confirmation')).toContainText('1건');await page.locator('#confirmation [data-action=confirm]').click();await expect(page.locator('[data-rule]')).toHaveCount(1);
 await page.getByRole('navigation').getByRole('link',{name:'내역',exact:true}).click();await expect(page.locator('.ledger-table [data-row]')).toHaveCount(1);await page.reload();await expect(page.locator('.ledger-table [data-row]')).toHaveCount(1);
 await page.locator('.ledger-table [data-row]').click();await page.locator('[data-action=transaction-edit]').click();await page.getByLabel('내역명',{exact:true}).fill('편집 중');
 const other=await context.newPage();await ready(other);await add(other,'다른 탭 기록','2000');
 await page.locator('#edit-form button[type=submit]').click();await expect(page.locator('#form-error')).toContainText('다른 탭');await expect(page.getByLabel('내역명',{exact:true})).toHaveValue('편집 중');await other.close();
});
test('PWA offline reopen and write survive reload',async({page,context})=>{
 await ready(page);await add(page,'오프라인 준비','1000');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 const manifest=await page.evaluate(async()=>await (await fetch('/manifest.webmanifest')).json());expect(manifest.display).toBe('standalone');
 await context.setOffline(true);await page.reload();await expect(page.locator('.ledger-table')).toContainText('오프라인 준비');await add(page,'오프라인 입력','2000');await page.reload();await expect(page.locator('.ledger-table')).toContainText('오프라인 입력');await expect(page.locator('.summary')).toContainText('3,000');await context.setOffline(false);
});

test('storage write failure keeps draft and previously committed data',async({page})=>{
 await ready(page);await add(page,'기존 기록','1000');await page.locator('.heading [data-action=add]').click();await page.getByLabel('내역명',{exact:true}).fill('보존할 초안');await page.getByLabel('금액',{exact:true}).fill('2000');
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;globalThis.restorePut=()=>IDBObjectStore.prototype.put=original;IDBObjectStore.prototype.put=function(...args){if(this.name==='transactions')throw new DOMException('저장 공간 부족','QuotaExceededError');return original.apply(this,args);};});
 await page.locator('#edit-form button[type=submit]').click();await expect(page.locator('#form-error')).toContainText('저장 공간 부족');await expect(page.getByLabel('내역명',{exact:true})).toHaveValue('보존할 초안');await expect(page.locator('.ledger-table tbody [data-row]')).toHaveCount(1);
 await page.evaluate(()=>globalThis.restorePut());await page.locator('#edit-form button[type=submit]').click();await expect(page.locator('.ledger-table tbody [data-row]')).toHaveCount(2);
});
for(const width of [320,768,1440])test(`live screens and validation states ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await ready(page);await add(page,'화면 검증','12000');
 async function verify(name){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(a.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);await page.screenshot({path:`test-results/live-${width}-${name}.png`,fullPage:true});}
 await verify('ledger');await page.locator('[data-action=filters]').click();await verify('filters');await page.locator('[data-view=calendar]').click();await verify('calendar');await page.locator('[data-ledger-tab]').last().click();await verify('statistics');
 for(const [name,key] of [['예산','budget'],['저축','savings'],['관리','manage']]){await page.getByRole('navigation').getByRole('link',{name,exact:true}).click();await verify(key);}
 for(let i=1;i<4;i++){await page.locator('[data-manage-tab]').nth(i).click();await verify('manage-'+i);}
});
