// Explicit customer creation, independent of the language model. No business writes until the button is pressed.
import {foldTr} from './parser.js';
import {isActive} from './core.js';
import {customerNameKey,customerLabel} from './driver-customer.js';
import {qs,esc,notice} from './ui.js';

export const CUSTOMER_CREATE_INTENT='customer.create';
const fold=s=>foldTr(String(s||'')).trim();
const verb=String.raw`(?:olustur(?:ur\s*musun|abilir\s*misin)?|ekle(?:r\s*misin|yebilir\s*misin)?|ac(?:ar\s*misin|abilir\s*misin)?|kaydet|kaydeder\s*misin|kaydedebilir\s*misin)`;
const cleanName=s=>String(s||'').trim().replace(/^["“”«»]+|["“”«»]+$/gu,'').trim().replace(/\s+/g,' ');
// A short answer may be a name only when there is an explicit create request. Commands/transactions are never names.
export function customerNameAnswer(value) {
  const name=cleanName(value),f=fold(name);
  if(name.length<2||name.length>120||!/[\p{L}]/u.test(name)||/[\n\r<>:=!?;{}]|https?:|SP1:|AIza/i.test(String(value)))return null;
  if(/^(?:bunu|bu|onu|o|evet|hayir|tamam|onayla|kaydet|vazgec|merhaba|selam|yardim|iptal|musteri(?:nin)?\s*adi?)$/u.test(f))return null;
  if(/\b(?:olustur\w*|ekle\w*|kaydet\w*|goster\w*|sil|silme|iptal|odedi\w*|odeme|tahsilat|verildi|verilmis\w*|alindi|yapti\w*|yapildi|tasindi|guncelle\w*|degistir\w*|olmasin|olusturma|ekleme|acma|ac|olsun|borc|litre|sefer|saat|mazot|forklift|toplam|tutar|fiyat|telefon|ana\s+firma)\b/u.test(f)||/\d\s*(?:tl|lt|ton|₺)\b/u.test(f))return null;
  return name;
}
export function customerCreateRequest(text,previous) {
  const raw=String(text||'').trim(),f=fold(raw);
  // A dedicated intent survives reload, but only the immediately preceding question consumes a bare name.
  if(previous?.intent===CUSTOMER_CREATE_INTENT && previous.status==='clarify') {
    const name=customerNameAnswer(raw);if(name)return {kind:'draft',name};
  }
  const ask=()=>({kind:'ask',name:''});
  if(new RegExp(`^(?:lutfen\\s+)?(?:(?:bir|yeni|bir yeni)\\s+)?musteri(?:\\s+karti)?\\s+${verb}[.!?]?$`).test(f))return ask();
  if(new RegExp(`^(?:bunu|onu|bu ismi|bu adi)(?:\\s+(?:da|de))?\\s+(?:yeni\\s+)?(?:musteri(?:\\s+olarak)?\\s+)?${verb}[.!?]?$`).test(f)){
    const name=previous&&!['cancelled','saved'].includes(previous.status)?customerNameAnswer(previous.user):null;
    return name?{kind:'draft',name}:ask();
  }
  // Match folded text for Turkish/ASCII spelling, slice the original so the name's spelling is retained.
  const patterns=[
    new RegExp(`^(?:lutfen\\s+)?(?:yeni\\s+)?musteri(?:\\s+karti)?\\s+${verb}\\s*[:,-]?\\s+(.+?)[.!]?$`),
    new RegExp(`^(?:lutfen\\s+)?(?:yeni\\s+)?musteri(?:\\s+adi)?\\s*:\\s*(.+?)(?:\\s+${verb})?[.!]?$`),
    new RegExp(`^(?:lutfen\\s+)?(.+?)\\s+(?:(?:icin|adinda|isimli|isminde|diye)\\s+)?(?:yeni\\s+)?musteri(?:sini|\\s+karti|\\s+olarak)?\\s+${verb}[.!?]?$`),
    new RegExp(`^(?:lutfen\\s+)?(.+?)\\s+(?:adinda|isimli|isminde)\\s+(?:yeni\\s+)?musteri(?:\\s+karti)?\\s+${verb}[.!?]?$`),
    new RegExp(`^(.+?)\\s+(?:bunu|onu)\\s+(?:yeni\\s+)?(?:musteri(?:\\s+olarak)?\\s+)?${verb}[.!?]?$`),
  ];
  for(const re of patterns){
    const m=re.exec(f);if(!m)continue;
    const offset=m.index+m[0].indexOf(m[1]);
    const original=raw.slice(offset,offset+m[1].length).replace(/['’](?:yi|yı|yu|yü|i|ı|u|ü)$/iu,'');
    const name=customerNameAnswer(original);
    // Complex requests (phone, work, multiple customers) continue through the existing full planner.
    if(name && !/\s(?:ve|ile)\s/u.test(fold(name)))return {kind:'draft',name};
  }
  return null;
}
export function customerCreateMatches(name,parent,customers=[]) {
  const key=customerNameKey(name),rows=customers.filter(isActive);
  const exact=rows.filter(c=>customerNameKey(c.name)===key&&(c.parent_customer_id||null)===(parent||null));
  const similar=rows.filter(c=>!exact.includes(c)&&key.length>=2&&(
    customerNameKey(c.name).includes(key)||key.includes(customerNameKey(c.name))||
    key.split(' ')[0].length>=3&&key.split(' ')[0]===customerNameKey(c.name).split(' ')[0]
  ));
  return {exact,similar};
}
export function showCustomerCreate(ctx,out,request,customers,conversation,turn) {
  out.innerHTML=`<section class="card" data-customer-create><h3>Yeni müşteri oluştur</h3><p class="small">Müşterinin adını kontrol edin. Benzer bir kayıt adı kendiliğinden değiştirmez.</p>
    <div class="field"><label for="assistant-customer-name">Müşteri adı</label><input id="assistant-customer-name" data-customer-name maxlength="120" value="${esc(request.name||'')}" autocomplete="off"></div>
    <div class="field"><label for="assistant-customer-phone">Telefon (isteğe bağlı)</label><input id="assistant-customer-phone" data-customer-phone type="tel" maxlength="40"></div>
    <div class="field"><label for="assistant-customer-parent">Ana firma (taşeronsa, isteğe bağlı)</label><select id="assistant-customer-parent" data-customer-parent><option value="">Bağımsız müşteri</option>${customers.filter(isActive).map(c=>`<option value="${esc(c.id)}">${esc(customerLabel(c,customers))}</option>`).join('')}</select></div>
    <div data-customer-matches aria-live="polite"></div>
    <label class="history-check small" data-customer-separate-wrap hidden><input type="checkbox" data-customer-separate> Benzer kayıtlardan ayrı yeni bir müşteri oluşturmak istiyorum</label>
    <p class="small" data-customer-error role="alert"></p>
    <button class="btn primary block" data-create-customer>Müşteriyi oluştur</button>
    <button class="btn block" data-cancel-customer style="margin-top:8px">Vazgeç</button>
    <p class="tiny muted">Bu işlem yalnız müşteri kartı açar; iş, borç veya tahsilat yazmaz.</p></section>`;
  const box=qs('[data-customer-create]',out),nameEl=qs('[data-customer-name]',box),parentEl=qs('[data-customer-parent]',box),separate=qs('[data-customer-separate]',box),button=qs('[data-create-customer]',box),error=qs('[data-customer-error]',box);
  let busy=false;
  const refresh=(reset=false)=>{
    if(reset)separate.checked=false;
    const name=customerNameAnswer(nameEl.value),m=customerCreateMatches(name||'',parentEl.value,customers);
    qs('[data-customer-separate-wrap]',box).hidden=!m.similar.length||!!m.exact.length;
    qs('[data-customer-matches]',box).innerHTML=m.exact.length?notice('info',m.exact.length===1?'Bu ad ve ana firmayla müşteri zaten kayıtlı. Yeni kart açılmayacak.':'Aynı ad ve ana firmayla birden fazla kayıt var. Doğru kartı açın.')+m.exact.map(c=>`<button class="btn block" data-go="#/musteriler/${esc(c.id)}">Mevcut kartı aç: ${esc(customerLabel(c,customers))}</button>`).join(''):m.similar.length?notice('warn','Benzer kayıtlar var. Mevcut kartı açabilir veya aşağıdan ayrı müşteri oluşturmayı seçebilirsiniz.')+m.similar.slice(0,8).map(c=>`<button class="btn block" data-go="#/musteriler/${esc(c.id)}">${esc(customerLabel(c,customers))}</button>`).join(''):'';
    button.disabled=busy||!name||!!m.exact.length||!!m.similar.length&&!separate.checked;
    if(reset)error.textContent='';
  };
  nameEl.oninput=()=>refresh(true);parentEl.onchange=()=>refresh(true);separate.onchange=()=>refresh();refresh();
  qs('[data-cancel-customer]',box).onclick=async()=>{
    if(busy)return;
    box.remove();await conversation.finish(turn,{status:'cancelled',reply:'Müşteri oluşturma taslağından vazgeçildi; kayıt açılmadı.',intent:null});
  };
  button.onclick=async()=>{
    if(busy||button.disabled||!box.isConnected||qs('[data-ask]',ctx.root)?.disabled)return;
    const name=customerNameAnswer(nameEl.value),phone=qs('[data-customer-phone]',box).value.trim(),parent=parentEl.value||null;
    if(!name)return;
    if(phone&&(!/^[+\d\s().-]+$/u.test(phone)||phone.replace(/\D/g,'').length<10||phone.replace(/\D/g,'').length>15)){error.textContent='Telefonu 10–15 rakam olarak yazın veya boş bırakın.';return;}
    const locked=[...ctx.root.querySelectorAll('button,input,textarea,select')].filter(el=>!el.disabled);busy=true;for(const el of locked)el.disabled=true;
    let rec;
    try {
      rec=await ctx.db.ensureCustomerCard(name,parent,{fields:{phone},conversation:turn,reason:'Asistan: onaylanan yeni müşteri'});
    } catch(e){
      error.textContent='Müşteri oluşturulamadı: '+(e.message||e);
      // Refresh a reset epoch too, so the very next new request can continue in the new chat.
      try{await conversation.finish(turn,{status:'error',reply:error.textContent,intent:null});}catch{}
    }
    if(rec){
      const reply=rec._existing?`“${rec.name}” zaten kayıtlıydı; mevcut kart kullanıldı, ikinci kayıt açılmadı.`:`“${rec.name}” müşteri kartı oluşturuldu.`;
      out.innerHTML=notice('ok',reply)+`<button class="btn primary block" data-go="#/musteriler/${esc(rec.id)}">Müşteri kartını aç</button>`;
      try{await conversation.receipt(turn,{status:'saved',reply,intent:null});}catch{out.insertAdjacentHTML('beforeend',notice('warn','Müşteri kaydedildi; sohbet notu güncellenemedi.'));}
    }
    busy=false;for(const el of locked)if(el.isConnected)el.disabled=false;
    if(box.isConnected)refresh();
  };
}
