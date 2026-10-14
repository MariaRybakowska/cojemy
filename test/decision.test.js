import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {analyzeAvoidance,blocksRecipe} from '../public/preferences.js';
import {match} from '../meals.js';
import {playGame,publicGame} from '../game.js';
const pref=(extra={})=>({moods:['chrupiące'],dishes:[],methods:['cook','other','order'],energy:2,dislikes:'',exclude:[],...extra});
test('literówki, polskie znaki, składniki i kuchnie',()=>{
 const terms=analyzeAvoidance('humus, pomidoryy, kuchnia srodziemnomorskaa, nie lubie cebuli, zzz-nieznane');
 assert.deepEqual(terms.slice(0,4).map(t=>t.label),['hummus','pomidor','kuchnia śródziemnomorska','cebula']);assert.equal(terms[4].status,'unknown');
 const recipe={name:'Falafel',ingredients:['hummus'],contains:[],groups:[],cuisines:['kuchnia śródziemnomorska']};
 assert.equal(blocksRecipe(recipe,analyzeAvoidance('humus')),true);assert.equal(blocksRecipe(recipe,analyzeAvoidance('kuchnia srodziemnomorska')),true);
 const filtered=match([pref({methods:['order'],dislikes:'humus'}),pref({methods:['order']})]);assert.ok(filtered.every(m=>!m.ingredients.includes('hummus')));
 const cuisine=match([pref({dislikes:'kuchnia srodziemnomorska'}),pref()]);assert.ok(cuisine.length>0);assert.ok(cuisine.every(m=>!m.cuisines.includes('kuchnia śródziemnomorska')));
});
test('naprowadzające chipsy i wyjście na jedzenie',()=>{
 const burgers=match([pref({dishes:['burger']}),pref({dishes:['burger']})]);assert.ok(burgers[0].groups.includes('burger'));
 const out=match([pref({methods:['out']}),pref({methods:['out']})]);assert.equal(out.length,3);assert.ok(out.every(m=>m.kind==='out'&&m.id.startsWith('out-')));
 assert.equal(match([pref({methods:['out']}),pref({methods:['cook']})]).length,0);
});
test('wszystkie kombinacje gry i ukrywanie pierwszego gestu',()=>{
 const expected={rock:{rock:null,paper:'b',scissors:'a'},paper:{rock:'a',paper:null,scissors:'b'},scissors:{rock:'b',paper:'a',scissors:null}};
 for(const aMove of Object.keys(expected))for(const bMove of Object.keys(expected)){
 const a={id:'a'},b={id:'b'};const pair={people:[a,b],game:{id:'g',turn:1,consents:['a','b'],choices:{a:'dish-a',b:'dish-b'},moves:{},result:null}};
 playGame(pair,a,{gameId:'g',turn:1,move:aMove});const hidden=publicGame(pair,b);assert.equal(hidden.myMove,null);assert.equal(hidden.result,null);assert.equal(hidden.moves,undefined);
 assert.throws(()=>playGame(pair,a,{gameId:'g',turn:1,move:bMove}));
 playGame(pair,b,{gameId:'g',turn:1,move:bMove});assert.equal(pair.game.result.winner,expected[aMove][bMove]);
 if(expected[aMove][bMove])assert.equal(pair.decision.mealId,'dish-'+expected[aMove][bMove]);else assert.equal(pair.game.result.tie,true);
 }
});
test('dwie sesje: finalny konflikt, zgoda, tajne gesty, remis, zwycięstwo i poddanie',async()=>{
 const data=await mkdtemp(join(tmpdir(),'cojemy-game-'));let child,round=1;
 async function start(){child=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'3120',HOST:'127.0.0.1',DATA_DIR:data,VERCEL:''},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('Server exited '+code)));});}
 async function stop(){const done=new Promise(resolve=>child.once('exit',resolve));child.kill();await done;}
 async function call(path,body,auth){const payload=body&&auth?{round,...body}:body;const res=await fetch('http://127.0.0.1:3120/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},...(body?{body:JSON.stringify(payload)}:{})});const data=await res.json();if(data.round)round=data.round;return {status:res.status,data};}
 let a,b;
 async function makeConflict(reverse=false){await call('preferences',pref(),a.token);const state=(await call('preferences',pref(),b.token)).data;const [first,second]=state.matches;await call('vote',{id:first.id},a.token);await call('vote',{id:second.id},b.token);const half=(await call('finalize',{id:reverse?second.id:first.id},a.token)).data;assert.equal(half.decision,null);assert.equal(half.conflict,false);const full=(await call('finalize',{id:reverse?first.id:second.id},b.token)).data;assert.equal(full.conflict,true);assert.equal(full.decision,null);return [first.id,second.id];}
 try{
 await start();a=(await call('create',{name:'A'})).data;b=(await call('join',{name:'B',code:a.code})).data;
 let [first,second]=await makeConflict();
 assert.equal((await call('finalize',{id:second},a.token)).status,409);
 const request=(await call('game/request',{},a.token)).data;let g=request.game;
 assert.equal(g.consents.length,1);assert.equal((await call('game/move',{gameId:g.id,turn:1,move:'rock'},a.token)).status,409);
 await call('game/request',{gameId:g.id},b.token);const firstMove=(await call('game/move',{gameId:g.id,turn:1,move:'rock'},a.token)).data;assert.equal(firstMove.game.myMove,'rock');
 const secret=(await call('state',null,b.token)).data;assert.equal(secret.game.myMove,null);assert.equal(secret.game.result,null);assert.equal(secret.game.moves,undefined);
 await stop();await start();assert.equal((await call('state',null,b.token)).data.game.result,null);
 const tied=(await call('game/move',{gameId:g.id,turn:1,move:'rock'},b.token)).data;assert.equal(tied.game.result.tie,true);assert.equal(tied.decision,null);
 const rematch=(await call('game/rematch',{gameId:g.id,turn:1},a.token)).data;assert.equal(rematch.game.turn,2);assert.equal((await call('game/move',{gameId:g.id,turn:1,move:'paper'},b.token)).status,409);
 await call('game/move',{gameId:g.id,turn:2,move:'scissors'},a.token);const won=(await call('game/move',{gameId:g.id,turn:2,move:'paper'},b.token)).data;
 assert.equal(won.decision.mealId,first);assert.equal(won.decision.winner,a.me);assert.equal(won.game.result.tie,false);
 assert.equal((await call('yield',{},b.token)).status,409);
 await stop();await start();assert.equal((await call('state',null,a.token)).data.decision.mealId,first);
 await call('reset',{},a.token);[first,second]=await makeConflict(true);
 const yielded=(await call('yield',{},a.token)).data;assert.equal(yielded.decision.mealId,first);assert.equal(yielded.decision.reason,'yield');assert.equal(yielded.decision.acceptedBy,a.me);assert.equal((await call('yield',{},b.token)).status,409);
 await call('reset',{},a.token);await makeConflict();g=(await call('game/request',{},a.token)).data.game;
 const declined=(await call('game/decline',{gameId:g.id},b.token)).data;assert.equal(declined.game,null);assert.equal(declined.conflict,true);
 const newGame=(await call('game/request',{},a.token)).data.game;assert.notEqual(newGame.id,g.id);assert.equal((await call('game/request',{gameId:g.id},b.token)).status,409);
 await call('game/request',{gameId:newGame.id},b.token);const edited=(await call('preferences',pref({dislikes:'humus, kuchnia srodziemnomorska',methods:['out']}),a.token)).data;
 assert.equal(edited.game,null);assert.equal(edited.conflict,false);assert.equal(edited.people.find(p=>p.id===a.me).preferences.avoidance[0].label,'hummus');
 assert.equal((await call('game/move',{gameId:newGame.id,turn:1,move:'rock'},b.token)).status,409);
 const out=(await call('preferences',pref({methods:['out']}),b.token)).data;assert.ok(out.matches.every(m=>m.kind==='out'&&!m.cuisines.includes('kuchnia śródziemnomorska')));
 }finally{if(child?.exitCode===null)await stop();await rm(data,{recursive:true,force:true});}
});
