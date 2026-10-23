"""Real IDB request errors must remain Error objects and leave no half-event."""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8841/"
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    context = browser.new_context()
    context.add_init_script("localStorage.setItem('sp_role','boss')")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL + "index.html#/daha")
    page.wait_for_selector('#screen[data-view-ready="1"]')
    results = page.evaluate("""async()=>{
      const db=await import('./js/db.js'),C=await import('./js/core.js');
      const customer=await db.saveNew('customers',{name:'TEST Transaction Customer'},'TEST'),vehicle=await db.saveNew('vehicles',{name:'TEST Transaction Truck'},'TEST');
      await db.saveNew('fuel_tank_movements',{date:C.todayStr(),liters:100,move_type:'GİRİŞ'},'TEST');
      const state=async()=>JSON.stringify({data:await db.dumpAll(),audit:await db.getAll('audit_log'),meta:await db.getAll('meta')});
      const scenarios=[
        ['maintenance_records',()=>db.saveNew('maintenance_records',{date:C.todayStr(),vehicle_id:vehicle.id,maint_type:'Arıza',description:'TEST failed write'},'TEST',{op:{id:'TEST-ERROR-MAINT',hash:'same'}})],
        ['cari_movements',()=>db.saveNew('cash_records',{date:C.todayStr(),customer_id:customer.id,amount:25,cash_type:'Müşteriden Para Alındı',payment_method:'Nakit'},'TEST',{op:{id:'TEST-ERROR-CASH',hash:'same'}})],
        ['fuel_tank_movements',()=>db.saveCustomerFuelDelivery({date:C.todayStr(),customer_id:customer.id,machine:'TEST Forklift',liters:20,unit_price:50},'TEST',{op:{id:'TEST-ERROR-FUEL',hash:'same'}})],
      ],results=[];
      for(const [store,run] of scenarios){
        const before=await state(),put=IDBObjectStore.prototype.put;let hit=false,error=null;
        IDBObjectStore.prototype.put=function(row,...args){const request=put.call(this,row,...args);if(this.name===store&&!hit){hit=true;this.add(row)}return request};
        try{await run()}catch(e){error=e}finally{IDBObjectStore.prototype.put=put}
        results.push({store,hit,errorObject:error instanceof Error,name:error?.name,message:error?.message,unchanged:before===await state()});
      }
      return results;
    }""")
    for result in results:
        assert result["hit"] and result["errorObject"] and result["message"] and result["unchanged"], result
        print("PASS", result["store"], "request error propagates as", result["name"], "; all records, audit and operation metadata roll back", flush=True)
    assert not errors, errors
    browser.close()
