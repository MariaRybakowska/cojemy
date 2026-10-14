import {moods,exclusions,dishes} from './meals.js';
import {cuisineLabels,baseGroups} from './public/preferences.js';
export function validateRecipe(input) {
 const bad=message=>{throw Object.assign(new Error(message),{status:400});};
 const name=typeof input.name==='string'?input.name.trim():'';
 if(!name||name.length>100)bad('Wpisz nazwę przepisu (do 100 znaków).');
 let url;try{url=new URL(input.url);}catch{bad('Wpisz pełny link do przepisu.');}
 if(url.protocol!=='https:'||url.username||url.password||url.href.length>2000)bad('Link musi zaczynać się od https:// i prowadzić do przepisu.');
 if(typeof input.ingredients!=='string'||input.ingredients.length>1000)bad('Wpisz składniki przepisu.');
 const ingredients=input.ingredients.split(/[,;\n]/).map(s=>s.trim()).filter(Boolean);
 if(!ingredients.length||ingredients.length>50)bad('Wpisz składniki, oddzielając je przecinkami (do 50).');
 if(input.meatless!==true)bad('Potwierdź, że przepis jest bez mięsa i ryb.');
 const meat=/\b(kurczak|wolow|wieprz|boczek|szynk|kielbas|losos|tunczyk|dorsz|krewet|chicken|beef|pork|bacon|salmon|tuna|shrimp)/;
 const normalize=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('ł','l');
 if(ingredients.some(s=>meat.test(normalize(s))&&!/roslinn|beyond|wegansk|zamiennik/.test(normalize(s))))bad('W składnikach jest mięso lub ryba. Użyj przepisu bezmięsnego lub nazwij roślinny zamiennik.');
 if(!Array.isArray(input.tags)||input.tags.some(x=>!moods.includes(x))||!Array.isArray(input.contains)||input.contains.some(x=>!exclusions.includes(x)))bad('Sprawdź oznaczenia przepisu.');
 if(![1,2,3].includes(input.energy)||!Number.isInteger(input.minutes)||input.minutes<5||input.minutes>240)bad('Podaj nakład pracy i czas od 5 do 240 minut.');
 const text=normalize(ingredients.join(' '));const contains=new Set(input.contains);
 if(ingredients.some(item=>/mleko|smietan|maslo|mozzarella|feta|parmezan|jogurt|ser\b/.test(normalize(item))&&!/roslinn|wegansk|kokos|owsian|migdalo|bez nabialu/.test(normalize(item))))contains.add('nabiał');
 if(/makaron|bulka|pieczywo|chleb|maka|tortilla|kuskus|gnocchi/.test(text)&&!/bezgluten|bez glutenu/.test(text))contains.add('gluten');
 if(/jajk|jajek/.test(text))contains.add('jajka');if(/orzech|migdal/.test(text))contains.add('orzechy');
 if(input.groups&&(!Array.isArray(input.groups)||input.groups.some(x=>!dishes.includes(x))))bad('Sprawdź rodzaj dania.');
 if(input.cuisines&&(!Array.isArray(input.cuisines)||input.cuisines.some(x=>!cuisineLabels.includes(x))))bad('Sprawdź kuchnię przepisu.');
 const inferred=dishes.filter(d=>text.includes(d.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('ł','l')));
 const groups=baseGroups(ingredients,[...(input.groups||[]),...inferred]);
 const directions=[...(ingredients.length<=6?['mało składników']:[]),...(groups.some(g=>['makaron','ryż','zupa'].includes(g))?['jedna miska']:[]),...(groups.includes('pizza')?['do dzielenia']:[]),...(groups.includes('coś do podjadania')?['do podjadania']:[])];
 const cuisines=[...new Set(input.cuisines||[])];if(cuisines.some(x=>['kuchnia włoska','kuchnia grecka','kuchnia bliskowschodnia'].includes(x)))cuisines.push('kuchnia śródziemnomorska');if(cuisines.some(x=>['kuchnia indyjska','kuchnia japońska'].includes(x)))cuisines.push('kuchnia azjatycka');
 return {directions,groups,cuisines:[...new Set(cuisines)],name,url:url.href,source:url.hostname.replace(/^www\./,'')==='kwestiasmaku.com'?'Kwestia Smaku':url.hostname.replace(/^www\./,'')==='seriouseats.com'?'Serious Eats':url.hostname.replace(/^www\./,''),ingredients,tags:[...new Set(input.tags)],contains:[...contains],minutes:input.minutes,energy:input.energy,kind:'cook',custom:true,estimated:true,description:'Dodany do Waszej kolekcji.',note:'Składniki i oznaczenia podała osoba dodająca przepis. Sprawdźcie pełny przepis u autora.'};
}
