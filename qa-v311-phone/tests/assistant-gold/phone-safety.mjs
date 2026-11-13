import {cases,cards,measure} from './replay.mjs';
// Independent existing synthetic oracle; messages/oracles are not rewritten for live responses.
export const phoneSafetyIds=['collection-20bin','collection-staff-held','staff-cash-delivery','staff-advance','staff-injection','customer-tank-in','customer-fuel-out','customer-fuel-total','station-tank-priced','work-subcontractor','work-explicit-price','fuel-stock'];
export const phoneSafetyCases=phoneSafetyIds.map(id=>{const c=cases.find(c=>c.id===id);if(!c||c.photoTexts.length)throw Error('Sınav güvenlik kümesi eksik.');return c;});
export const phoneSafetyFixture=c=>structuredClone({...cards,...c.cardsPatch});
export const measurePhoneSafety=responses=>{if(!responses||Object.keys(responses).length!==phoneSafetyIds.length||phoneSafetyIds.some(id=>!Object.hasOwn(responses,id)))throw Error('Eksik güvenlik yanıtı puanlanamaz.');return measure(phoneSafetyCases,responses);};
