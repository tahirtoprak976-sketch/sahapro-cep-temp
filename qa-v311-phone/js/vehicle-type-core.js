// Vehicle taxonomy shared by cards, documents, prices and operating estimates.
// Pure: never edits cards or infers a class from a plate/job/model response.
export const VEHICLE_TYPES = Object.freeze(['Araç/Makine','Kamyonet','Kamyon','Tır','Çekici','Yarı Römork','Römork','Binek','Minibüs','Otobüs','Motosiklet','İş Makinesi','Ekskavatör','JCB','Kazıcı Yükleyici','Vinç','Silindir','Forklift','Dozer','Greyder','Yükleyici','Telehandler','Traktör']);
export const vehicleTypeKey = s => String(s ?? '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,' ').trim();
const aliases = new Map();
const add = (kind, values) => {for (const v of [kind,...values]) aliases.set(vehicleTypeKey(v),kind);};
add('Araç/Makine',['','Diğer','Other','Bilinmiyor','Araç','Vehicle','Makine']);
add('Kamyonet',['VAN','Pikap','Pick-up','Pickup','Panelvan','Panel van','Kamyonet/Pick-up','Kamyonet/Pikap','Kamyonet/Panelvan','Hafif ticari kamyonet']);
add('Kamyon',['TRUCK','Damperli Kamyon','Hafriyat Kamyonu','Kamyon Damperli']);
add('Tır',['TIR','Tır/Çekici','Tır Çekici','Damperli Tır']);add('Çekici',['Tractor unit']);
add('Yarı Römork',['Semi trailer','Semi-trailer','Dorse']);add('Römork',['Trailer']);
add('Binek',['Otomobil','Binek otomobil','Passenger car','SUV','Sedan','Hatchback','Arazi taşıtı']);
add('Minibüs',['Minibus']);add('Otobüs',['Bus']);add('Motosiklet',['Motorcycle']);
add('İş Makinesi',['İş Makinaları','Construction machine']);add('Ekskavatör',['Excavator','Ekskavator']);
add('JCB',[]);add('Kazıcı Yükleyici',['Beko loder','Backhoe loader']);add('Vinç',['Crane','Mobil vinç']);add('Silindir',['Roller']);
add('Forklift',[]);add('Dozer',['Bulldozer']);add('Greyder',['Grader']);add('Yükleyici',['Loader','Loder']);add('Telehandler',[]);add('Traktör',[]);
export function canonicalVehicleType(value) {
 const key=vehicleTypeKey(value);
 // A trailing registration class qualifies a written kind; N1 alone says nothing.
 return aliases.get(key) || aliases.get(key.replace(/\s+(?:n[123]g?|m[123]g?)$/,'')) || null;
}
const groups={Kamyonet:'VAN',Kamyon:'TRUCK','Tır':'TIR','Çekici':'TIR'};
const machines=new Set(['İş Makinesi','Ekskavatör','JCB','Kazıcı Yükleyici','Vinç','Silindir','Forklift','Dozer','Greyder','Yükleyici','Telehandler']);
const roads=new Set(['Kamyonet','Kamyon','Tır','Çekici','Yarı Römork','Römork','Binek','Minibüs','Otobüs','Motosiklet','Traktör']);
export const vehicleTypeGroup = kind => Object.hasOwn(groups,kind)?groups[kind]:null;
export const genericVehicleType = type => canonicalVehicleType(type)==='Araç/Makine';
function namedTransport(name){
 const key=vehicleTypeKey(name),found=new Set();
 for(const word of key.split(' ')){const kind=canonicalVehicleType(word);if(vehicleTypeGroup(kind))found.add(kind==='Çekici'?'Tır':kind);}
 if(/\bpick up\b|\bpanel van\b/.test(key))found.add('Kamyonet');
 return [...found];
}
const machineName = name => /\b(jcb|kepce|beko|ekskavator|kazici|loder|loader|dozer|greyder|silindir|manitou|vinc|kato|forklift|telehandler)\b/.test(vehicleTypeKey(name));
export const existingVehicle = v => !!v && !v.deleted_at;
export function vehicleTypeInfo(vehicle={}){
 vehicle=vehicle||{};
 const type=vehicle.type, name=String(vehicle.name||''),canonical=canonicalVehicleType(type),named=namedTransport(name),review=vehicle.type_review;
 const confirmed=!!canonical&&canonical!=='Araç/Makine'&&review?.version===1&&review.type===type&&review.name===name;
 const conflict=!confirmed&&(named.length>1||!!canonical&&canonical!=='Araç/Makine'&&named.length===1&&vehicleTypeGroup(canonical)!==vehicleTypeGroup(named[0]));
 let kind=canonical&&canonical!=='Araç/Makine'?canonical:null,source=confirmed?'confirmed':kind?'type':'unknown';
 if(conflict){kind=null;source='conflict';}
 else if(!kind&&genericVehicleType(type)&&named.length===1){kind=named[0];source='name';}
 else if(!kind&&genericVehicleType(type)&&!named.length&&machineName(name)){kind='İş Makinesi';source='name';}
 const group=vehicleTypeGroup(kind),family=machines.has(kind)?'machine':roads.has(kind)?'road':null;
 const note=conflict?`Araç kartında ad ve tür çelişiyor: ${name} / ${type||'belirtilmemiş'}`:source==='confirmed'?`${kind} — türü doğrulandı`:source==='name'?`${kind} — araç adından; kart türü: ${type||'belirtilmemiş'}`:kind?`Araç türü: ${kind}`:`Araç türü doğrulanamadı; kart türü: ${type||'belirtilmemiş'}`;
 return {kind,group,family,source,conflict,note,needsReview:source!=='type'&&source!=='confirmed',canonical};
}
export function transportVehicleInfo(type,name='',review=null){const i=vehicleTypeInfo({type,name,type_review:review});return {...i,type:i.group};}
export const transportVehicleType = (type,name='',review=null) => transportVehicleInfo(type,name,review).type;
export const isMachineKind = vehicle => vehicleTypeInfo(vehicle||{}).family==='machine';
export function vehicleTypeMatches(expected,context){
 const info=vehicleTypeInfo({type:context.vehicle_type,name:context.vehicle_name,type_review:context.vehicle_type_review});
 if(info.conflict||context.vehicle_missing)return false;
 const want=canonicalVehicleType(expected);
 if(want&&want!=='Araç/Makine')return vehicleTypeGroup(want)?vehicleTypeGroup(want)===info.group:want===info.kind;
 if(want==='Araç/Makine')return genericVehicleType(context.vehicle_type);
 const literal=x=>String(x??'').normalize('NFC').trim().toLocaleLowerCase('tr-TR');
 return literal(expected)===literal(context.vehicle_type);
}
export function vehicleTypeInText(value,text){
 const want=canonicalVehicleType(value);if(!want||want==='Araç/Makine')return false;
 const t=' '+vehicleTypeKey(text)+' ';
 return [...aliases].some(([alias,kind])=>kind===want&&alias&&t.includes(' '+alias+' '));
}
// Presence is evidence for a document; a mutation also respects an explicit
// negative clause such as "Kamyon değil" or "Kamyonet yapma".
export function vehicleTypeRequested(value,text){
 if(!vehicleTypeInText(value,text))return false;
 const want=canonicalVehicleType(value),t=' '+vehicleTypeKey(text)+' ';
 const spans=[];
 for(const[alias,kind]of aliases)if(alias&&kind===want){
   for(const m of t.matchAll(new RegExp(' '+alias.replace(/ /g,' +')+'(?= )','g')))spans.push({start:m.index+1,end:m.index+m[0].length});
 }
 const whole=spans.filter(a=>!spans.some(b=>b.start<=a.start&&b.end>=a.end&&(b.end-b.start>a.end-a.start)));
 return whole.some(m=>!/^ (?:(?:turunu|turu|olarak|arac|i|yi|e|a) )?(?:degil|olmaz|olmasin|yapma|yapmayin|degistirme|degistirmeyin|yanlis)(?: |$)/.test(t.slice(m.end)));
}
export function documentVehicleType(text){
 const exact=canonicalVehicleType(text);if(exact)return exact;
 const t=' '+vehicleTypeKey(text)+' ',found=new Set();
 for(const[alias,kind]of aliases)if(kind!=='Araç/Makine'&&alias&&t.includes(' '+alias+' '))found.add(kind);
 // More specific multiword kinds shadow their own final word (yarı römork/römork).
 if(found.has('Yarı Römork'))found.delete('Römork');
 if(found.has('Çekici'))found.delete('Tır');
 if(found.size===1)return [...found][0];
 return 'Araç/Makine';
}
export function normalizedVehicleFields(fields,previous=null){
 const f={...fields};
 if(!previous||f.type!==previous.type)f.type=canonicalVehicleType(f.type)||String(f.type||'Araç/Makine').trim().slice(0,80);
 if(f.type_review&&(f.type_review.type!==f.type||f.type_review.name!==String(f.name||'')))f.type_review=null;
 return f;
}
