import {foldTr} from '../../../js/parser.js';
const normalized=x=>foldTr(String(x??'')).replace(/(\p{L})(\d)/gu,'$1 $2').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const negative=x=>/\b(?:degil|yapilmadi|yuklenmedi|yukleme yok)\b/u.test(x);
const action=x=>x.replace(/\byuklendi\b/gu,'yukleme');
// A nominal action is equivalent only when its source quote supports the same
// material/action/recipient phrase. This affects scoring, never application data.
export function descriptionMatches(got,want,quote=''){
 const actual=normalized(got),expected=normalized(want),source=normalized(quote);
 if(!actual||!expected||negative(actual)||negative(source))return false;
 if(actual.includes(expected))return true;
 return !!source&&action(actual).includes(action(expected))&&action(source).includes(action(expected));
}
