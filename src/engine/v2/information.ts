import type { Person } from './types';
type Listener = Pick<Person,'id'|'alive'|'present'|'informed'>;
const membership=new WeakMap<readonly string[],ReadonlySet<string>>();
function knownFacts(facts:readonly string[]){if(!Object.isFrozen(facts))return new Set(facts);let set=membership.get(facts);if(!set){set=new Set(facts);membership.set(facts,set);}return set;}
/** Same lexicographic choice: earliest known fact, then earliest ordered listener.
 * Membership indexes immutable fact arrays only; no recipient or decision is cached.
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
    const known=knownFacts(q.informed);
    for(let i=0;i<best;i++)if(!known.has(facts[i])){best=i;recipient=q.id;break;}
    if(best===0)break;
  }
  return recipient===undefined?undefined:{recipient,offense:facts[best]};
}
