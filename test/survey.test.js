import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bases,tastes} from '../public/preferences.js';
import {match} from '../meals.js';
import {validateRecipe} from '../custom-recipes.js';
const pref=extra=>({moods:[],dishes:[],methods:['cook'],energy:3,dislikes:'',exclude:[],...extra});
test('każda baza ma pasującą propozycję, a bazy ważą więcej niż jeden smak',()=>{
 for(const base of bases){const options=match([pref({dishes:[base]}),pref({dishes:[base]})]);assert.ok(options[0].matchesFor.every(h=>h.dishes.includes(base)),base);}
 const options=match([pref({dishes:['ryż'],moods:['kremowe']}),pref({dishes:['ryż'],moods:['kremowe']})]);assert.ok(options[0].matchesFor.every(h=>h.dishes.includes('ryż')));
});
test('każdy smak ma propozycję, a wykluczenia mają pierwszeństwo przed bazą',()=>{
 for(const taste of tastes){const options=match([pref({moods:[taste]}),pref({moods:[taste]})]);assert.ok(options[0].tags.includes(taste),taste);}
 const options=match([pref({dishes:['coś białkowego'],dislikes:'tofu, nabiał'}),pref()]);assert.ok(options.length);assert.ok(options.every(m=>!m.contains.includes('nabiał')&&!m.ingredients.includes('tofu')));
});
test('białko jest dodatkową bazą również we własnym przepisie',()=>{
 const recipe={...validateRecipe({name:'Ryż z brokułem',url:'https://example.com/rice',ingredients:'ryż, brokuł, tofu',minutes:25,energy:1,tags:['łagodne'],contains:[],groups:['ryż'],cuisines:[],meatless:true}),id:'custom-survey'};
 assert.ok(recipe.groups.includes('coś białkowego'));assert.ok(recipe.groups.includes('warzywa'));
 const options=match([pref({dishes:['ryż','coś białkowego']}),pref({dishes:['ryż','coś białkowego']})],[],[recipe]);assert.ok(options.some(m=>m.id===recipe.id));
});
