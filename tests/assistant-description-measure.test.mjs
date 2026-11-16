import assert from 'node:assert/strict';
import {descriptionMatches as matches} from './assistant-gold/real-messages/description-match.mjs';
const expected='cüruf yüklendi nakliyeciye',quote='Natura peyzajdan curuf yuklendi nakliyeciye1saat';
assert.equal(matches('Natura peyzajdan cüruf yükleme nakliyeciye 1 saat',expected,quote),true);
assert.equal(matches(expected,expected),true);
for(const [description,evidence] of [
 ['kum yükleme nakliyeciye',quote],
 ['cüruf yükleme müşteriye',quote],
 ['cüruf boşaltma nakliyeciye',quote],
 ['cüruf yükleme nakliyeciye','kum yüklendi nakliyeciye'],
 ['cüruf yükleme nakliyeciye','cüruf yüklenmedi nakliyeciye'],
 ['cüruf yüklendi nakliyeciye değil',quote],
 ['cüruf yükleme nakliyeciye',''],
])assert.equal(matches(description,expected,evidence),false,description+' / '+evidence);
console.log('description measurement: source-backed loading equivalence; material, recipient, direction and negation negatives PASS');
