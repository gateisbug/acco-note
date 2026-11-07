import {cp,mkdir,readdir,readFile,writeFile,rm,lstat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const source=resolve('public'),destination=resolve('dist');
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});const result=[];for(const e of entries.sort((a,b)=>a.name.localeCompare(b.name))){const path=resolve(dir,e.name);if(e.isDirectory())result.push(...await files(path));else if(e.isFile())result.push(path);else throw Error('Deployment files must be regular files: '+path);}return result;}
const hash=createHash('sha256');for(const path of await files(source)){hash.update(relative(source,path).replaceAll('\\','/'));hash.update(await readFile(path));}
const buildId=hash.digest('hex').slice(0,16);
// Only clear the generated dist directory inside this workspace.
if(relative(process.cwd(),destination)!=='dist')throw Error('Unexpected output directory');
const existing=await lstat(destination).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
if(existing?.isSymbolicLink())throw Error('dist must not be a symbolic link');
await rm(destination,{recursive:true,force:true});
await mkdir(destination,{recursive:true});await cp(source,destination,{recursive:true});
const worker=await readFile(resolve(source,'sw.js'),'utf8');await writeFile(resolve(destination,'sw.js'),worker.replace('__BUILD_ID__',buildId));
await writeFile(resolve(destination,'.nojekyll'),'');
console.log(`GitHub Pages: dist/ · PWA v1 · build ${buildId}`);
