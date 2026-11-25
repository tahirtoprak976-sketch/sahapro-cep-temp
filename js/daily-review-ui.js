import {esc} from './ui.js';
import {entryLink} from './entry-context.js';
export function dailyReviewHTML(m){
 const card=g=>`<a class="daily-control-item" data-daily-control href="${esc(g.href)}"><strong>${g.kind==='alert'?'Öncelikli · ':''}${esc(g.findings[0].title)}${g.findings.length>1?` · ${g.findings.length} kontrol`:''}</strong>${g.findings.map((f,i)=>`<span>${i?esc(f.title)+' · ':''}${esc(f.why)}</span>`).join('')}<b>Kaydı incele →</b></a>`;
 return `<section class="card daily-control" data-daily-review><div class="row between"><h2>Günlük kontrol</h2><button class="btn sm" type="button" data-daily-refresh>Yenile</button></div>
 <p data-daily-count><b>İncelenecek ${m.actions.length} kayıt veya liste</b>${m.findings>m.actions.length?' · '+m.findings+' kontrol birlikte gösteriliyor':''}</p>
 <p class="tiny muted">Seçili günün eksikleri ve güncel açık takipler · ${m.filtered?'seçili araç / personel':'tüm araçlar'}. Tür ve arama filtresi bu listeyi daraltmaz.</p>
 <div class="field-actions"><a class="btn" data-daily-compare href="${esc(m.compare)}">Mesajlarla karşılaştır</a><a class="btn" data-daily-close href="${esc(m.close)}">Kapanışı incele</a></div>
 ${m.actions.slice(0,3).map(card).join('')||'<p>Mevcut denetimlerde işlem maddesi yok. Bu, bütün işlerin kaydedildiğini veya günün kapandığını kanıtlamaz.</p>'}
 ${m.actions.length>3?`<details data-daily-more><summary>Tüm kontrolleri göster · ${m.actions.length-3} kayıt / liste daha</summary>${m.actions.slice(3).map(card).join('')}</details>`:''}
 ${m.notes.length?`<details data-daily-notes><summary>Bilgi ve isteğe bağlı kontroller · ${m.notes.length}</summary>${m.notes.map(card).join('')}</details>`:''}
 <details data-daily-no-work><summary>İş kaydı bulunmayan araçlar · ${m.noWork.length}</summary><p class="small muted">Kayıt bulunmaması çalışılmadığı anlamına gelmez. Çalışma varsa tarihli iş taslağını açın; otomatik iş veya puantaj oluşturulmaz.</p>${m.noWork.map(v=>`<a class="daily-control-item" href="${esc(entryLink('work',{date:m.date,vehicle_id:v.id}))}"><strong>${esc(v.plate||v.name||'Araç')}</strong><span>Tarihli iş taslağını aç →</span></a>`).join('')||'<p>Bu kapsamda iş kaydı olmayan aktif araç yok.</p>'}</details>
 </section>`;
}
