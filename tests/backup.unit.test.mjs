import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../public/core/domain.js';
import {strictJSON,importBackup,exportBackup} from '../public/core/backup.js';
const T='2026-11-07';
const backup=()=>exportBackup(D.newState());
test('strict JSON accepts escaped strings, primitive values and standard whitespace',()=>{for(const value of [null,true,0,-12.3,[1,'x\n"\\',null],{a:{b:[false,1e20]}}])assert.deepEqual(JSON.parse(JSON.stringify(strictJSON(' \t\r\n'+JSON.stringify(value)))),value);});
test('duplicate decoded keys, truncated JSON, trailing data and excessive depth are rejected',()=>{
 for(const source of ['{"a":1,"\\u0061":2}','{"nested":{"x":1,"x":2}}','[1,]','{"a":1,}','{"a":','"unterminated','true false','01','['.repeat(51)+'0'+']'.repeat(51)])assert.throws(()=>strictJSON(source),undefined,source);
});
test('non-JSON whitespace is rejected',()=>{for(const source of ['\u00a0{}','{}\v','[1,\u20032]'])assert.throws(()=>strictJSON(source),undefined,JSON.stringify(source));});
test('backup identity, version, timezone, currency and exact settings schema',()=>{
 for(const mutate of [f=>f.schemaVersion=2,f=>f.currency='USD',f=>f.timezone='UTC',f=>delete f.data.refunds,f=>f.data.settings.extra=true,f=>f.data.settings.ledgerView='other',f=>f.data.transactions={},f=>delete f.data.categories[0].name]){const f=backup();mutate(f);assert.throws(()=>importBackup(JSON.stringify(f),T));}
});
test('backup rejects duplicate IDs and noncanonical UUID structure',()=>{
 const duplicate=backup();duplicate.data.categories.push({...duplicate.data.categories[0],name:'다른 이름'});assert.throws(()=>importBackup(JSON.stringify(duplicate),T),/중복/);
 const f=backup();f.data.categories[0].id='12345678-'+'a'.repeat(27);assert.throws(()=>importBackup(JSON.stringify(f),T),/UUID/);
});
test('backup metadata requires valid UTC ISO timestamps',()=>{
 for(const value of ['2026-11-07','11/07/2026','2026-02-30T00:00:00.000Z','2026-11-07T09:00:00+09:00']){const f=backup();f.data.categories[0].updatedAt=value;assert.throws(()=>importBackup(JSON.stringify(f),T),undefined,value);}
 const f=backup();f.exportedAt='2026-11-07';assert.throws(()=>importBackup(JSON.stringify(f),T),/생성일/);
});
test('backup export does not include internal state or normalized names and roundtrips',()=>{
 const s=D.newState(),f=exportBackup(s);assert(!('meta' in f.data));assert(!('recovery' in f.data));assert(!('normalizedName' in f.data.categories[0]));const imported=importBackup(JSON.stringify(f),T);assert.equal(imported.data.categories.length,s.categories.length);assert.equal(imported.data.categories[0].normalizedName,D.norm(s.categories[0].name));
});
