// Ten sam słownik działa w formularzu i przy dopasowaniu na serwerze.
export const directions = ['coś znajomego','coś innego','mało składników','jedna miska','do dzielenia','do podjadania'];
export const bases = ['makaron','ryż','ziemniaki','kasza / kuskus','pieczywo / wrap','zupa','warzywa','coś białkowego'];
export const dishes = [...bases,'burger','pizza','coś do podjadania'];
export const tastes = ['kremowe','chrupiące','świeże','pikantne','łagodne','sycące','lekkie','kwaśne','słone','słodkawe','ziołowe','czosnkowe','aromatyczne','dymne','umami'];
export const moodLabels = [...tastes,'ciepłe','comfort food'];
export const methods = [['cook','Ugotuję'],['other','Zjem, jeśli druga osoba ugotuje'],['order','Zamawiamy'],['out','Wychodzimy zjeść']];
export const normalize=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('ł','l').trim();
const entries=[
 ['hummus','ingredient',['humus','hummusu','humusu']],['pomidor','ingredient',['pomidory','pomidora','pomidorów','passata','przecier pomidorowy']],
 ['ogórek','ingredient',['ogórki','ogórka','ogórków']],['cebula','ingredient',['cebuli','cebulę']],['czosnek','ingredient',['czosnku']],
 ['grzyby','ingredient',['grzybów','grzyba','pieczarki','pieczarek','pieczarka','kurki']],['tofu','ingredient',[]],['ciecierzyca','ingredient',['ciecierzycy']],
 ['fasola','ingredient',['fasoli','fasolka']],['cukinia','ingredient',['cukinii','cukinię']],['papryka','ingredient',['papryki']],['chili','ingredient',['chilli']],
 ['ziemniaki','dish',['ziemniaków','ziemniaka']],['bataty','ingredient',['batat','batatów']],['awokado','ingredient',[]],['oliwki','ingredient',['oliwek']],
 ['kapary','ingredient',['kaparów']],['ryż','dish',['ryżu']],['makaron','dish',['makarony','makaronu']],['burger','dish',['burgery','burgerów']],
 ['pizza','dish',['pizzy','pizzę']],['zupa','dish',['zupy','zupę']],['gnocchi','ingredient',['kopytka']],['pieczywo','ingredient',['bułka','bułki','chleb','tortilla']],
 ['feta','ingredient',['fety']],['mozzarella','ingredient',['mozarella','mozzarelli']],['jogurt','ingredient',['jogurtu']],['cytryna','ingredient',['cytryny','limonka']],
 ['kolendra','ingredient',['kolendry']],['koperek','ingredient',['koperku']],['bazylia','ingredient',['bazylii']],['rozmaryn','ingredient',[]],
 ['nabiał','category',['nabialu','mleko','produkty mleczne']],['gluten','category',['glutenu']],['jajka','category',['jajek','jajko']],['orzechy','category',['orzechów','migdały']],
 ['ryby','category',['ryb','ryba']],['mięso','category',['mięsa']],
 ['kuchnia śródziemnomorska','cuisine',['śródziemnomorska','śródziemnomorskie','mediterranean']],
 ['kuchnia włoska','cuisine',['włoska','włoskie','italian']],['kuchnia grecka','cuisine',['grecka','greckie','greek']],
 ['kuchnia meksykańska','cuisine',['meksykańska','meksykańskie','mexican']],['kuchnia indyjska','cuisine',['indyjska','indyjskie','indian']],
 ['kuchnia azjatycka','cuisine',['azjatycka','azjatyckie','asian']],['kuchnia japońska','cuisine',['japońska','japońskie','japanese']],
 ['kuchnia bliskowschodnia','cuisine',['bliskowschodnia','bliskowschodnie']],['kuchnia polska','cuisine',['polska','polskie']]
].map(([label,type,aliases])=>({label,type,key:normalize(label),aliases:[label,...aliases].map(normalize)}));
const index=new Map(entries.flatMap(e=>e.aliases.map(a=>[a,e])));
function distance(a,b){const grid=Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i===0?j:j===0?i:0));for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){grid[i][j]=Math.min(grid[i-1][j]+1,grid[i][j-1]+1,grid[i-1][j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])grid[i][j]=Math.min(grid[i][j],grid[i-2][j-2]+1);}return grid[a.length][b.length];}
export function analyzeAvoidance(text='') {
 return String(text).split(/[,;\n]/).map(t=>t.trim()).filter(Boolean).map(raw=>{
 const word=normalize(raw).replace(/^(nie lubie|nie chce|nie mam ochoty na|bez)\s+/,'');
 const exact=index.get(word);if(exact)return {raw,label:exact.label,key:exact.key,type:exact.type,status:word===exact.key?'recognized':'corrected'};
 if(word.length>=4){const candidates=entries.map(e=>({e,d:Math.min(...e.aliases.map(alias=>Math.abs(word.length-alias.length)<=2?distance(word,alias):Infinity))})).sort((a,b)=>a.d-b.d);const best=candidates[0];const unique=best&&candidates.filter(c=>c.d===best.d).length===1;if(unique&&best.d===1)return {raw,label:best.e.label,key:best.e.key,type:best.e.type,status:'corrected'};if(unique&&word.length>=7&&best.d===2)return {raw,label:raw,key:word,type:'unknown',status:'suggestion',suggestion:best.e.label};}
 return {raw,label:raw,key:word,type:'unknown',status:'unknown'};
 });
}
export function ingredientKeys(text) {const raw=normalize(text);const terms=analyzeAvoidance(raw);return new Set([raw,...terms.filter(t=>t.type!=='unknown').map(t=>t.key)]);}
export function blocksRecipe(meal,terms) {
 const fields=[meal.name,...meal.ingredients,...(meal.groups||[]),...(meal.cuisines||[]),...meal.contains];
 const keys=new Set(fields.flatMap(field=>[...ingredientKeys(field)]));
 for(const term of terms){if(term.status==='suggestion'||term.type==='unknown'){if(term.key&&fields.some(x=>normalize(x).includes(term.key)))return true;continue;}
 if(keys.has(term.key))return true;
 if(term.type!=='cuisine'&&term.type!=='category'&&fields.some(x=>normalize(x).includes(term.key)))return true;
 }
 return false;
}
export const cuisineLabels=entries.filter(e=>e.type==='cuisine').map(e=>e.label);

// Baza opisuje skład, a nie gotowe danie. Można dopasować kilka baz naraz.
export function baseGroups(ingredients, groups=[]) {
 const text=normalize(ingredients.join(' '));
 const inferred=[];
 if(/makaron|gnocchi/.test(text))inferred.push('makaron');
 if(/ryz/.test(text))inferred.push('ryż');
 if(/ziemniak|batat/.test(text))inferred.push('ziemniaki');
 if(/kasz|kuskus/.test(text))inferred.push('kasza / kuskus');
 if(/pieczywo|bulka|chleb|tortilla|wrap/.test(text))inferred.push('pieczywo / wrap');
 if(/pomidor|ogorek|cukini|papryk|brokul|salata|rukola|marchew|pieczark|grzyb/.test(text))inferred.push('warzywa');
 if(/tofu|ciecierzyc|fasol|soczewic|jajk|jajek|burger roslinny|beyond/.test(text))inferred.push('coś białkowego');
 return [...new Set([...groups,...inferred])];
}
