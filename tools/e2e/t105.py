from playwright.sync_api import sync_playwright
U = "http://localhost:8841/index.html"
with sync_playwright() as p:
    b = p.chromium.launch(); c = b.new_context(viewport={'width':412,'height':900}); c.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
    pg = c.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U); pg.wait_for_timeout(4500)
    pg.evaluate("""async()=>{const db=await import('./js/db.js');
      const v=(await db.listActive('vehicles'))[0];
      await db.saveNew('fuel_tank_movements',{date:'2026-10-01',move_type:'GİRİŞ',liters:1000,unit_price:75.16,total:90190,vehicle_id:null,personnel_id:null,pump_no:'',signature_name:''},'t');
      const f=await db.saveFuelEvent({date:'2026-10-02',vehicle_id:v.id,liters:50,fuel_source:'Depo Tankı',personnel_id:null},'t');
      const fr=(await db.listActive('fuel_records'))[0]; await db.put('fuel_records',{...fr,deleted_at:new Date().toISOString()}); // eski sürümde yarım kalmış silme
      await db.addAttachment('expense','olmayan-kayit',new File(['%PDF'],'x.pdf',{type:'application/pdf'}));
      const pe=await db.listActive('personnel'); await db.saveNew('personnel_events',{date:'2026-10-05',personnel_id:pe[0].id,event_type:'İzin',leave_kind:'Yıllık izin',leave_form_id:'yok',hours_days:1},'t');}""")
    pg.goto(U + "#/veri-sagligi"); pg.wait_for_timeout(2500)
    print("önce:", pg.inner_text("#screen").split("\n")[2:4])
    pg.click("[data-fixall]"); pg.wait_for_timeout(500)
    for x in pg.query_selector_all(".sheet button"):
        if x.inner_text().strip()=="Uygula": x.click(); break
    pg.wait_for_timeout(3000)
    print("sonra:", pg.inner_text("#screen").split("\n")[2:4])
    print("ERR", errs); b.close()
