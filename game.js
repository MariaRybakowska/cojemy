export const gestures=['rock','paper','scissors'];
export const beats={rock:'scissors',paper:'rock',scissors:'paper'};
export function conflict(pair){return pair.finalists?.length===2&&pair.people.every(p=>p.finalVote)&&pair.people[0].finalVote!==pair.people[1].finalVote;}
export function publicGame(pair,me){const g=pair.game;if(!g)return null;return {id:g.id,turn:g.turn,consents:g.consents,choices:g.choices,myMove:g.moves[me.id]||null,moved:pair.people.filter(p=>g.moves[p.id]).map(p=>p.id),result:g.result};}
export function playGame(pair,me,input){const bad=message=>{throw Object.assign(new Error(message),{status:409});};const g=pair.game;
 if(!g||input.gameId!==g.id||input.turn!==g.turn)bad('Gra lub runda już się zmieniła. Sprawdź aktualny widok.');
 if(g.consents.length!==2)bad('Druga osoba musi zgodzić się na grę.');
 if(!gestures.includes(input.move))bad('Wybierz kamień, papier albo nożyce.');
 if(g.result||g.moves[me.id])bad('Gest jest już zapisany. Czekamy na wynik.');
 g.moves[me.id]=input.move;
 if(pair.people.every(p=>g.moves[p.id])){
 const [a,b]=pair.people;const am=g.moves[a.id],bm=g.moves[b.id];
 if(am===bm)g.result={tie:true,moves:{...g.moves},winner:null};
 else{const winner=beats[am]===bm?a:b;g.result={tie:false,moves:{...g.moves},winner:winner.id};pair.decision={mealId:g.choices[winner.id],reason:'game',winner:winner.id};}
 }
}
