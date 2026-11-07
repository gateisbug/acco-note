import {TABLES,newState,validate,reconcile,uuid,today} from './domain.js';
import {exportBackup} from './backup.js';
const NAME='acco-note',VERSION=1,STORES=[...TABLES,'settings','appMeta','recoverySnapshots'];
let db,channel;
export function closeStore(){channel?.close();db?.close();channel=null;db=null;}
export function token(s){return {generation:s.meta.generation,sequence:s.meta.sequence};}
export async function openStore(onChange=()=>{}){
 if(!globalThis.indexedDB)throw Error('이 브라우저에서 저장소를 사용할 수 없습니다.');
 db=await new Promise((resolve,reject)=>{const request=indexedDB.open(NAME,VERSION);request.onupgradeneeded=()=>{const d=request.result;for(const t of TABLES){const keyPath=t==='monthlyBudgets'?'month':t==='categoryBudgets'?['month','categoryId']:'id';const st=d.createObjectStore(t,{keyPath});if(t==='transactions'){st.createIndex('date','date');st.createIndex('categoryId','categoryId');st.createIndex('paymentMethodId','paymentMethodId');}if(t==='refunds')st.createIndex('transactionId','transactionId');if(t==='savingsEntries')st.createIndex('goalId','goalId');if(t==='recurrenceOccurrences')st.createIndex('original',['ruleId','originalDate'],{unique:true});}for(const t of ['settings','appMeta','recoverySnapshots'])d.createObjectStore(t);};request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('다른 탭을 닫고 다시 시도해 주세요.'));request.onsuccess=()=>resolve(request.result);});
 db.onversionchange=()=>{db.close();onChange('version');};
 if(globalThis.BroadcastChannel){channel=new BroadcastChannel('acco-note-changes');channel.onmessage=()=>onChange('change');}
 return transact(null,s=>{reconcile(s);},{initialize:true});
}
function readIn(tx,done){const s={},pending=STORES.length;let n=0;for(const t of STORES){const request=TABLES.includes(t)?tx.objectStore(t).getAll():tx.objectStore(t).get(t==='settings'?'preferences':t==='appMeta'?'state':'beforeImport');request.onsuccess=()=>{s[t==='appMeta'?'meta':t==='recoverySnapshots'?'recovery':t]=request.result;if(++n===pending)done(s);};}}
export function readStore(){return new Promise((resolve,reject)=>{const tx=db.transaction(STORES,'readonly');let result;readIn(tx,s=>result=s);tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(tx.error||Error('데이터를 읽을 수 없습니다.'));});}
export function transact(expected,mutate,{initialize=false,restore=null}={}){
 return new Promise((resolve,reject)=>{let result,error;const tx=db.transaction(STORES,'readwrite');readIn(tx,s=>{try{
   if(!s.meta){if(!initialize)throw Error('저장소가 초기화되지 않았습니다.');s=newState();}
   if(expected&&(s.meta.generation!==expected.generation||s.meta.sequence!==expected.sequence))throw Object.assign(Error('다른 탭에서 데이터가 변경되었습니다. 입력을 유지했으니 최신 내용을 확인한 뒤 다시 저장해 주세요.'),{conflict:true});
   const before=JSON.stringify(s);const T=today();
   if(restore){const prior=exportBackup(s),oldMeta=s.meta;s={...structuredClone(restore),meta:{...oldMeta,generation:uuid()},recovery:prior};}
   mutate(s,T);validate(s,T);
   if(!initialize||before!==JSON.stringify(s)||s.meta.sequence===0){s.meta.sequence++;for(const t of TABLES){const store=tx.objectStore(t);store.clear();s[t].forEach(r=>store.put(r));}tx.objectStore('settings').put(s.settings,'preferences');tx.objectStore('appMeta').put(s.meta,'state');if(s.recovery)tx.objectStore('recoverySnapshots').put(s.recovery,'beforeImport');}
   result=s;
 }catch(e){error=e;tx.abort();}});
 tx.oncomplete=()=>{channel?.postMessage('changed');resolve(result);};
 tx.onabort=()=>reject(error||tx.error||Error('저장하지 못했습니다. 저장 공간과 브라우저 설정을 확인해 주세요.'));
 tx.onerror=()=>{};
 });
}
export async function syncDue(){return transact(null,s=>{reconcile(s);},{initialize:true});}
