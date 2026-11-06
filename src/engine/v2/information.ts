import type { Person } from './types';
type Listener = Pick<Person,'id'|'alive'|'present'|'informed'>;
/** Same lexicographic choice: earliest known fact, then earliest ordered listener.
 * Work on one listener at a time; no retained index or cached decision.
 */
export function firstUnknownRecipient(facts: readonly string[], listeners: readonly Listener[]) {
  let best=facts.length, recipient:string|undefined;
  for(const q of listeners){
    if(!q.alive||!q.present||best===0)continue;
    if(q.informed.length>=facts.length){
      let prefix=true;
      for(let i=0;i<facts.length;i++)if(q.informed[i]!==facts[i]){prefix=false;break;}
      if(prefix)continue;
    }
    const known=new Set(q.informed);
    for(let i=0;i<best;i++)if(!known.has(facts[i])){best=i;recipient=q.id;break;}
    if(best===0)break;
  }
  return recipient===undefined?undefined:{recipient,offense:facts[best]};
}
