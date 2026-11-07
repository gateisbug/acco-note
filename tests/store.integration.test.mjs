import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import * as D from '../public/core/domain.js';
import * as DB from '../public/core/store.js';
import {exportBackup} from '../public/core/backup.js';
const transaction=(s,amount=10000,date=D.today())=>D.saveTransaction(s,{kind:'expense',date,amount,title:'record',memo:'',categoryId:null,paymentMethodId:null});
async function database(fn){globalThis.indexedDB=new IDBFactory();const saved=globalThis.BroadcastChannel;globalThis.BroadcastChannel=undefined;try{await fn(await DB.openStore());}finally{DB.closeStore();globalThis.BroadcastChannel=saved;}}
test('initialization and reopen preserve defaults without duplicate categories',()=>database(async s=>{assert.equal(s.transactions.length,0);assert.equal(s.categories.length,15);const ids=s.categories.map(c=>c.id);DB.closeStore();const reopened=await DB.openStore();assert.deepEqual(reopened.categories.map(c=>c.id).sort(),ids.sort());assert.deepEqual(DB.token(reopened),DB.token(s));}));
test('related transaction and refund are committed together and reads are detached',()=>database(async s=>{s=await DB.transact(DB.token(s),s=>{const t=transaction(s);D.saveRefund(s,{transactionId:t.id,date:D.today(),amount:1000,memo:''});});assert.equal(s.transactions.length,1);assert.equal(s.refunds.length,1);s.transactions[0].amount=1;const actual=await DB.readStore();assert.equal(actual.transactions[0].amount,10000);assert.equal(D.totals(D.events(actual,D.today(),D.today())).net,9000n);}));
test('two concurrent writers using one token commit exactly one update',()=>database(async s=>{const token=DB.token(s);const results=await Promise.allSettled([DB.transact(token,s=>transaction(s,100)),DB.transact(token,s=>transaction(s,200))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/다른 탭/);const after=await DB.readStore();assert.equal(after.transactions.length,1);assert.equal(after.meta.sequence,token.sequence+1);}));
test('write failure after clears and puts rolls back every store and sequence',()=>database(async s=>{
 s=await DB.transact(DB.token(s),s=>{const t=transaction(s);D.saveRefund(s,{transactionId:t.id,date:D.today(),amount:1000,memo:''});});const before=await DB.readStore();
 const {IDBObjectStore}=await import('fake-indexeddb'),original=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(...args){if(this.name==='refunds')throw new DOMException('injected failure','QuotaExceededError');return original.apply(this,args);};
 try{await assert.rejects(DB.transact(DB.token(s),s=>{s.transactions[0].title='changed';s.categories[0].name='changed';}),/injected failure/);}finally{IDBObjectStore.prototype.put=original;}
 assert.deepEqual(await DB.readStore(),before);DB.closeStore();assert.deepEqual(await DB.openStore(),before);
}));
test('invalid replacement preserves current data and the existing recovery snapshot',()=>database(async s=>{
 s=await DB.transact(DB.token(s),s=>transaction(s,500));s=await DB.transact(DB.token(s),s=>transaction(s,700),{restore:exportBackup(D.newState()).data});const before=await DB.readStore(),bad=exportBackup(D.newState()).data;bad.categories[0].name='';
 await assert.rejects(DB.transact(DB.token(before),()=>{},{restore:bad}),/이름/);assert.deepEqual(await DB.readStore(),before);assert.equal(before.recovery.data.transactions[0].amount,500);
}));
test('successful restore changes generation and invalidates older edits even with matching sequence',()=>database(async s=>{
 const old=DB.token(s);s=await DB.transact(old,()=>{},{restore:exportBackup(D.newState()).data});assert.notEqual(s.meta.generation,old.generation);
 await assert.rejects(DB.transact({...DB.token(s),generation:old.generation},s=>transaction(s)),/다른 탭/);assert.equal((await DB.readStore()).transactions.length,0);
}));
test('startup confirms due records once and repeated due sync does not advance sequence',()=>database(async s=>{
 s=await DB.transact(DB.token(s),s=>{const t=transaction(s,100,D.today());t.status='scheduled';});const sequence=s.meta.sequence;DB.closeStore();const reopened=await DB.openStore();assert.equal(reopened.transactions[0].status,'confirmed');assert.equal(reopened.meta.sequence,sequence+1);const synced=await DB.syncDue();assert.deepEqual(DB.token(synced),DB.token(reopened));assert.equal(synced.transactions.length,1);
}));
test('IndexedDB atomic rollback, conflicts, reopen and restore recovery',async()=>{globalThis.indexedDB=new IDBFactory();const savedBC=globalThis.BroadcastChannel;globalThis.BroadcastChannel=undefined;try{let s=await DB.openStore();const token=DB.token(s);s=await DB.transact(token,s=>transaction(s,700,D.today()));await assert.rejects(DB.transact(token,s=>transaction(s)),/다른 탭/);const before=await DB.readStore();await assert.rejects(DB.transact(DB.token(before),s=>{s.transactions[0].amount=-1;}),/금액/);assert.equal((await DB.readStore()).transactions[0].amount,700);const fresh=D.newState();const replaced=await DB.transact(DB.token(before),()=>{},{restore:exportBackup(fresh).data});assert.equal(replaced.transactions.length,0);assert.equal(replaced.recovery.data.transactions.length,1);DB.closeStore();const reopened=await DB.openStore();assert.equal(reopened.transactions.length,0);assert.equal(reopened.recovery.data.transactions.length,1);}finally{DB.closeStore();globalThis.BroadcastChannel=savedBC;}});
