import type { CompactWorld } from './compact-log';
/** Client-only gzip export. Stream immutable rows; never retain JSON + UTF8 copies of the whole log. */
export async function exportCompactGzip(world: CompactWorld): Promise<{blob: Blob; jsonBytes: number}> {
  function* fragments(): Generator<string> {
    yield '{';
    let comma='';
    for(const key of Object.keys(world) as (keyof CompactWorld)[]){
      yield comma+JSON.stringify(key)+':';comma=',';
      if(key!=='log'){yield JSON.stringify(world[key]);continue;}
      yield '{';let logComma='';
      for(const field of Object.keys(world.log) as (keyof CompactWorld['log'])[]){
        yield logComma+JSON.stringify(field)+':';logComma=',';
        if(field!=='rows'){yield JSON.stringify(world.log[field]);continue;}
        yield '[';let rowComma='';
        for(const row of world.log.rows){
          // Packed rows normally contain only JSON numbers/arrays; preserve the
          // general JSON string contract for malformed or future quoted rows.
          const quoted = /["\\\u0000-\u001f]/.test(row) ? JSON.stringify(row) : '"'+row+'"';
          yield rowComma+quoted;rowComma=',';
        }
        yield ']';
      }
      yield '}';
    }
    yield '}';
  }
  const encoder=new TextEncoder(), buffer=new Uint8Array(65536);
  const compressed=new CompressionStream('gzip');
  const writer=compressed.writable.getWriter();
  const pendingBlob=new Response(compressed.readable,{headers:{'Content-Type':'application/gzip'}}).blob();
  // Attach immediately so a native stream failure is never an unhandled rejection.
  void pendingBlob.catch(()=>{});
  let jsonBytes=0, writes=0;
  async function write(text:string){
    let offset=0;
    while(offset<text.length){
      const {read,written}=encoder.encodeInto(text.slice(offset),buffer);
      // The native compressor can retain input after acknowledging a write.
      // Give it an owned chunk; reuse only the encoder scratch buffer.
      await writer.write(buffer.slice(0,written));
      if (++writes % 16 === 0) await new Promise<void>(resolve=>setTimeout(resolve,0));
      jsonBytes+=written;offset+=read;
    }
  }
  try {
    let chunk='';
    for(const fragment of fragments()){
      chunk+=fragment;
      if(chunk.length>=65536){await write(chunk);chunk='';}
    }
    if(chunk)await write(chunk);
    await writer.close();
    return {blob:await pendingBlob,jsonBytes};
  } catch(error) {
    await writer.abort(error).catch(()=>{});
    throw error;
  }
}
