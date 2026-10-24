"""Only the fixed loopback disposable database; never reads app environment."""
import importlib.util, json
from pathlib import Path
spec=importlib.util.spec_from_file_location('fixture',Path(__file__).with_name('phase5-isolated-test.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
before=m.metadata();results=[]
def test(name,fn):
 try:fn();results.append(dict(name=name,status='PASS'))
 except Exception as e:results.append(dict(name=name,status='FAIL',error=str(e)));raise
 finally:
  print(results[-1],flush=True)
  (m.LOCAL/'extensions-results.json').write_text(json.dumps(results,indent=2))
def eq(a,b):assert a==b,(a,b)
def apply():
 with m.connect(autocommit=True) as c:c.execute((m.ROOT/'supabase/review/studio_extensions.proposed.sql').read_text())
test('extension applies only in disposable PostgreSQL',apply)
test('core auth, trainer helpers, grants, RLS unchanged',lambda:eq(m.metadata(),before))
KEY='inquiry:'+m.ident('studio-inquiry')+':2026-10-23'
def lifecycle():
 eq(m.run('select studio_set_reminder(%s,true)',(KEY,))[0][0],True)
 eq(m.run('select handled,updated_by::text from studio_reminders where id=%s',(KEY,))[0],(True,m.ADMIN))
 m.run('select studio_set_reminder(%s,false)',(KEY,))
 eq(m.run('select handled from studio_reminders where id=%s',(KEY,))[0][0],False)
 eq(m.run("select count(*) from studio_audit where source='studio_reminders' and entity_id=%s",(KEY,))[0][0],2)
test('mark and reopen persist with actor and append-only audit',lifecycle)
def isolation():
 for identity in [m.TRAINER,m.OTHER,m.INACTIVE]:
  eq(m.run('select * from studio_reminders',identity=identity),[])
  m.reject('select studio_set_reminder(%s,true)',(KEY,),identity=identity,states=['42501'])
 m.reject('select * from studio_reminders',role='anon',identity=None,states=['42501'])
 m.reject('select studio_set_reminder(%s,true)',(KEY,),role='anon',identity=None,states=['42501'])
 m.reject('delete from studio_reminders',states=['42501'])
 m.reject('update studio_reminders set updated_by=%s',(m.TRAINER,),states=['42501'])
test('anonymous, trainer, delete and actor-forgery paths denied',isolation)
def certificates():
 with m.connect(autocommit=True) as c:c.execute('grant insert on studio_certificates to authenticated')
 cid=m.ident('snapshot-certificate')
 m.run("insert into studio_certificates(id,reference,participant_name,title,issue_date,template,studio_name_snapshot,footer_snapshot) values(%s,'AYC-2020-ABCDEF012345','SYNTHETIC','Workshop','2020-01-01','minimal','Original studio','Original footer') returning id",(cid,))
 m.reject("update studio_certificates set footer_snapshot='Changed' where id=%s",(cid,),states=['42501'])
 eq(m.run('select template,studio_name_snapshot,footer_snapshot from studio_certificates where id=%s',(cid,))[0],('minimal','Original studio','Original footer'))
 m.reject("insert into studio_certificates(id,reference,participant_name,title,issue_date,template) values(%s,'AYC-2020-ABCDEF012346','SYNTHETIC','Workshop','2020-01-01','forged') returning id",(m.ident('bad-template'),),states=['23514'])
test('certificate layout and snapshots immutable and constrained',certificates)
def maps():
 with m.connect(autocommit=True) as c:
  c.execute("update studio_settings set content=content||'{\"maps_url\":\"https://maps.google.com/?q=studio\"}'::jsonb where id='studio'")
  c.execute('grant execute on function studio_public_content() to anon,authenticated')
 eq(m.run("select studio_public_content()->'settings'->>'maps_url'",role='anon',identity=None)[0][0],'https://maps.google.com/?q=studio')
test('public projection includes approved Maps field',maps)
def rerun():
 try:apply()
 except m.psycopg.Error as e:eq(e.sqlstate,'P0001');return
 raise AssertionError('rerun accepted')
test('repeat application fails before alteration',rerun)
def recovery():
 count=m.run('select count(*) from studio_reminders')[0][0]
 with m.connect(autocommit=True) as c:
  c.execute((m.ROOT/'supabase/review/studio_extensions_verify_readonly.sql').read_text())
  c.execute((m.ROOT/'supabase/review/studio_extensions_disable.recovery.proposed.sql').read_text())
 m.reject('select studio_set_reminder(%s,true)',(KEY,),states=['42501'])
 eq(m.run('select count(*) from studio_reminders')[0][0],count)
 m.reject("insert into studio_certificates(id,reference,participant_name,title,issue_date) values(%s,'AYC-2020-123456ABCDEF','SYNTHETIC','Workshop','2020-01-01') returning id",(m.ident('after-recovery'),),states=['42501'])
test('read-only verification and recovery quarantine preserve records',recovery)
print('RESULTS',len(results),'passed')
