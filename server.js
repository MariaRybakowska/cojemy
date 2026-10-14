import http from 'node:http';
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {match,moods,exclusions,dishes,directions} from './meals.js';
import {analyzeAvoidance} from './public/preferences.js';
import {validateRecipe} from './custom-recipes.js';
import {conflict,publicGame,playGame} from './game.js';
const root=dirname(fileURLToPath(import.meta.url));
const data=process.env.DATA_DIR||join(root,'data');mkdirSync(data,{recursive:true});
let pairs={};try{pairs=JSON.parse(readFileSync(join(data,'pairs.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const save=()=>{writeFileSync(join(data,'pairs.tmp'),JSON.stringify(pairs));renameSync(join(data,'pairs.tmp'),join(data,'pairs.json'));};
const token=()=>randomBytes(24).toString('hex');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
function clearVotes(pair){pair.finalists=[];pair.decision=null;pair.game=null;pair.people.forEach(p=>{p.vote=null;p.finalVote=null;});}
function ready(pair){return pair.people.length===2&&pair.people.every(p=>p.preferences);}
function options(pair){return match(pair.people.map(p=>p.preferences),pair.skipped,pair.recipes||[],pair.browse||'all');}
function decision(pair){if(pair.decision)return pair.decision;if(pair.people.length!==2)return null;const [a,b]=pair.people;if(pair.finalists.length){return a.finalVote&&a.finalVote===b.finalVote?{mealId:a.finalVote,reason:'agreement'}:null;}return a.vote&&a.vote===b.vote?{mealId:a.vote,reason:'agreement'}:null;}
function view(pair,me){return {code:pair.code,me:me.id,people:pair.people.map(({token,...p})=>p),matches:ready(pair)?options(pair):[],ready:ready(pair),skipped:pair.skipped.length,round:pair.round,finalists:pair.finalists,browse:pair.browse,recipes:pair.recipes,decision:decision(pair),conflict:conflict(pair),game:publicGame(pair,me)};}
for(const pair of Object.values(pairs)){
 pair.finalists||=[];pair.recipes||=[];pair.browse||='all';pair.game||=null;pair.decision||=null;
 for(const person of pair.people){person.finalVote||=null;if(person.preferences){const pref=person.preferences;pref.exclude||=[];pref.methods||=['cook','other','order'];pref.dishes||=[];pref.directions||=[];pref.dislikes||='';pref.dislikes=[...new Set([...pref.dislikes.split(/[,;\n]/).map(s=>s.trim()).filter(Boolean),...pref.exclude.filter(x=>x!=='mięso')])].join(', ');pref.exclude=[];pref.avoidance=analyzeAvoidance(pref.dislikes);person.dislikes=pref.dislikes;}}
 if(ready(pair)){const ids=options(pair).map(m=>m.id);if(pair.people.some(p=>p.vote&&!ids.includes(p.vote)))clearVotes(pair);}
}
function checkRound(pair,b){if(b.round!==pair.round)fail('Rozpoczął się nowy posiłek. Sprawdź aktualny widok.',409);}
function openDecision(pair){if(decision(pair))fail('Decyzja jest już zapisana. Zacznij kolejny posiłek.',409);}
function validatePreferences(b){
 const list=(value,allowed)=>Array.isArray(value)&&value.length<=allowed.length&&value.every(x=>allowed.includes(x));
 if(!list(b.moods,moods)||!list(b.dishes||[],dishes)||!list(b.directions||[],directions)||!list(b.exclude||[],exclusions)||!list(b.methods,['cook','other','order','out'])||!b.methods.length||![1,2,3].includes(b.energy)||typeof b.dislikes!=='string'||b.dislikes.length>500)fail('Sprawdź swoje preferencje.');
 const dislikes=[...new Set([...b.dislikes.split(/[,;\n]/).map(s=>s.trim()).filter(Boolean),...(b.exclude||[])])].join(', ');
 return {directions:[...new Set(b.directions||[])],moods:[...new Set(b.moods)],dishes:[...new Set(b.dishes||[])],exclude:[],methods:[...new Set(b.methods)],dislikes,avoidance:analyzeAvoidance(dislikes),energy:b.energy};
}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)fail('Za dużo danych.',413);}try{return JSON.parse(raw||'{}');}catch{fail('Nieprawidłowe dane.');}}
const server=http.createServer(async(req,res)=>{
 const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 try{
 const url=new URL(req.url,'http://localhost');
 if(!url.pathname.startsWith('/api/')){
 const files={'/':['public/index.html','text/html'],'/app.js':['public/app.js','text/javascript'],'/preferences.js':['public/preferences.js','text/javascript'],'/style.css':['public/style.css','text/css']};
 const file=files[url.pathname];if(!file){res.writeHead(404);res.end('Nie znaleziono');return;}
 res.writeHead(200,{'Content-Type':file[1]+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(readFileSync(join(root,file[0])));return;
 }
 const b=req.method==='POST'?await body(req):{};
 if(req.method==='POST'&&['/api/create','/api/join'].includes(url.pathname)){
 const name=typeof b.name==='string'?b.name.trim().slice(0,30):'';if(!name)fail('Wpisz swoje imię.');let pair;
 if(url.pathname==='/api/create'){let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(pairs[code]);pair=pairs[code]={code,people:[],skipped:[],round:1,recipes:[],browse:'all',finalists:[],game:null,decision:null};}
 else{pair=pairs[String(b.code).trim().toUpperCase()];if(!pair)fail('Nie znaleziono pary z tym kodem.',404);if(pair.people.length>=2)fail('Ta para ma już dwie osoby.',409);}
 const person={id:token().slice(0,12),token:token(),name,preferences:null,vote:null,finalVote:null,dislikes:''};pair.people.push(person);save();send(200,{token:person.token,...view(pair,person)});return;
 }
 const auth=req.headers.authorization?.replace(/^Bearer /,'');let pair,me;
 for(const p of Object.values(pairs)){const found=p.people.find(x=>x.token===auth);if(found){pair=p;me=found;break;}}
 if(!me)fail('Dołącz do pary, aby kontynuować.',401);
 if(req.method==='GET'&&url.pathname==='/api/state'){send(200,view(pair,me));return;}
 if(req.method!=='POST')fail('Nie znaleziono.',404);
 checkRound(pair,b);
 if(url.pathname==='/api/preferences'){
 openDecision(pair);me.preferences=validatePreferences(b);me.dislikes=me.preferences.dislikes;pair.browse='all';pair.skipped=[];clearVotes(pair);
 }else if(['/api/more','/api/browse','/api/recipe'].includes(url.pathname)){
 openDecision(pair);
 if(url.pathname==='/api/recipe'){
 const recipe=validateRecipe(b);if(pair.recipes.length>=50)fail('Kolekcja ma już 50 przepisów.');
 if(pair.recipes.some(r=>r.url===recipe.url))fail('Ten link jest już w Waszej kolekcji.',409);
 pair.recipes.unshift({...recipe,id:'custom-'+token().slice(0,16),addedBy:me.id});pair.browse='cook';
 }else{
 if(!['all','cook','order','out'].includes(b.kind))fail('Wybierz sposób jedzenia.');
 if(!ready(pair))fail('Najpierw zapiszcie preferencje.');
 if(url.pathname==='/api/more')pair.skipped=[...new Set([...pair.skipped,...options(pair).map(m=>m.id)])];
 pair.browse=b.kind;
 }clearVotes(pair);
 }else if(['/api/vote','/api/skip','/api/finalize'].includes(url.pathname)){
 openDecision(pair);if(!ready(pair))fail('Czekamy na preferencje obu osób.');
 if(!options(pair).some(m=>m.id===b.id))fail('Propozycje się zmieniły. Sprawdź aktualny widok.',409);
 if(url.pathname==='/api/finalize'){
 if(!pair.finalists.includes(b.id))fail('Wybierz jedno z Waszych dwóch dań.',409);
 if(pair.game)fail('Trwa rozstrzyganie grą. Najpierw zakończcie lub anulujcie grę.',409);
 if(conflict(pair))fail('Wybory są różne. Możesz zaakceptować wybór drugiej osoby lub zagrać.',409);
 me.finalVote=b.id;
 }else if(url.pathname==='/api/vote'){
 if(pair.finalists.length)fail('Przejdź do finalnej decyzji.',409);me.vote=b.id;
 if(pair.people.every(p=>p.vote)&&pair.people[0].vote!==pair.people[1].vote){pair.finalists=pair.people.map(p=>p.vote);pair.people.forEach(p=>p.finalVote=null);}
 }else{pair.skipped.push(b.id);clearVotes(pair);}
 }else if(url.pathname==='/api/yield'){
 openDecision(pair);if(!conflict(pair))fail('Nie ma dwóch różnych finalnych wyborów.',409);
 const partner=pair.people.find(p=>p.id!==me.id);pair.decision={mealId:partner.finalVote,reason:'yield',acceptedBy:me.id};pair.game=null;
 }else if(url.pathname==='/api/game/request'){
 openDecision(pair);if(!conflict(pair))fail('Gramy dopiero przy dwóch różnych finalnych wyborach.',409);
 if(!pair.game){pair.game={id:token().slice(0,16),turn:1,consents:[],moves:{},result:null,choices:Object.fromEntries(pair.people.map(p=>[p.id,p.finalVote]))};}
 else if(b.gameId!==pair.game.id)fail('Zaproszenie do gry już się zmieniło.',409);
 if(!pair.game.consents.includes(me.id))pair.game.consents.push(me.id);
 }else if(url.pathname==='/api/game/decline'){
 openDecision(pair);if(!pair.game||b.gameId!==pair.game.id)fail('Ta gra już się zakończyła.',409);pair.game=null;
 }else if(url.pathname==='/api/game/move'){
 openDecision(pair);playGame(pair,me,b);
 }else if(url.pathname==='/api/game/rematch'){
 openDecision(pair);const g=pair.game;if(!g||b.gameId!==g.id||b.turn!==g.turn||!g.result?.tie)fail('Nie ma remisu do rozegrania ponownie.',409);g.turn++;g.moves={};g.result=null;
 }else if(url.pathname==='/api/reset'){
 pair.round++;pair.skipped=[];pair.browse='all';clearVotes(pair);pair.people.forEach(p=>p.preferences=null);
 }else fail('Nie znaleziono.',404);
 save();send(200,view(pair,me));
 }catch(e){send(e.status||500,{error:e.status?e.message:'Nie udało się zapisać. Spróbuj ponownie.'});}
});
server.listen(Number(process.env.PORT||3000),process.env.HOST||'0.0.0.0',()=>console.log(`cojemy: http://localhost:${process.env.PORT||3000}`));
