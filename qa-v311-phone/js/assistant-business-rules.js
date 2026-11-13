import {foldTr} from './parser.js';
// Structured preferences stay in the existing assistant_rules text setting.
// These select business meaning; they cannot relax money, signature or Save guards.
const prefix='@saha-rule ';
export function businessRules(text=''){
 const rules={yardIsOwn:false,bossPersonnelId:null,sundayPersonnelNote:false,hasYardRule:false};
 for(const line of String(text||'').split(/\r?\n/)){
  if(!line.startsWith(prefix))continue;
  const at=line.indexOf('=',prefix.length);if(at<0)continue;
  const key=line.slice(prefix.length,at),value=line.slice(at+1).trim();
  if(key==='yard_is_own'){rules.yardIsOwn=value==='true';rules.hasYardRule=true;}
  if(key==='boss_personnel_id')rules.bossPersonnelId=value||null;
  if(key==='sunday_personnel_note')rules.sundayPersonnelNote=value==='true';
 }
 return rules;
}
export function withBusinessRules(text,rules){
 const rest=String(text||'').split(/\r?\n/).filter(line=>!line.startsWith(prefix)).join('\n').trimEnd();
 const id=String(rules.bossPersonnelId||'').replace(/[\r\n=]/g,'').slice(0,100);
 return rest+'\n'+prefix+'yard_is_own='+!!rules.yardIsOwn+'\n'+prefix+'boss_personnel_id='+id+'\n'+prefix+'sunday_personnel_note='+!!rules.sundayPersonnelNote;
}
export function businessRuleGuidance(text){
 const r=businessRules(text),out=[];
 if(r.yardIsOwn)out.push('İşletme ayarı: tek başına şantiye ifadesi kendi depomuzdur; müşterinin verdiği yakıt sayılmaz. Depo kartı ve yönü kayıtlardan doğrula.');
 if(r.bossPersonnelId)out.push('İşletme ayarı: patron personel kimliği '+r.bossPersonnelId+'. Gönderdi / ödeme onda ifadeleri tahsilat değildir; patronu müşteri yapma.');
 if(r.sundayPersonnelNote)out.push('İşletme ayarı: pazar mesaisi personel ücret notudur; müşteri fiyatını değiştirme.');
 return out.join('\n');
}

export function bossNames(d,rulesText){
 const id=businessRules(rulesText).bossPersonnelId,p=(d.personnel||[]).find(p=>!p.deleted_at&&p.id===id);if(!p)return [];
 return [p.name,...(d.aliases||[]).filter(a=>!a.deleted_at&&a.active!==false&&a.target_type==='personnel'&&a.target_id===id).map(a=>a.alias)];
}
export function bossDispatch(text,d,rulesText){
 const norm=value=>foldTr(String(value||'')).replace(/[^\p{L}\p{N}]+/gu,' ').trim(),n=norm(text);
 return bossNames(d,rulesText).some(name=>norm(name)&&n.includes(norm(name)))&&/odeme onda|pesin.*gonderdi/.test(n)&&!/aldik|aldim|tahsil|kasaya|teslim|havale|eft/.test(n);
}
