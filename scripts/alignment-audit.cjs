const {chromium}=require('@playwright/test');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const results=[];fs.mkdirSync('artifacts/alignment',{recursive:true});
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});
  await page.goto('http://127.0.0.1:4173');await page.waitForSelector('.toolbar');
  await page.evaluate(async()=>{
   const D=await import('/core/domain.js'),DB=await import('/core/store.js');
   await DB.transact(DB.token(await DB.readStore()),s=>{
    s.meta.onboardingSeen=true;
    const p=D.saveNamed(s,'paymentMethods',{name:'Alignment card',type:'credit_card',paymentDay:15,archived:false});
    D.saveTransaction(s,{title:'Alignment transaction',kind:'expense',date:D.today(),amount:12000,memo:'Memo',categoryId:null,paymentMethodId:p.id});
    const g=D.saveNamed(s,'savingsGoals',{name:'Alignment goal',targetAmount:100000,startDate:D.today(),targetDate:D.dayAdd(D.today(),30),archived:false});
    D.saveEntry(s,{goalId:g.id,date:D.today(),kind:'deposit',amount:10000,memo:'Memo'});
    D.saveRule(s,{title:'Alignment recurring',amount:1000,frequency:'monthly',anchorDate:D.today(),endDate:null,categoryId:null,paymentMethodId:p.id,memo:''});
   });
  });await page.reload();await page.waitForSelector('.toolbar');
  async function inspect(name){
   const findings=await page.evaluate(()=>{
    const issues=[],visible=e=>e.getBoundingClientRect().height&&getComputedStyle(e).display!=='none',cy=e=>{const r=e.getBoundingClientRect();return r.y+r.height/2;};
    for(const e of document.querySelectorAll('button:is(.button,.primary,.icon-button,.row-detail-button) .icon,.view-toggle button .icon,.category-icon .icon')){
     if(!visible(e))continue;const p=e.closest('button,.category-icon');if(Math.abs(cy(e)-cy(p))>1)issues.push({type:'icon',element:p.outerHTML.slice(0,180),offset:+(cy(e)-cy(p)).toFixed(2)});
    }
    for(const p of document.querySelectorAll('.heading,.section-title,.panel-header,.month,.inline-form-actions,.completed-goals>summary,.mini-tabs,.entry-line,.selection-bar>div,.panel-footer,.section-heading')){
     const children=[...p.children].filter(visible);if(children.length<2)continue;
     const centers=children.map(cy),offset=Math.max(...centers)-Math.min(...centers);
     // Only compare children sharing the same horizontal line.
     const sameLine=children.every(e=>{const r=e.getBoundingClientRect(),first=children[0].getBoundingClientRect();return r.top<first.bottom&&r.bottom>first.top;});
     if(sameLine&&offset>1)issues.push({type:'row',element:p.className,offset:+offset.toFixed(2)});
    }
    return issues;
   });
   results.push({width,name,findings});await page.screenshot({path:`artifacts/alignment/${width}-${name}.png`,fullPage:true});
  }
  await inspect('ledger');await page.locator('.heading [data-action=add]').click();await inspect('transaction-form');
  await page.locator('[data-action=cancel-edit]').count().then(async n=>{if(n)await page.locator('[data-action=cancel-edit]').click();else await page.reload();});
  await page.locator('.row-detail-button').first().click();await inspect('transaction-detail');
  await page.locator('[data-action=refund-form]').first().click();await inspect('refund-form');await page.reload();await page.waitForSelector('.toolbar');
  await page.locator('[data-action=bulk]').click();await inspect('selection');await page.reload();await page.waitForSelector('.toolbar');
  for(const key of ['budget','savings','manage']){
   await page.locator(`#navigation a[href="#${key}"]`).click();await inspect(key);
   if(key==='savings'){await page.locator('[data-goal]').first().click();await inspect('goal-detail');await page.locator('[data-action=entry-form]').click();await inspect('entry-form');await page.reload();await page.waitForSelector('main .heading');}
   if(key==='manage'){
    await page.locator('[data-rule]').first().click();await inspect('rule-detail');await page.reload();await page.waitForSelector('main .heading');
    for(let i=1;i<4;i++){
     await page.locator('[data-manage-tab]').nth(i).click();await inspect('manage-'+i);
     const action={1:'category-form',2:'payment-form'}[i];
     if(action){await page.locator(`[data-action=${action}]`).first().click();await inspect(action);await page.reload();await page.waitForSelector('main .heading');}
    }
   }
  }
  for(const [key,action] of [['budget','budget-form'],['savings','goal-form'],['manage','rule-form']]){
   await page.locator(`#navigation a[href="#${key}"]`).click();
   if(key==='manage')await page.locator('[data-manage-tab]').first().click();
   await page.locator(`[data-action="${action}"]`).first().click();await inspect(action);await page.reload();await page.waitForSelector('main .heading');
  }
  await page.close();
 }
 fs.writeFileSync('artifacts/alignment/report.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.filter(r=>r.findings.length),null,2));
 console.log(`${results.length} states inspected`);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
