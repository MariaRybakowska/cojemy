import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';

function loadEnv(path){
 let text;try{text=readFileSync(path,'utf8');}catch(e){if(e.code==='ENOENT')return;throw e;}
 for(const line of text.split('\n')){
  const trimmed=line.trim();if(!trimmed||trimmed.startsWith('#'))continue;
  const cut=trimmed.indexOf('=');if(cut<1)continue;
  const key=trimmed.slice(0,cut).trim();let value=trimmed.slice(cut+1).trim();
  if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
  if(process.env[key]===undefined)process.env[key]=value;
 }
}

function fileStore(dir){
 mkdirSync(dir,{recursive:true});
 const path=join(dir,'pairs.json');
 return {
  async load(){try{return JSON.parse(readFileSync(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;return {};}},
  async save(pairs){writeFileSync(join(dir,'pairs.tmp'),JSON.stringify(pairs));renameSync(join(dir,'pairs.tmp'),path);}
 };
}

function supabaseStore(url,key){
 const endpoint=url.replace(/\/$/,'')+'/rest/v1/rpc/';
 const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'};
 async function call(name,body){
  let response;try{response=await fetch(endpoint+name,{method:'POST',headers,body:JSON.stringify(body)});}
  catch(e){console.error('supabase',name,e.message);throw new Error('Nie udało się połączyć z bazą.');}
  if(!response.ok){console.error('supabase',name,response.status,await response.text());throw new Error('Nie udało się zapisać w bazie.');}
  if(response.status===204)return null;return response.json();
 }
 return {
  async load(){const pairs=await call('load_pairs',{});return pairs&&typeof pairs==='object'?pairs:{};},
  async save(pairs){await call('save_pairs',{payload:pairs});}
 };
}

export function openStore(root){
 loadEnv(join(root,'.env'));
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(process.env.DATA_DIR)return fileStore(process.env.DATA_DIR);
 if(process.env.VERCEL){
  if(!url||!key)throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in the Vercel project environment variables. The .env file is not deployed.');
  return supabaseStore(url,key);
 }
 if(!url&&!key)return fileStore(join(root,'data'));
 if(!url||!key)throw new Error('Ustaw SUPABASE_URL i SUPABASE_SECRET_KEY albo usuń obie.');
 return supabaseStore(url,key);
}
