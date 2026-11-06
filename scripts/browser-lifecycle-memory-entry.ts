import { exportCompactGzip } from './src/engine/v2/stream-export';
declare const SENDER_SOURCE:string;
let sender:Worker,world:any,blob:Blob;
function request(type:string,extra:any={}){return new Promise<any>((resolve,reject)=>{sender.onmessage=e=>e.data.error?reject(Error(e.data.error)):resolve(e.data.result);sender.onerror=e=>reject(Error(e.message));sender.postMessage({type,...extra});});}
function freeze(v:any):any{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
export async function setup(){const url=URL.createObjectURL(new Blob([SENDER_SOURCE],{type:'text/javascript'}));sender=new Worker(url);URL.revokeObjectURL(url);await request('setup');}
export const start=()=>request('start');
export const advance=(month:number)=>request('advance',{month});
export const snapshot=()=>request('snapshot');
export async function transfer(){const t=performance.now();world=freeze((await request('transfer')).world);return {transferAndFreezeMs:performance.now()-t};}
export async function releaseSender(){sender.terminate();await new Promise(r=>setTimeout(r,0));return {senderTerminated:true};}
export async function exportJson(){const t=performance.now();const result=await exportCompactGzip(world);blob=result.blob;return {exportMs:performance.now()-t,jsonBytes:result.jsonBytes,blobBytes:blob.size,compression:'gzip'};}
export const summary=()=>({entities:world.entities,complete:world.complete,nextMonth:world.nextMonth,format:world.version});
