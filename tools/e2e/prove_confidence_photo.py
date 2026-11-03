"""Run the unchanged mixed-photo test on live v99 and the pre-fix PR head. Synthetic profiles only."""
import os,sys,time,tempfile,subprocess,json
from pathlib import Path
from urllib.request import urlopen
root=Path.cwd();out=Path('/tmp/solo-confidence100');out.mkdir(exist_ok=True)
results=[]
for label,ref,expected in [('live99','18e78cda6ecdfea6e149772c380037bbae8c6fba',0),('before224','6faebb16aacabc2f166a57221755a261cdd478d6',1)]:
 with tempfile.TemporaryDirectory(prefix='confidence-photo-') as temp:
  temp=Path(temp);archive=temp/'source.tar';subprocess.run(['git','-c','safe.directory='+str(root),'archive','--output',str(archive),ref],check=True);subprocess.run(['tar','-xf',str(archive),'-C',str(temp)],check=True)
  test='tools/e2e/assistant_large_batch.py';assert (temp/test).read_bytes()==(root/test).read_bytes(),'The original mixed25 assertions must stay unchanged'
  with open(out/(label+'-http.log'),'w') as http:
   server=subprocess.Popen([sys.executable,'-m','http.server','8859','--bind','127.0.0.1','--directory',str(temp)],stdout=http,stderr=subprocess.STDOUT)
   try:
    for attempt in range(60):
     try:
      with urlopen('http://localhost:8859/index.html',timeout=1) as response:assert response.status==200
      break
     except OSError:
      if attempt==59:raise
      time.sleep(.2)
    run=subprocess.run([sys.executable,str(temp/test),'http://localhost:8859/'],capture_output=True,text=True,timeout=150)
    log=run.stdout+run.stderr;(out/(label+'-large.log')).write_text(log)
    assert 'PASS large batch98 native100' in log,log
    if expected==0:assert run.returncode==0 and 'PASS large batch98 mixed25' in log,log
    else:assert run.returncode!=0 and 'Timeout 30000ms exceeded' in log and '.assistant-receipt' in log and 'PASS large batch98 mixed25' not in log,log
    results.append({'label':label,'ref':ref,'expectedFailure':bool(expected),'verified':True});print(json.dumps(results[-1]),flush=True)
   finally:
    server.terminate();server.wait(timeout=10)
(out/'photo-date-proof.json').write_text(json.dumps(results,indent=2))
