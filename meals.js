import {recipes} from './recipes.js';
import {moodLabels,dishes,directions,baseGroups,analyzeAvoidance,blocksRecipe} from './public/preferences.js';
export {dishes,directions};
export const moods = moodLabels;
export const exclusions = ['ryby','nabiał','gluten','jajka','orzechy'];
const metadata={
 'cojemy-soup':{groups:['zupa'],cuisines:[],extra:[]},
 'cojemy-couscous':{groups:['kasza / kuskus'],cuisines:['kuchnia śródziemnomorska'],extra:[]},
 'ks-gnocchi':{groups:['ziemniaki','makaron'],directions:['coś znajomego','do dzielenia'],cuisines:['kuchnia włoska','kuchnia śródziemnomorska'],extra:['kremowe','sycące','ziołowe','łagodne']},
 'ks-chili':{groups:['ryż'],directions:['coś innego','jedna miska','do dzielenia'],cuisines:['kuchnia meksykańska'],extra:['sycące','aromatyczne','czosnkowe']},
 'ks-pasta':{groups:['makaron'],directions:['coś znajomego','jedna miska'],cuisines:['kuchnia włoska','kuchnia śródziemnomorska'],extra:['kremowe','sycące','kwaśne','słone','ziołowe','czosnkowe']},
 'ks-bataty':{groups:['ziemniaki'],directions:['coś innego','do dzielenia'],cuisines:[],extra:['sycące','słodkawe','słone','kwaśne']},
 'ks-dakos':{groups:['coś do podjadania'],directions:['coś innego','do podjadania','do dzielenia'],cuisines:['kuchnia grecka','kuchnia śródziemnomorska'],extra:['słone','ziołowe','łagodne']},
 'se-pasta':{groups:['makaron'],directions:['coś znajomego','jedna miska','mało składników'],cuisines:['kuchnia włoska','kuchnia śródziemnomorska'],extra:['ziołowe','czosnkowe']},
 'se-mushrooms':{groups:['ryż'],directions:['coś innego','jedna miska'],cuisines:['kuchnia indyjska','kuchnia azjatycka'],extra:['aromatyczne','czosnkowe']},
 'se-potatoes':{groups:['ziemniaki'],directions:['coś znajomego','do dzielenia','do podjadania'],cuisines:[],extra:['sycące','ziołowe','czosnkowe']},
 'cojemy-beyond':{groups:['burger'],directions:['coś znajomego','mało składników'],cuisines:[],extra:['sycące','słone']}
};
export const meals=recipes.map(r=>({...r,...metadata[r.id],groups:baseGroups(r.ingredients,metadata[r.id].groups),tags:[...new Set([...r.tags,...metadata[r.id].extra,...(r.id==='se-mushrooms'?['umami']:[]),...(r.id==='cojemy-beyond'?['dymne']:[])])]}));
export const orderMeals = [
 {id:'order-pizza',name:'Pizza wegetariańska',description:'Bez mięsa, z mozzarellą i warzywami.',tags:['ciepłe','comfort food','sycące','łagodne'],contains:['gluten','nabiał'],ingredients:['ciasto pszenne','pomidor','mozzarella','papryka'],kind:'order'},
 {id:'order-burger',name:'Burger roślinny',description:'Beyond lub inny kotlet roślinny, bez mięsa.',tags:['ciepłe','chrupiące','comfort food','sycące','słone'],contains:['gluten'],ingredients:['burger roślinny','bułka','sałata','ogórek'],kind:'order'},
 {id:'order-bowl',name:'Bowl z tofu',description:'Ryż, tofu, ogórek i marchew. Sos bez glutenu.',tags:['świeże','lekkie','chrupiące'],contains:[],ingredients:['ryż','tofu','ogórek','marchew','tamari bez glutenu'],kind:'order'},
 {id:'order-curry',name:'Curry z ciecierzycą',description:'Warzywne curry z mlekiem kokosowym i ryżem.',tags:['ciepłe','pikantne','comfort food','kremowe','aromatyczne'],contains:[],ingredients:['ciecierzyca','mleko kokosowe','pomidor','ryż'],kind:'order'},
 {id:'order-falafel',name:'Falafel z hummusem',description:'Falafel, hummus i warzywa, bez mięsa.',tags:['chrupiące','sycące','świeże','kremowe','czosnkowe'],contains:[],ingredients:['ciecierzyca','hummus','tahini','ogórek','pomidor'],kind:'order'},
 {id:'order-sushi',name:'Sushi z warzywami',description:'Ogórek, awokado i ryż, bez ryb.',tags:['świeże','lekkie','łagodne'],contains:[],ingredients:['ryż','ogórek','awokado','nori'],kind:'order'}
].map(m=>({...m,directions:m.id.includes('pizza')?['coś znajomego','do dzielenia']:m.id.includes('burger')?['coś znajomego','mało składników']:m.id.includes('falafel')||m.id.includes('sushi')?['coś innego','do dzielenia','do podjadania']:['coś innego','jedna miska','mało składników'],groups:m.id.includes('pizza')?['pizza']:m.id.includes('burger')?['burger']:m.id.includes('falafel')?['coś do podjadania']:['ryż'],cuisines:m.id.includes('pizza')?['kuchnia włoska','kuchnia śródziemnomorska']:m.id.includes('falafel')?['kuchnia bliskowschodnia','kuchnia śródziemnomorska']:m.id.includes('sushi')?['kuchnia japońska','kuchnia azjatycka']:m.id.includes('curry')?['kuchnia indyjska','kuchnia azjatycka']:[]}));
export function dislikeTerms(text=''){return analyzeAvoidance(text).map(t=>t.key);}
export function match(preferences, skipped=[], custom=[], kind='all') {
 const terms=preferences.flatMap(p=>analyzeAvoidance(p.dislikes||''));
 const banned=new Set([...preferences.flatMap(p=>p.exclude||[]),...terms.filter(t=>t.type==='category').map(t=>t.label)]);
 const acceptsCook=preferences.every(p=>(p.methods||['cook']).some(x=>x==='cook'||x==='other'));
 const willing=preferences.filter(p=>(p.methods||['cook']).includes('cook'));
 const energy=willing.length?Math.max(...willing.map(p=>p.energy||1)):0;
 const canOrder=preferences.every(p=>(p.methods||['cook']).includes('order'));
 const canOut=preferences.every(p=>(p.methods||['cook']).includes('out'));
 const pool=[...(acceptsCook&&willing.length?[...custom,...meals]:[]),...(canOrder?orderMeals:[]),...(canOut?orderMeals.map(m=>({...m,id:m.id.replace('order-','out-'),kind:'out'})):[])];
 return pool.filter(m=>(kind==='all'||m.kind===kind)&&(m.kind!=='cook'||m.energy<=energy)&&!m.contains.some(x=>banned.has(x))&&!skipped.includes(m.id)&&!blocksRecipe(m,terms))
 .map(m=>{const hits=preferences.map(p=>({tastes:(p.moods||[]).filter(t=>m.tags.includes(t)),dishes:(p.dishes||[]).filter(t=>baseGroups(m.ingredients,m.groups||[]).includes(t))}));const scores=hits.map(h=>h.tastes.length+h.dishes.length*3);return {...m,matchesFor:hits,score:Math.min(...scores)*3+scores.reduce((a,b)=>a+b,0)+(m.custom?20:0)};})
 .sort((a,b)=>b.score-a.score || (a.kind===b.kind?0:a.kind==='cook'?-1:b.kind==='cook'?1:a.kind.localeCompare(b.kind)) || (a.minutes||0)-(b.minutes||0)).slice(0,3);
}
