"""DILIM3: independent tasks/files, offline restore, multi-tab CAS and applying recovery."""
import argparse,json,os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__);p.add_argument('url',nargs='?',default='http://localhost:8841/');p.add_argument('--artifacts',default='/tmp/solo-assistant-task-center');a=p.parse_args()
BASE=a.url.rstrip('/')+'/';O=urlparse(BASE);assert O.scheme=='http' and O.hostname in ('localhost','127.0.0.1','::1')
assert not O.username and not O.password and not O.query and not O.fragment
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True);errors=[];external=[]
CREATE="""async arg=>{
 const db=await import('./js/db.js'),T=await import('./js/assistant-task.js'),F=await import('./js/assistant-task-files.js');
 const pendingAtStart=(await F.loadPendingFiles(db)).length,previous=await T.readTask(db),chat=await db.metaGet('assistant_conversation_v1');
 const task=await T.saveTaskProposal(db,{epoch:chat.id,previous,result:{goal:arg.goal,plan:{works:[{quantity:arg.quantity}],questions:['Ortak tarih?']}},source:arg.source});
 const pendingBefore=(await F.loadPendingFiles(db)).length,attached=await F.attachFilesToTask(db,task.id);
 return {id:task.id,rev:task.rev,source:task.source,chat:chat.id,pendingAtStart,pendingBefore,attached:attached.length};
}"""
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':850},service_workers='allow')
    ctx.add_init_script("localStorage.setItem('sp_role','boss')")
    def route(req):
        u=urlparse(req.request.url)
        if (u.scheme,u.hostname,u.port)==(O.scheme,O.hostname,O.port):req.continue_()
        else:external.append(req.request.url);req.abort()
    ctx.route('**/*',route);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    name='assistant_center_e2e'
    page.goto(BASE+'index.html?db='+name+'#/akilli-asistan');page.wait_for_selector('[data-photos]')
    page.evaluate("async()=>await navigator.serviceWorker.ready")
    page.locator('[data-photos]').set_input_files({'name':'safe.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4\nstartxref\n0\n%%EOF'})
    page.wait_for_selector('[data-thumbs] img')
    page.wait_for_function("async()=>{const db=await import('./js/db.js');return (await db.draftGet('assistant-pending-files'))?.files?.length===1;}")
    page.evaluate("""async()=>{const F=await import('./js/assistant-task-files.js'),db=await import('./js/db.js');const f=new File(['%PDF-1.4\\nstartxref\\n0\\n%%EOF'],'safe.pdf',{type:'application/pdf'});await F.savePendingFiles(db,[f]);}""")
    ids=[]
    for goal,quantity in [('Görev A',1),('Görev B',2)]:
        value=page.evaluate(CREATE,{'goal':goal,'quantity':quantity,'source':goal+' kaynak'})
        ids.append(value)
    early=page.evaluate("""async id=>{const F=await import('./js/assistant-task-files.js'),db=await import('./js/db.js');return {files:(await F.loadTaskFiles(db,id)).length,draft:await db.draftGet('assistant-task-files:'+id)};}""",ids[0]['id'])
    assert early['files']==1,early
    page.reload();page.wait_for_selector('details[data-task-center]')
    assert page.locator('details[data-task-center]').inner_text().find('Açık görevler (2/5)')>=0
    assert page.locator('[data-task-activate="'+ids[0]['id']+'"]').count()==1
    page.screenshot(path=str(out/'task-center-390.png'),full_page=True)
    page.reload();page.wait_for_selector('details[data-task-center]')
    # Files live only with their task; activating A restores exactly one PDF.
    page.locator('[data-task-activate="'+ids[0]['id']+'"]').click()
    page.wait_for_timeout(700)
    page.wait_for_selector('[data-thumbs] img')
    active=page.evaluate("""async()=>{const db=await import('./js/db.js'),T=await import('./js/assistant-task.js'),F=await import('./js/assistant-task-files.js');const t=await T.readTask(db);return {id:t.id,files:(await F.loadTaskFiles(db,t.id)).length};}""")
    assert active=={'id':ids[0]['id'],'files':1},active
    other=page.evaluate("""async id=>{const db=await import('./js/db.js');return (await db.metaGet('assistant_tasks_v1')).items.find(x=>x.id===id)}""",ids[1]['id'])
    assert other['source']==ids[1]['source'] and other['rev']==ids[1]['rev']

    # A second tab with a stale revision cannot commit over the first tab.
    second=ctx.new_page();second.on('pageerror',lambda e:errors.append(str(e)))
    second.goto(BASE+'README.md?db='+name)
    stale_result=second.evaluate(CREATE,{'goal':'İkinci sekme','quantity':5,'source':'stale'})
    revised=page.evaluate("""async arg=>{
      const db=await import('./js/db.js'),T=await import('./js/assistant-task.js');const previous=await T.readTask(db),chat=await db.metaGet('assistant_conversation_v1');
      return await T.saveTaskProposal(db,{epoch:chat.id,previous,result:{mode:'continue',task_id:previous.id,plan:{works:[{quantity:99}]}},source:'yeni revizyon'});
    }""")
    assert revised['rev']==2
    rejected=second.evaluate("""async arg=>{
      const db=await import('./js/db.js'),T=await import('./js/assistant-task.js');
      try{await T.saveTaskProposal(db,{epoch:arg.chat,previous:arg.previous,result:{mode:'continue',task_id:arg.previous.id,plan:{works:[{quantity:5}]}},source:'eski revizyon'});return 'unexpected commit'}catch(e){return e.message}
    }""",{'chat':ids[0]['chat'],'previous':ids[0]})
    assert 'başka sekmede' in rejected,rejected
    second.close()

    # Applying is recovery/review, never an automatic replay after reload.
    applying=page.evaluate("""async()=>{const db=await import('./js/db.js'),T=await import('./js/assistant-task.js');const current=await T.readTask(db);return await T.transitionTask(db,current,'applying');}""")
    page.reload();page.wait_for_selector('details[data-task-center]')
    assert 'applying' in page.evaluate("async()=>(await (await import('./js/db.js')).metaGet('assistant_tasks_v1')).items.find(x=>x.id==='"+applying['id']+"').status")
    assert 'otomatik tekrar uygulanmaz' in page.locator('details[data-task-center]').inner_text()

    # Real service-worker offline reopen: task and file remain; no provider call occurs.
    ctx.set_offline(True)
    page.reload(wait_until='domcontentloaded');page.wait_for_selector('details[data-task-center]')
    assert page.locator('[data-task-activate="'+ids[1]['id']+'"]').count()==1
    assert not external,external
    assert not errors,errors
    result={'local_synthetic_only':True,'independent_tasks_restored':True,'task_file_restored':True,'stale_revision_rejected':True,'applying_not_replayed':True,'offline_reopen':True,'provider_calls':external,'page_errors':errors}
    (out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2),flush=True)
    ctx.close();browser.close()
