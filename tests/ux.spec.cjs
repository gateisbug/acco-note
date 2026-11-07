const {test,expect}=require('@playwright/test');
async function seed(page,extra=0){
 await page.goto('/');await page.waitForSelector('.toolbar');
 const ids=await page.evaluate(async extra=>{
  const D=await import('/core/domain.js'),DB=await import('/core/store.js');let ids;
  await DB.transact(DB.token(await DB.readStore()),s=>{
   s.meta.onboardingSeen=true;
   const c=s.categories.find(c=>c.kind==='expense'),other=s.categories.filter(c=>c.kind==='expense')[1];
   const p=D.saveNamed(s,'paymentMethods',{name:'검증 카드',type:'credit_card',paymentDay:15,archived:false});
   const expense=(title,amount,categoryId=null,paymentMethodId=null,date=D.today())=>D.saveTransaction(s,{title,kind:'expense',date,amount,memo:'',categoryId,paymentMethodId});
   expense('커피',1000,c.id,p.id);expense('쇼핑',9000,other.id);
   for(let i=0;i<extra;i++)expense('기록 '+i,100);
   const g=D.saveNamed(s,'savingsGoals',{name:'진행 목표',targetAmount:100000,startDate:D.today(),targetDate:D.dayAdd(D.today(),30),archived:false});
   D.saveNamed(s,'savingsGoals',{name:'보관 목표',targetAmount:100000,startDate:D.today(),targetDate:D.dayAdd(D.today(),30),archived:true});
   ids={category:c.id,payment:p.id,goal:g.id,today:D.today(),previous:D.dayAdd(D.today(),-1)};
  });return ids;
 },extra);await page.reload();await page.waitForSelector('.toolbar');return ids;
}
test('same filters across list, calendar, statistics and card drilldown',async({page})=>{
 const ids=await seed(page);await page.locator('[data-action=filters]').click();await page.locator(`[name=categories][value="${ids.category}"]`).check();await page.locator('[data-action=apply-filters]').click();
 await expect(page.locator('.ledger-table [data-row]')).toHaveCount(1);await expect(page.locator('.summary')).toContainText('지출1,000');
 await page.locator('[data-view=calendar]').click();await expect(page.locator(`[data-day="${ids.today}"]`)).toContainText('−1,000');
 await page.locator('[data-ledger-tab]').last().click();await expect(page.locator('.stats-section').first()).toContainText('1,000');await expect(page.locator('.stats-section').first()).not.toContainText('10,000');
 await page.locator('#navigation a[href="#manage"]').click();await page.locator('[data-manage-tab]').nth(2).click();await page.locator('[data-payment]').click();await page.locator('[data-action=payment-ledger]').click();
 await expect(page.locator('.ledger-table')).toBeVisible();await expect(page.locator('.ledger-table [data-row]')).toHaveCount(1);await expect(page.locator('.filter-scope')).toContainText('검증 카드');
});
test('continuous entry preserves choices and composition keeps the search node',async({page})=>{
 const ids=await seed(page);await page.locator('.heading [data-action=add]').click();await page.locator('[name=date]').evaluate((e,date)=>e._flatpickr.setDate(date,true),ids.previous);
 await page.locator('#edit-form [name=categoryId]').selectOption(ids.category);await page.locator('#edit-form [name=paymentMethodId]').selectOption(ids.payment);await page.locator('[name=title]').fill('연속 입력');await page.locator('[name=amount]').fill('2000');await page.locator('[name=memo]').fill('한 번만');await page.locator('#edit-form [type=submit]').click();
 await expect(page.locator('[name=title]')).toHaveValue('');await expect(page.locator('[name=date]')).toHaveValue(ids.previous);await expect(page.locator('#edit-form [name=categoryId]')).toHaveValue(ids.category);await expect(page.locator('#edit-form [name=paymentMethodId]')).toHaveValue(ids.payment);await expect(page.locator('[name=amount]')).toHaveValue('');await expect(page.locator('[name=memo]')).toHaveValue('');await expect(page.locator('[name=title]')).toBeFocused();
 await page.locator('#edit-form [data-action=close]').click();await expect(page.locator('.heading [data-action=add]')).toBeFocused();
 const result=await page.locator('#search').evaluate(e=>{e.focus();e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.value='커';e.dispatchEvent(new InputEvent('input',{data:'커',isComposing:true,bubbles:true}));const during=e.isConnected;e.value='커피';e.dispatchEvent(new CompositionEvent('compositionend',{data:'커피',bubbles:true}));return {during,after:e.isConnected,focus:document.activeElement===e};});
 expect(result).toEqual({during:true,after:true,focus:true});await expect(page.locator('.ledger-table [data-row]')).toHaveCount(1);await expect(page.locator('.summary')).toContainText('지출1,000');
});
test('bulk selection distinguishes loaded rows from all results',async({page})=>{
 await seed(page,40);await page.locator('[data-action=bulk]').click();await page.locator('[data-action=select-all]').check();await expect(page.locator('.selection-bar strong')).toHaveText('20건 선택');await expect(page.locator('[data-action=select-all]')).toHaveAttribute('aria-label','현재 표시된 내역 선택');
 await page.locator('[data-action=select-results]').click();await expect(page.locator('.selection-bar strong')).toHaveText('42건 선택');await page.locator('[data-action=delete-selected]').click();await expect(page.locator('#confirmation')).toContainText('42건');await page.locator('#confirmation [data-action=confirm]').click();await expect(page.locator('.ledger-table [data-row]')).toHaveCount(0);await page.reload();await expect(page.locator('.ledger-table [data-row]')).toHaveCount(0);
});
test('local detail return, distinct archived goals and collapsed budget limits preserve data',async({page})=>{
 const ids=await seed(page);await page.locator('#navigation a[href="#savings"]').click();await expect(page.locator('.completed-goals:not(.archived-goals) [data-goal]')).toHaveCount(0);await expect(page.locator('.archived-goals [data-goal]')).toHaveCount(1);
 await page.locator(`[data-goal="${ids.goal}"]`).click();expect(await page.locator('#inline-panel').evaluate(e=>e.previousElementSibling?.hasAttribute('data-goal'))).toBe(true);await page.locator('#inline-panel [data-action=close]').click();await expect(page.locator(`[data-goal="${ids.goal}"]`)).toBeFocused();
 await page.locator('#navigation a[href="#budget"]').click();await page.locator('[data-action=budget-form]').click();await expect(page.locator('.budget-limits')).not.toHaveAttribute('open','');await page.locator('[name=amount]').fill('100000');await page.locator('.budget-limits summary').click();await page.locator(`[name="limit-${ids.category}"]`).fill('20000');await page.locator('#edit-form [type=submit]').click();
 await page.locator('[data-action=budget-form]').click();await page.locator('[name=amount]').fill('120000');await page.locator('#edit-form [type=submit]').click();await expect(page.locator('.category-budget')).toContainText('20,000');
});
test('refund excess sign and mobile control usability',async({page})=>{
 await page.setViewportSize({width:390,height:844});const ids=await seed(page);
 await page.evaluate(async()=>{const D=await import('/core/domain.js'),DB=await import('/core/store.js');await DB.transact(DB.token(await DB.readStore()),s=>{const t=D.saveTransaction(s,{title:'이전 구매',kind:'expense',date:D.monthAdd(D.today(),-1)+'-01',amount:30000,memo:'',categoryId:null,paymentMethodId:null});D.saveRefund(s,{transactionId:t.id,date:D.today(),amount:30000,memo:''});});});await page.reload();await page.waitForSelector('.toolbar');
 expect(await page.locator('#search').evaluate(e=>e.getBoundingClientRect().width)).toBeGreaterThan(250);
 const targets=await page.locator('.month .icon-button,.view-toggle button,.row-detail-button').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));expect(targets.every(r=>r.w>=44&&r.h>=44)).toBe(true);
 await page.locator('[data-view=calendar]').click();await expect(page.locator(`[data-day="${ids.today}"]`)).toContainText('+20,000');await expect(page.locator(`[data-day="${ids.today}"]`)).not.toContainText('−-');await page.screenshot({path:'test-results/ux-mobile-calendar.png',fullPage:true});
});
