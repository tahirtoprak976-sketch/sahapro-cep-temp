// Readable group summaries are independent of the signed patron transfer.
// No outbox, cash, file, signature or delivery state is written here.
import {entryLine, msgBytes, MSG_LIMIT} from './driver-core.js';
import {preparedPacketError} from './driver-delivery.js';
import {esc, trDate, todayStr} from './ui.js';

export function groupWorkSummary(rows, cfg) {
  const works = rows.filter(e => !e.k);
  if (!works.length) return '';
  // Allowlist: never leak money, private link data, transfer IDs or evidence fields.
  const fields = ['date','vid','cid','cn','sid','wt','q','u','mat','ds','dn','ton','note'];
  return [`📋 Yapılan işler — ${cfg.p[1]}`, ...works.map(e =>
    entryLine(Object.fromEntries(fields.filter(k => e[k] != null).map(k => [k,e[k]])), cfg)
  )].join('\n');
}

export function reviewGroupWorks({root, cfg, rows, readEntries, readConfig}) {
  const works = rows.filter(e => !e.k).sort((a,b) => b.date.localeCompare(a.date));
  if (!works.length) throw Error('Paylaşılacak iş kaydı yok');
  const dates = [...new Set(works.map(e => e.date))];
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'driver-share-overlay'; box.dataset.groupReview = '1';
    box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
    box.setAttribute('aria-labelledby','driver-group-title');
    const previousFocus = document.activeElement, wasInert = root.inert;
    let active = false, closed = false, selected = [], text = '';
    box.innerHTML = `<section class="driver-share-panel"><h2 id="driver-group-title" tabindex="-1">WhatsApp grubunda paylaş</h2><p>Yalnız yapılan işlerin okunur özeti gönderilir. Kod, PDF, fotoğraf ve ayrı nakit bildirimi eklenmez.</p><div class="field"><label for="driver-group-date">Tarih</label><select id="driver-group-date" data-group-date>${dates.map(d=>`<option value="${esc(d)}">${esc(trDate(d))}</option>`).join('')}</select></div><div data-group-rows></div><p class="small" data-group-count></p><pre data-group-preview style="white-space:pre-wrap;overflow-wrap:anywhere;font:inherit"></pre><p class="notice info" role="status" data-group-status>Gruba paylaşmak, patrona kayıt aktarmak değildir. Patrona gönderilecek kayıtlar beklemeye devam eder.</p><button class="btn primary block" data-group-send>WhatsApp grubunda paylaş · yalnız mesaj</button><button class="btn block" data-group-link style="margin-top:8px">WhatsApp bağlantısıyla aç</button><p class="tiny muted">WhatsApp’ı ve grubu siz seçip Gönder’e basarsınız. Uygulama gruba teslim edildiğini doğrulayamaz.</p><button class="btn block" data-group-close style="margin-top:8px">Kapat</button></section>`;
    const date = box.querySelector('[data-group-date]'), list = box.querySelector('[data-group-rows]');
    const send = box.querySelector('[data-group-send]'), link = box.querySelector('[data-group-link]');
    const cancel = box.querySelector('[data-group-close]'), status = box.querySelector('[data-group-status]');
    function update() {
      selected = [...list.querySelectorAll('input:checked')].map(el => works[Number(el.dataset.groupIndex)]);
      text = groupWorkSummary(selected, cfg);
      box.querySelector('[data-group-preview]').textContent = text;
      const tooLong = msgBytes(text) > MSG_LIMIT;
      box.querySelector('[data-group-count]').textContent = `${selected.length} iş seçildi` + (tooLong ? ' · Mesaj uzun; bazı işlerin işaretini kaldırıp ayrı paylaşın.' : '');
      send.disabled = link.disabled = active || !selected.length || tooLong;
    }
    function drawRows() {
      list.innerHTML = works.map((e,i) => e.date === date.value ? `<label class="history-check"><input type="checkbox" data-group-index="${i}" checked><span class="small" style="overflow-wrap:anywhere">${esc(groupWorkSummary([e],cfg).split('\n').slice(1).join('\n'))}</span></label>` : '').join('');
      update();
    }
    function close() {
      if (closed || active) return;
      closed = true; box.remove(); root.inert = wasInert;
      document.removeEventListener('keydown', keys, true); previousFocus?.focus(); resolve();
    }
    function keys(e) {
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
      if(e.key==='Tab'){
        const controls=[...box.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled)')];
        const first=controls[0],last=controls.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    }
    function lock(value) {
      active=value; date.disabled=cancel.disabled=value;
      for(const el of list.querySelectorAll('input'))el.disabled=value;
      update();
    }
    function fail(e) {
      lock(false); status.setAttribute('role','alert');
      status.textContent=e?.name==='AbortError' ? 'Paylaşım iptal edildi. Kayıtlar ve patrona gönderim durumu değişmedi.' : 'Mesaj paylaşılamadı: '+(e.message||e)+'. WhatsApp bağlantısıyla açmayı deneyebilirsiniz. Kayıtlar korunuyor.';
    }
    function share(direct) {
      if(active || !selected.length || msgBytes(text)>MSG_LIMIT)return;
      try {
        const packet={rows:selected,snapshots:selected.map(e=>[e.id,JSON.stringify(e)])};
        const error=preparedPacketError(packet,readEntries(),cfg,readConfig(),todayStr());
        if(error)throw Error(error);
        lock(true); status.setAttribute('role','status');
        let action;
        // Synchronous native call in this click: no compression, files or async work.
        if(!direct && navigator.share)action=navigator.share({text});
        else {
          const popup=window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');
          if(!popup)throw Error('WhatsApp penceresi engellendi; açılır pencereye izin verin');
          popup.opener=null; action=Promise.resolve();
        }
        Promise.resolve(action).then(()=>{
          lock(false);status.textContent='Paylaşım ekranı açıldı. WhatsApp’ta grubu seçip gönderildiğini kontrol edin. Patrona gönderim durumu değişmedi.';
        },fail);
      }catch(e){fail(e);}
    }
    send.onclick=()=>share(false);link.onclick=()=>share(true);cancel.onclick=close;
    date.value=dates.includes(todayStr())?todayStr():dates[0];
    date.onchange=drawRows;list.onchange=update;drawRows();
    root.inert=true;document.body.append(box);document.addEventListener('keydown',keys,true);
    box.querySelector('h2').focus({preventScroll:true});
  });
}
