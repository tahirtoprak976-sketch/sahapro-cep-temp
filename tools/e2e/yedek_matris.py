# Parçalı yedek hata matrisi (TEST VERİSİ): kaynak "telefon" yedek setleri üretir, hedef "telefon" farklı sıralarla yükler.
import json, os, base64
from playwright.sync_api import sync_playwright
U = "http://localhost:8841/"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
MAKE = """async(budget)=>{const db=await import('./js/db.js');const b=await import('./js/backup.js');const bc=await import('./js/backup-crypt.js');
  const out=[];const parts=await b.backupParts(db,{encrypted:true,budget});
  for await(const p of parts){const bytes=await bc.encodeBackup(p,'Yedek-Test-1');let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));out.push(btoa(s));}
  return out}"""
RESTORE = """async([b64,mut])=>{const db=await import('./js/db.js');const b=await import('./js/backup.js');const bc=await import('./js/backup-crypt.js');
  try{let u=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));if(mut==='flip'){u=u.slice();u[u.length-40]^=255;}
    const obj=await bc.decodeBackup(u,async()=>'Yedek-Test-1');
    if(mut==='dropatt')obj.attachments.pop();
    if(mut==='trunc'&&obj.attachments[0])obj.attachments[0].base64=obj.attachments[0].base64.slice(0,-8);
    const r=await b.restoreBackup(db,obj,false);return {ok:true,already:!!r.already,status:b.setStatusText(r.set),done:r.set&&r.set.done}}
  catch(e){return {ok:false,err:String(e.message||e)}}}"""
STATE = """async()=>{const db=await import('./js/db.js');const ic=await import('./js/integrity-ui.js');const r=await ic.runIntegrity(db);
  return {works:(await db.listActive('work_records')).length,atts:(await db.getAll('attachments')).length,incomplete:r.issues.filter(x=>x.code==='restore-incomplete').map(x=>x.text+' | '+x.sub)}}"""
with sync_playwright() as p:
    b = p.chromium.launch()
    def phone():
        c = b.new_context(); c.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
        pg = c.new_page(); pg.goto(U + "index.html"); pg.wait_for_timeout(4000); return c, pg
    # Kaynak telefon: 6 iş, her işte 2 fotoğraf (~250 KB, sıkışmaz) → küçük bütçeyle 3+ parça
    src_c, src = phone()
    src.evaluate("""async()=>{const db=await import('./js/db.js');const c=await db.saveNew('customers',{name:'Test Müşteri'},'t');const v=(await db.listActive('vehicles'))[0];
      for(let i=0;i<6;i++){const w=await db.saveNew('work_records',{date:'2026-10-1'+i,customer_id:c.id,vehicle_id:v.id,work_type:'Kazı',quantity:i+1,unit:'Saat'},'t');
        for(let k=0;k<2;k++){const u=new Uint8Array(250000);crypto.getRandomValues(u.subarray(0,65536));for(let j=65536;j<u.length;j+=65536)u.set(u.subarray(0,Math.min(65536,u.length-j)),j);
          await db.addAttachment('work',w.id,new File([u],'f'+i+k+'.pdf',{type:'application/pdf'}),{kind:'slip_photo'});}}}""")
    A = src.evaluate(MAKE, 1200000); B = src.evaluate(MAKE, 1200000)
    print("set A parça:", len(A), "· set B parça:", len(B))
    check(len(A) >= 3, "küçük parça bütçesiyle çok parçalı set üretildi")
    # 1) doğru sıra
    c1, t1 = phone()
    rs = [t1.evaluate(RESTORE, [x, None]) for x in A]
    st = t1.evaluate(STATE)
    check(all(r["ok"] for r in rs) and "tamamlandı" in rs[-1]["status"] and st["works"] >= 6 and st["atts"] == 12 and not st["incomplete"], f"doğru sırayla: set tamamlandı, 12 ek ({st['atts']})")
    print("     ara durum (1. parçadan sonra):", rs[0]["status"])
    check("TAMAMLANMADI" in rs[0]["status"], "ara parçada 'tamamlandı' denmedi")
    # 2) tekrar yükleme
    r = t1.evaluate(RESTORE, [A[1], None]); st2 = t1.evaluate(STATE)
    check(r["ok"] and r["already"] and st2["atts"] == 12 and st2["works"] == st["works"], "aynı parça tekrar: hiçbir şey değişmedi")
    c1.close()
    # 3) sırasız: 2. parça önce
    c2, t2 = phone()
    r = t2.evaluate(RESTORE, [A[1], None])
    check(not r["ok"] and "1. parçası bu telefonda yüklenmemiş" in r["err"], "2. parça önce: reddedildi, 1. parça istendi")
    # 4) yanlış set: A'nın 1. parçası, sonra B'nin 2. parçası
    t2.evaluate(RESTORE, [A[0], None])
    r = t2.evaluate(RESTORE, [B[1], None])
    check(not r["ok"] and ("yanlış set" in r["err"] or "başka bir yedek setine" in r["err"]), f"yanlış setin parçası reddedildi ({r.get('err','')[:80]})")
    # 5) eksik parça: A1 + A3 (A2 yok) → tamamlanmadı, Veri Sağlığı hata gösterir
    t2.evaluate(RESTORE, [A[2], None])
    st = t2.evaluate(STATE)
    check(bool(st["incomplete"]), f"eksik parça: Veri Sağlığı 'tamamlanmadı' hatası ({st['incomplete'][:1]})")
    # 6) bozuk parçalar: değiştirilmiş bayt, eksik ek, kısaltılmış ek → yazılmaz, durum değişmez
    for mut, want in [("flip", "şifresi yanlış"), ("dropatt", "Parça eksik ya da bozuk"), ("trunc", "Ek bozuk")]:
        r = t2.evaluate(RESTORE, [A[1], mut]); st3 = t2.evaluate(STATE)
        check(not r["ok"] and want in r["err"] and st3["atts"] == st["atts"], f"bozuk parça ({mut}): reddedildi, hiçbir şey yazılmadı ({r.get('err','')[:60]})")
    # 7) uygulama kapanıp açıldıktan sonra devam: eksik A2 yüklenir → tamamlanır
    t2.reload(); t2.wait_for_timeout(3000)
    for x in A[1:]:
        if x is not A[2]: r = t2.evaluate(RESTORE, [x, None])
    st = t2.evaluate(STATE)
    check(r["ok"] and "tamamlandı" in r["status"] and not st["incomplete"] and st["atts"] == 12, f"yeniden açılıştan sonra eksik parça yüklendi → set tamamlandı ({st['atts']} ek)")
    c2.close()
    # 8) iki sekme aynı parçayı aynı anda yükler
    c3, t3 = phone(); t3.evaluate(RESTORE, [A[0], None]); t4 = c3.new_page(); t4.goto(U + "index.html"); t4.wait_for_timeout(3000)
    h1 = t3.evaluate_handle(f"(()=>{{window.__r=({RESTORE})([{json.dumps(A[1])},null]);return 1}})()")
    r4 = t4.evaluate(RESTORE, [A[1], None]); r3 = t3.evaluate("window.__r")
    st = t3.evaluate(STATE)
    n_ok = sum(1 for x in (r3, r4) if x["ok"] and not x.get("already"))
    check(n_ok == 1, f"iki sekme aynı parça: bir kez uygulandı ({[x.get('already') if x['ok'] else x['err'][:40] for x in (r3, r4)]})")
    c3.close(); b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
