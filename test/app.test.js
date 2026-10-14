import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {match,meals} from '../meals.js';
import {validateRecipe} from '../custom-recipes.js';
const p=(overrides={})=>({moods:['ciepłe'],exclude:[],methods:['cook','order','other'],dislikes:'',energy:2,...overrides});
test('bez mięsa i ryb, wykluczenia i maksymalnie trzy dania',()=>{const prefs=[p(),p({exclude:['gluten','nabiał','ryby','jajka'],methods:['cook'],energy:1})];const result=match(prefs);assert.ok(result.length>0&&result.length<=3);for(const m of result){assert.ok(!m.contains.includes('mięso')&&!m.contains.includes('ryby'));assert.equal(m.contains.length,0);}});
test('zamawianie bez gotowania',()=>{const result=match([p({methods:['order']}),p({methods:['order']})]);assert.equal(result.length,3);assert.ok(result.every(m=>m.kind==='order'));});
test('jedna osoba może gotować za dwoje',()=>{const result=match([p({methods:['cook']}),p({methods:['other'],energy:1})]);assert.ok(result.length>0);assert.ok(result.every(m=>m.kind==='cook'));});
test('różne sposoby jedzenia dają pusty wynik',()=>assert.equal(match([p({methods:['cook']}),p({methods:['order']})]).length,0));
test('nielubiane składniki, odmiana słów i pomijanie',()=>{const prefs=[p({dislikes:'tofu, pomidory, ogórki'}),p()];for(const m of match(prefs))assert.ok(!/tofu|pomidor|ogórek/i.test([m.name,...m.ingredients].join(' ')));const all=match([p(),p()]);assert.ok(match([p(),p()],all.map(m=>m.id)).every(m=>!all.some(a=>a.id===m.id)));});
const customInput={name:'Ryż z brokułem',url:'https://example.com/recipe',ingredients:'ryż, brokuł, tofu',minutes:25,energy:1,tags:['ciepłe'],contains:[],meatless:true};
test('kolekcja ma źródła i wyraźnie oznaczone adaptacje',()=>{assert.equal(meals.filter(m=>m.url).length,8);assert.ok(meals.every(m=>m.ingredients.length&&m.source));assert.ok(meals.filter(m=>m.source==='Serious Eats').some(m=>m.adaptation));});
test('własny link: poprawny URL, potwierdzenie i składniki',()=>{assert.equal(validateRecipe(customInput).source,'example.com');assert.throws(()=>validateRecipe({...customInput,url:'javascript:alert(1)'}));assert.throws(()=>validateRecipe({...customInput,url:'https://login:secret@example.com/'}));assert.throws(()=>validateRecipe({...customInput,meatless:false}));assert.throws(()=>validateRecipe({...customInput,ingredients:'kurczak, ryż'}));assert.doesNotThrow(()=>validateRecipe({...customInput,ingredients:'kurczak roślinny, ryż'}));assert.ok(validateRecipe({...customInput,ingredients:'makaron, feta'}).contains.includes('nabiał'));assert.ok(!validateRecipe({...customInput,ingredients:'ryż, mleko roślinne, jogurt wegański'}).contains.includes('nabiał'));assert.ok(!validateRecipe({...customInput,ingredients:'ryż, mleko kokosowe'}).contains.includes('nabiał'));});
test('własne przepisy nie omijają wykluczeń ani nakładu pracy',()=>{const r={...validateRecipe(customInput),id:'test'};assert.ok(match([p(),p()],[],[r],'cook').some(m=>m.id==='test'));assert.ok(!match([p({dislikes:'tofu'}),p()],[],[r],'cook').some(m=>m.id==='test'));assert.ok(match([p(),p()],[],[r],'order').every(m=>m.kind==='order'));});
test('dwie sesje, wspólna decyzja, trwałość i reset',async()=>{
 const data=await mkdtemp(join(tmpdir(),'cojemy-test-'));let child;let currentRound=1;
 async function start(){child=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'3107',HOST:'127.0.0.1',DATA_DIR:data,VERCEL:''},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('Server exited '+code)));});}
 async function stop(){const done=new Promise(resolve=>child.once('exit',resolve));child.kill();await done;}
 async function call(path,body,auth){if(body&&auth)body={round:currentRound,...body};const r=await fetch('http://127.0.0.1:3107/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(data.round)currentRound=data.round;return {status:r.status,data};}
 try{await start();const a=(await call('create',{name:'Ala'})).data;const b=(await call('join',{name:'Olek',code:a.code.toLowerCase()})).data;assert.equal((await call('join',{name:'Trzecia',code:a.code})).status,409);assert.equal((await call('state')).status,401);assert.ok(!JSON.stringify((await call('state',null,a.token)).data).includes(b.token));
 await call('preferences',{...p(),round:1},a.token);const ready=(await call('preferences',{...p(),round:1},b.token)).data;assert.equal(ready.ready,true);const id=ready.matches[0].id;
 await call('vote',{id,round:1},a.token);const agreed=(await call('vote',{id,round:1},b.token)).data;assert.ok(agreed.people.every(x=>x.vote===id));assert.equal((await call('skip',{id,round:1},a.token)).status,409);
 await stop();await start();assert.ok((await call('state',null,a.token)).data.people.every(x=>x.vote===id));const reset=(await call('reset',{},a.token)).data;assert.equal(reset.round,2);assert.ok(reset.people.every(x=>!x.preferences&&!x.vote));assert.equal((await call('preferences',{...p(),round:1},b.token)).status,409);
 await call('preferences',{...p({dislikes:'cebula'}),round:2},a.token);const next=(await call('preferences',{...p(),round:2},b.token)).data;
 const first=next.matches[0].id,second=next.matches[1].id;
 await call('vote',{id:first,round:2},a.token);const split=(await call('vote',{id:second,round:2},b.token)).data;
 assert.deepEqual(split.finalists,[first,second]);assert.ok(split.people.every(p=>!p.finalVote));
 assert.equal((await call('vote',{id:first,round:2},b.token)).status,409);
 const half=(await call('finalize',{id:second,round:2},a.token)).data;assert.ok(!half.people.every(p=>p.finalVote===second));
 const final=(await call('finalize',{id:second,round:2},b.token)).data;assert.ok(final.people.every(p=>p.finalVote===second));
 const last=(await call('reset',{},a.token)).data;assert.equal(last.people.find(p=>p.id===a.me).dislikes,'cebula');assert.deepEqual(last.finalists,[]);
 await call('preferences',{...p(),round:3},a.token);let cooking=(await call('preferences',{...p(),round:3},b.token)).data;
 cooking=(await call('browse',{kind:'cook',round:3},a.token)).data;assert.ok(cooking.matches.every(m=>m.url||m.source==='cojemy'));
 const initial=cooking.matches.map(m=>m.id);await call('vote',{id:initial[0],round:3},a.token);
 const more=(await call('more',{kind:'cook',round:3},b.token)).data;assert.ok(more.matches.every(m=>!initial.includes(m.id)));assert.ok(more.people.every(p=>!p.vote));
 const order=(await call('browse',{kind:'order',round:3},b.token)).data;assert.ok(order.matches.every(m=>m.kind==='order'));
 const added=(await call('recipe',{...customInput,round:3},a.token)).data;assert.equal(added.recipes.length,1);assert.equal(added.matches[0].name,customInput.name);
 assert.equal((await call('recipe',{...customInput,round:3},a.token)).status,409);
 assert.equal((await call('state',null,b.token)).data.recipes[0].url,customInput.url);
 await stop();await start();assert.equal((await call('state',null,a.token)).data.recipes.length,1);
 const recipeId=added.recipes[0].id;await call('vote',{id:recipeId,round:3},a.token);await call('vote',{id:recipeId,round:3},b.token);
 assert.equal((await call('more',{kind:'cook',round:3},a.token)).status,409);
 const newRound=(await call('reset',{},a.token)).data;assert.equal(newRound.recipes.length,1);
 await call('preferences',{...p({exclude:['gluten','nabiał','jajka','orzechy'],dislikes:'ryż, pieczarki, ziemniaki, soczewica',methods:['cook']}),round:4},a.token);
 const empty=(await call('preferences',{...p({methods:['other']}),round:4},b.token)).data;assert.equal(empty.matches.length,0);
 const stillEmpty=(await call('browse',{kind:'order',round:4},a.token)).data;assert.equal(stillEmpty.matches.length,0);
 assert.equal((await call('recipe',{...customInput,round:3},a.token)).status,409);


 }finally{if(child?.exitCode===null)await stop();await rm(data,{recursive:true,force:true});}
});
