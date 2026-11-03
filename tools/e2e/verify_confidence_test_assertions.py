"""P1 fixture confirmations must retain every existing browser assertion."""
import ast,collections,subprocess
base='18e78cda6ecdfea6e149772c380037bbae8c6fba'
for path in ['tools/e2e/record_notes.py','tools/e2e/assistant_agent.py','tools/e2e/assistant_workflow.py','tools/e2e/assistant_audit80.py']:
 old=subprocess.check_output(['git','-c','safe.directory='+__import__('os').getcwd(),'show',base+':'+path],text=True)
 assertions=lambda s:collections.Counter(ast.dump(n,include_attributes=False) for n in ast.walk(ast.parse(s)) if isinstance(n,ast.Assert))
 before,after=assertions(old),assertions(open(path).read());assert not before-after,path
 print(path, 'original assertions retained',sum(before.values()),'->',sum(after.values()))
