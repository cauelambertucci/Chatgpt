import {it,expect} from 'vitest';
import {firstUnknownRecipient} from './information';
it('preserva escolha fato-primeiro/destinatário-depois com ordens, subconjuntos, ausência e morte',()=>{
 for(let seed=0;seed<200;seed++){
  const facts=Array.from({length:seed%11},(_,i)=>`event:${(i*7+seed)%13}`);
  const listeners=Array.from({length:9},(_,j)=>({id:`person:${j}`,alive:(j+seed)%5!==0,present:(j+seed)%7!==0,informed:Array.from({length:15},(_,i)=>`event:${i}`).filter((_,i)=>(i*7+j*13+seed*17)%11<6).sort((a,b)=>seed%2?a.localeCompare(b):b.localeCompare(a))}));
  let expected;
  for(const offense of facts){const q=listeners.find(q=>q.alive&&q.present&&!q.informed.includes(offense));if(q){expected={recipient:q.id,offense};break;}}
  expect(firstUnknownRecipient(facts,listeners)).toEqual(expected);
 }
});
it('não troca empate pelo destinatário posterior; notícia anterior prevalece sobre destinatário mais cedo',()=>{
 const l=[{id:'a',alive:true,present:true,informed:['old']},{id:'b',alive:true,present:true,informed:[]},{id:'c',alive:true,present:true,informed:[]}];
 expect(firstUnknownRecipient(['old','new'],l)).toEqual({recipient:'b',offense:'old'});
 expect(firstUnknownRecipient(['new','old'],l)).toEqual({recipient:'a',offense:'new'});
});
