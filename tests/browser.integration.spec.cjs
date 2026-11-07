const {test,expect}=require('@playwright/test');
async function ready(page){await page.goto('/');await page.waitForSelector('.toolbar');}
test('real IndexedDB abort restores every table after partial writes',async({page})=>{
 await ready(page);const result=await page.evaluate(async()=>{
  const D=await import('/core/domain.js'),DB=await import('/core/store.js');let s=await DB.readStore();
  s=await DB.transact(DB.token(s),s=>{const t=D.saveTransaction(s,{title:'보존 거래',kind:'expense',date:D.today(),amount:10000,memo:'',categoryId:null,paymentMethodId:null});D.saveRefund(s,{transactionId:t.id,date:D.today(),amount:1000,memo:''});});
  const before=JSON.stringify(await DB.readStore()),original=IDBObjectStore.prototype.put;let message;
  IDBObjectStore.prototype.put=function(...args){if(this.name==='refunds')throw new DOMException('write interruption','QuotaExceededError');return original.apply(this,args);};
  try{await DB.transact(DB.token(s),s=>{s.transactions[0].title='불완전 수정';s.categories[0].name='불완전 분류';});}catch(e){message=e.message;}finally{IDBObjectStore.prototype.put=original;}
  return {unchanged:before===JSON.stringify(await DB.readStore()),message};
 });expect(result).toEqual({unchanged:true,message:'write interruption'});await page.reload();await expect(page.locator('.ledger-table')).toContainText('보존 거래');await expect(page.locator('.summary')).toContainText('9,000');
});
test('replacement in another tab invalidates an open draft without restoring deleted data',async({page,context})=>{
 await ready(page);await page.locator('.heading [data-action=add]').click();await page.locator('[name=title]').fill('유지할 초안');await page.locator('[name=amount]').fill('1200');
 const other=await context.newPage();await ready(other);await other.evaluate(async()=>{const D=await import('/core/domain.js'),DB=await import('/core/store.js'),B=await import('/core/backup.js');const s=await DB.readStore();await DB.transact(DB.token(s),()=>{},{restore:B.exportBackup(D.newState()).data});});
 await page.locator('#edit-form [type=submit]').click();await expect(page.locator('#form-error')).toContainText('다른 탭');await expect(page.locator('[name=title]')).toHaveValue('유지할 초안');
 expect(await other.evaluate(async()=>{const DB=await import('/core/store.js');return (await DB.readStore()).transactions.length;})).toBe(0);await other.close();
});
test('real browser reopening materializes missed recurrence dates exactly once',async({page})=>{
 await ready(page);await page.evaluate(async()=>{const D=await import('/core/domain.js'),DB=await import('/core/store.js');const past=D.dayAdd(D.today(),-2),s=await DB.readStore();await DB.transact(DB.token(s),s=>D.saveRule(s,{title:'도래 검증',amount:1000,anchorDate:past,endDate:D.today(),frequency:'daily',memo:'',categoryId:null,paymentMethodId:null},null,past));});
 for(let i=0;i<2;i++){await page.reload();await page.waitForSelector('.toolbar');const result=await page.evaluate(async()=>{const D=await import('/core/domain.js'),DB=await import('/core/store.js');const s=await DB.readStore();return {count:s.transactions.length,dates:new Set(s.transactions.map(t=>t.date)).size,total:D.sum(s.transactions).toString(),confirmed:s.transactions.every(t=>t.status==='confirmed')};});expect(result).toEqual({count:3,dates:3,total:'3000',confirmed:true});}
});
test('category archive and restore preserve old transactions while controlling new choices',async({page})=>{
 await ready(page);await page.locator('#navigation a[href="#manage"]').click();await page.locator('[data-manage-tab]').nth(1).click();await page.locator('[data-action=category-form]').click();await page.locator('[name=name]').fill('통합 검증 분류');await page.locator('#edit-form [type=submit]').click();
 await page.locator('#navigation a[href="#ledger"]').click();await page.locator('.heading [data-action=add]').click();await page.locator('[name=title]').fill('연결 내역');await page.locator('[name=amount]').fill('1000');await page.locator('#edit-form [name=categoryId]').selectOption({label:'통합 검증 분류'});await page.locator('#edit-form [type=submit]').click();await page.locator('#edit-form [data-action=close]').click();
 await page.locator('#navigation a[href="#manage"]').click();await page.locator('[data-category]').filter({hasText:'통합 검증 분류'}).click();await page.locator('[data-action=named-archive]').click();await page.locator('#confirmation [data-action=confirm]').click();
 await page.locator('#navigation a[href="#ledger"]').click();await expect(page.locator('.ledger-table')).toContainText('통합 검증 분류');await page.locator('.heading [data-action=add]').click();await expect(page.locator('#edit-form [name=categoryId] option').filter({hasText:'통합 검증 분류'})).toHaveCount(0);await page.locator('#edit-form [data-action=close]').click();
 await page.locator('#navigation a[href="#manage"]').click();await page.locator('[data-action=archive-toggle]').click();await page.locator('[data-category]').filter({hasText:'통합 검증 분류'}).click();await page.locator('[data-action=named-archive]').click();await page.locator('#confirmation [data-action=confirm]').click();
 await page.locator('#navigation a[href="#ledger"]').click();await page.locator('.heading [data-action=add]').click();await expect(page.locator('#edit-form [name=categoryId] option').filter({hasText:'통합 검증 분류'})).toHaveCount(1);
});
test('budget copy replaces destination only and keeps source unchanged after reload',async({page})=>{
 await ready(page);await page.locator('#navigation a[href="#budget"]').click();await page.locator('[data-action=budget-form]').click();await page.locator('[name=amount]').fill('50000');await page.locator('.budget-limits summary').click();await page.locator('.budget-limits input').first().fill('10000');await page.locator('#edit-form [type=submit]').click();
 await page.locator('[data-action=next-month]').click();await page.locator('[data-action=budget-form]').click();await page.locator('[name=amount]').fill('20000');await page.locator('#edit-form [type=submit]').click();await page.locator('[data-action=budget-copy]').click();await page.locator('#edit-form [type=submit]').click();await expect(page.locator('#confirmation')).toContainText('대체');await page.locator('#confirmation [data-action=confirm]').click();await expect(page.locator('.budget-hero')).toContainText('50,000');await expect(page.locator('.category-budget')).toContainText('10,000');
 await page.reload();await page.waitForSelector('.budget-hero');const state=await page.evaluate(async()=>{const DB=await import('/core/store.js'),s=await DB.readStore();return {budgets:s.monthlyBudgets.map(b=>b.amount),limits:s.categoryBudgets.map(b=>b.amount)};});expect(state.budgets).toEqual([50000,50000]);expect(state.limits).toEqual([10000,10000]);
});
