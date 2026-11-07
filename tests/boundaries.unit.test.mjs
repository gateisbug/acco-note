import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../public/core/domain.js';
const T='2026-11-07';
const tx=(s,changes={})=>D.saveTransaction(s,{kind:'expense',date:T,amount:10000,title:'기록',memo:'',categoryId:null,paymentMethodId:null,...changes},null,T);
const rule={title:'반복',amount:1000,anchorDate:'2026-11-01',endDate:null,frequency:'daily',memo:'',categoryId:null,paymentMethodId:null};
const goal=s=>D.saveNamed(s,'savingsGoals',{name:'목표',targetAmount:100000,startDate:'2026-11-01',targetDate:'2026-12-31',archived:false});
const budget=(month,amount)=>{const r={...D.meta(),month,amount};delete r.id;return r;};

test('date bounds, leap days, month ends and year rollover',()=>{
 for(const date of ['1900-01-01','2000-02-29','2024-02-29','2199-12-31'])assert.equal(D.dateOK(date),true,date);
 for(const date of ['1899-12-31','2200-01-01','1900-02-29','2026-02-29','2026-04-31','2026-13-01','2026-1-01','2026-11-07T00:00:00Z',null])assert.equal(D.dateOK(date),false,String(date));
 assert.equal(D.dayAdd('2024-02-28',1),'2024-02-29');assert.equal(D.dayAdd('2026-12-31',1),'2027-01-01');assert.equal(D.monthAdd('2026-01',-1),'2025-12');assert.equal(D.monthEnd('2024-02'),'2024-02-29');
});
test('transaction money accepts only bounded positive integer numbers',()=>{
 for(const amount of [1,999999999]){const s=D.newState();tx(s,{amount});assert.doesNotThrow(()=>D.validate(s,T));}
 for(const amount of [0,-1,0.5,1000000000,NaN,Infinity,'100',null]){const s=D.newState();tx(s,{amount});assert.throws(()=>D.validate(s,T),/금액/,String(amount));}
});
test('text rejects blank titles and limits Unicode codepoints',()=>{
 for(const title of ['', ' ', ' title', '😀'.repeat(101)]){const s=D.newState();tx(s,{title});assert.throws(()=>D.validate(s,T),/내역명/);}
 const s=D.newState();tx(s,{title:'😀'.repeat(100),memo:'메'.repeat(1000)});D.validate(s,T);s.transactions[0].memo+='모';assert.throws(()=>D.validate(s,T),/메모/);
});
test('income cannot reference expense category or payment method',()=>{
 const s=D.newState();tx(s,{kind:'income',categoryId:s.categories.find(c=>c.kind==='expense').id});assert.throws(()=>D.validate(s,T),/카테고리/);
 s.transactions=[];const p=D.saveNamed(s,'paymentMethods',{name:'현금',type:'cash',paymentDay:null,archived:false});tx(s,{kind:'income',paymentMethodId:p.id});assert.throws(()=>D.validate(s,T),/결제수단/);
});
test('payment days and normalized category names have independent constraints',()=>{
 for(const paymentDay of [1,31,null]){const s=D.newState();D.saveNamed(s,'paymentMethods',{name:'카드',type:'credit_card',paymentDay,archived:false});D.validate(s,T);}
 for(const [type,paymentDay] of [['credit_card',0],['credit_card',32],['credit_card',1.5],['cash',1]]){const s=D.newState();D.saveNamed(s,'paymentMethods',{name:'카드',type,paymentDay,archived:false});assert.throws(()=>D.validate(s,T),/결제일/);}
 const s=D.newState();D.saveNamed(s,'categories',{name:'ABC',kind:'expense',archived:false,isDefault:false});D.saveNamed(s,'categories',{name:'abc',kind:'expense',archived:true,isDefault:false});assert.throws(()=>D.validate(s,T),/같은 이름/);s.categories.at(-1).kind='income';D.validate(s,T);
});
test('partial refunds allow exact full refund but reject overflow and invalid dates',()=>{
 const base=D.newState(),t=tx(base,{date:'2026-11-02'});
 for(const [amount,date,valid] of [[10000,T,true],[10001,T,false],[100,'2026-11-01',false],[100,'2026-11-08',false]]){const s=structuredClone(base);D.saveRefund(s,{transactionId:t.id,amount,date,memo:''});if(valid)D.validate(s,T);else assert.throws(()=>D.validate(s,T),/환불/);}
 D.saveRefund(base,{transactionId:t.id,amount:4000,date:T,memo:''});const refund=D.saveRefund(base,{transactionId:t.id,amount:6000,date:T,memo:''});D.validate(base,T);D.saveRefund(base,{...refund,amount:6001},refund.id);assert.throws(()=>D.validate(base,T),/초과/);
});
test('income and scheduled transactions cannot be refunded',()=>{
 for(const changes of [{kind:'income'},{date:'2026-11-08'}]){const s=D.newState(),t=tx(s,changes);D.saveRefund(s,{transactionId:t.id,date:T,amount:1,memo:''});assert.throws(()=>D.validate(s,T),/확정 지출/);}
});
test('refund locks parent financial facts but follows edited descriptive links',()=>{
 const s=D.newState(),t=tx(s);D.saveRefund(s,{transactionId:t.id,date:T,amount:100,memo:''});
 for(const changes of [{amount:20000},{date:'2026-11-06'},{kind:'income'}])assert.throws(()=>D.saveTransaction(s,{...t,...changes},t.id,T),/환불/);
 const c=s.categories[0];D.saveTransaction(s,{...t,title:'변경',categoryId:c.id},t.id,T);const refund=D.events(s,T,T).find(r=>r.eventType==='refund');assert.equal(refund.title,'변경');assert.equal(refund.categoryId,c.id);
 D.deleteTransaction(s,t.id);assert.equal(s.transactions.length,0);assert.equal(s.refunds.length,0);D.validate(s,T);
});
test('zero budget is distinct from unset, category budget requires parent and expense kind',()=>{
 const s=D.newState();s.monthlyBudgets.push(budget('2026-11',0));D.validate(s,T);const c=s.categories[0];s.categoryBudgets.push({...budget('2026-11',0),categoryId:c.id});D.validate(s,T);
 const missing=structuredClone(s);missing.monthlyBudgets=[];assert.throws(()=>D.validate(missing,T),/전체 예산/);
 const wrong=structuredClone(s);wrong.categoryBudgets[0].categoryId=s.categories.find(c=>c.kind==='income').id;assert.throws(()=>D.validate(wrong,T),/지출 카테고리/);
 s.categoryBudgets.push({...s.categoryBudgets[0]});assert.throws(()=>D.validate(s,T),/중복/);
});
test('same-day withdrawals are order independent while historical deficits are rejected',()=>{
 const s=D.newState(),g=goal(s);D.saveEntry(s,{goalId:g.id,date:T,kind:'withdrawal',amount:100,memo:''});D.saveEntry(s,{goalId:g.id,date:T,kind:'deposit',amount:100,memo:''});D.validate(s,T);assert.equal(D.goalBalance(s,g.id),0n);
 s.savingsEntries[0].date='2026-11-06';assert.throws(()=>D.validate(s,T),/음수/);
});
test('savings date bounds and archived goals reject new entries',()=>{
 for(const date of ['2026-10-31','2026-11-08']){const s=D.newState(),g=goal(s);D.saveEntry(s,{goalId:g.id,date,kind:'deposit',amount:10,memo:''});assert.throws(()=>D.validate(s,T),/기록일/);}
 const s=D.newState(),g=goal(s);g.archived=true;assert.throws(()=>D.saveEntry(s,{goalId:g.id,date:T,kind:'deposit',amount:10,memo:''}),/보관/);
});
test('weekly recurrence respects inclusive end date and original anchor',()=>{
 const s=D.newState();D.saveRule(s,{...rule,frequency:'weekly',endDate:'2026-11-15'},null,'2026-11-01');assert.deepEqual(D.projected(s,'2026-11-01','2026-12-01').map(r=>r.date),['2026-11-08','2026-11-15']);D.reconcile(s,'2026-12-01');assert.deepEqual(s.transactions.map(r=>r.date),['2026-11-01','2026-11-08','2026-11-15']);D.validate(s,'2026-12-01');
});
test('same-day rule edits use latest tomorrow version without rewriting today',()=>{
 const s=D.newState(),r=D.saveRule(s,{...rule,anchorDate:T},null,T);D.saveRule(s,{...rule,anchorDate:T,amount:2000},r.id,T);D.saveRule(s,{...rule,anchorDate:T,amount:3000},r.id,T);assert.equal(s.transactions[0].amount,1000);assert.equal(D.projected(s,'2026-11-08','2026-11-08')[0].amount,3000);D.reconcile(s,'2026-11-08');D.reconcile(s,'2026-11-08');assert.equal(s.transactions.length,2);D.validate(s,'2026-11-08');
});
test('stop suppresses a materialized future occurrence and resume reuses its identity once',()=>{
 const s=D.newState(),r=D.saveRule(s,{...rule,anchorDate:T},null,T),v=D.projected(s,'2026-11-08','2026-11-08')[0],t=D.materialize(s,v,T),id=t.occurrenceId;D.stopRule(s,r.id,false,T);assert.equal(D.find(s,'recurrenceOccurrences',id).state,'suppressed');assert(!s.transactions.some(t=>t.occurrenceId===id));D.resumeRule(s,r.id,'2026-11-08',T);D.reconcile(s,'2026-11-08');D.reconcile(s,'2026-11-08');assert.equal(s.transactions.filter(t=>t.occurrenceId===id).length,1);D.validate(s,'2026-11-08');
});
test('deleted recurrence preserves history and cannot resume, edit or unskip',()=>{
 const s=D.newState(),r=D.saveRule(s,{...rule,anchorDate:T},null,T),t=s.transactions[0];D.deleteTransaction(s,t.id);D.stopRule(s,r.id,true,T);assert.throws(()=>D.resumeRule(s,r.id,T,T),/중지/);assert.throws(()=>D.saveRule(s,rule,r.id,T),/삭제/);assert.throws(()=>D.unskip(s,t.occurrenceId,T),/취소/);assert.deepEqual(D.projected(s,T,'2027-01-01'),[]);D.validate(s,T);
});
test('totals separate refunds, confirmed income, scheduled and skipped events',()=>{
 const rows=[{kind:'income',status:'confirmed',amount:1000},{kind:'expense',status:'confirmed',amount:600,eventType:'transaction'},{kind:'expense',status:'confirmed',amount:800,eventType:'refund'},{kind:'expense',status:'scheduled',amount:50},{kind:'expense',status:'skipped',amount:99}];assert.deepEqual(D.totals(rows),{income:1000n,expense:600n,refund:800n,net:-200n,balance:1200n,scheduled:50n});assert.equal(D.sum([{amount:9007199254740991},{amount:1}]),9007199254740992n);
});
