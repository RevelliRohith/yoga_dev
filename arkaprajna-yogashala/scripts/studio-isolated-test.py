"""Synthetic operations tests; fixed loopback database, never application credentials.

Run after phase5-isolated-test.py in the same disposable cluster. Auth is a local
JWT-subject stub, not a Supabase session. Results retain failures and SQLSTATEs.
"""
import importlib.util, json, datetime, concurrent.futures, re
from pathlib import Path

spec = importlib.util.spec_from_file_location('financial_fixture', Path(__file__).with_name('phase5-isolated-test.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
RESULTS = []
original_run=m.run
def fixture_run(q,*args,**kwargs):
    if isinstance(q,str) and re.match(r"^(insert|update|delete)\b",q,re.I) and 'returning' not in q.lower():q+=' returning id'
    return original_run(q,*args,**kwargs)
m.run=fixture_run

def record(name, fn):
    try:
        fn(); result = dict(name=name, status='PASS')
    except Exception as e:
        result = dict(name=name, status='FAIL', error=str(e), sqlstate=getattr(e,'sqlstate',None))
    RESULTS.append(result)
    print(result['status'], name, result.get('error',''), flush=True)
    (m.LOCAL/'studio-results.json').write_text(json.dumps(dict(synthetic_only=True, auth_stub=True, results=RESULTS), indent=2))
    if result['status']=='FAIL': raise SystemExit(1)
def apply(file):
    with m.connect(autocommit=True) as c: c.execute((m.ROOT/'supabase/review'/file).read_text())
def eq(a,b): assert a==b, (a,b)
def content(identity=None,role='anon'):
    return m.run('select studio_public_content()',role=role,identity=identity)[0][0]
EVENT=m.ident('studio-event'); CERT=m.ident('studio-certificate'); INQUIRY=m.ident('studio-inquiry')
TODAY=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5,minutes=30))).date()
legacy=m.metadata()
with m.connect(autocommit=True) as c:
    financial=c.execute("select relname,relacl::text,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relname like 'fee_%' order by relname").fetchall()

record('complete operations migration under supplied broad default ACLs',lambda:apply('studio_operations.proposed.sql'))
record('existing four-table definitions, policies, constraints, helpers and grants unchanged',lambda:eq(m.metadata(),legacy))
def schema():
    rows=m.run("select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'studio_%'")
    eq(len(rows),5);assert all(x[1] for x in rows)
    eq(m.run("select count(*) from pg_index where indrelid in (select oid from pg_class where relname like 'studio_%') and (not indisvalid or not indisready)")[0][0],0)
    eq(m.run("select count(*) from pg_constraint where conrelid in (select oid from pg_class where relname like 'studio_%') and not convalidated")[0][0],0)
record('five RLS tables, validated constraints and valid indexes',schema)
def settings():
    v={'name':'SYNTHETIC Studio','secret':'PRIVATE-SENTINEL','programs':[{'name':'Yoga','description':'Synthetic','audience':'Adults','private':'PRIVATE-SENTINEL'}], 'trainers':[dict(profile_id=m.TRAINER,name='Synthetic teacher',specialization='Yoga',qualifications='Synthetic',biography='Synthetic',mobile='PRIVATE-SENTINEL'),dict(profile_id=m.INACTIVE,name='Hidden inactive',specialization='',qualifications='',biography='')]}
    m.run("insert into studio_settings(id,content) values('studio',%s)",(m.Jsonb(v),))
    p=content();eq(p['settings']['name'],'SYNTHETIC Studio');eq(len(p['settings']['trainers']),1)
    assert 'PRIVATE-SENTINEL' not in json.dumps(p) and m.TRAINER not in json.dumps(p)
    m.run('update profiles set is_active=false where id=%s',(m.TRAINER,));eq(content()['settings']['trainers'],[])
    m.run('update profiles set is_active=true where id=%s',(m.TRAINER,))
record('safe public settings projection and inactive teacher removal',settings)
def events():
    m.run("insert into studio_events(id,title,starts_at) values(%s,'Synthetic event',now())",(EVENT,));eq(content()['events'],[])
    m.run('update studio_events set published=true where id=%s',(EVENT,));eq(len(content()['events']),1)
    m.run('update studio_events set published=false where id=%s',(EVENT,));eq(content()['events'],[])
    m.reject('delete from studio_events where id=%s',(EVENT,),states=['42501'])
record('admin event draft, publication, withdrawal and no DELETE privilege',events)
def isolation():
    for role,identity in [('anon',None),('authenticated',m.TRAINER),('authenticated',m.OTHER),('authenticated',m.INACTIVE)]:
        for table in ['studio_settings','studio_events','studio_inquiries','studio_certificates','studio_audit']:
            if role=='anon':m.reject('select * from '+table,role=role,identity=identity,states=['42501'])
            else:eq(m.run('select * from '+table,role=role,identity=identity),[])
        m.reject("insert into studio_events(id,title,starts_at) values(%s,'Denied',now())",(m.ident(role+str(identity)),),role=role,identity=identity,states=['42501'])
    for role in ['anon','authenticated']:
        m.reject('select studio_audit_change()',role=role,states=['42501'])
record('anonymous, active, other and inactive trainer private isolation',isolation)
def certificate():
    m.run("insert into studio_certificates(id,reference,participant_name,title,issue_date) values(%s,'AYC-2026-ABCDEF012345','Synthetic participant','Participation',%s)",(CERT,TODAY))
    m.reject("insert into studio_certificates(id,reference,participant_name,title,issue_date) values(%s,'AYC-2026-ABCDEF012345','Duplicate','Participation',%s)",(m.ident('duplicate-cert'),TODAY),states=['23505'])
    m.reject("insert into studio_certificates(id,reference,participant_name,title,issue_date) values(%s,'AYC-2026-123456ABCDEF','Future','Participation',%s)",(m.ident('future-cert'),TODAY+datetime.timedelta(days=1)),states=['23514'])
    m.reject("update studio_certificates set title='Changed' where id=%s",(CERT,),states=['42501'])
    m.reject('delete from studio_certificates where id=%s',(CERT,),states=['42501'])
record('certificate issuance, unique reference, date constraint and immutable record',certificate)
def inquiry(request=INQUIRY,mobile='+919999999999',name='Synthetic inquiry',date=None,honey='',message='Synthetic only'):
    return m.run('select studio_submit_inquiry(%s,%s,%s,%s,%s,%s,%s)',(request,name,mobile,'Yoga',date,message,honey),role='anon',identity=None)
record('inquiry API disabled before separate activation',lambda:m.reject('select studio_submit_inquiry(%s,%s,%s,%s,%s,%s,%s)',(INQUIRY,'Synthetic','+919999999999','Yoga',None,'',''),role='anon',identity=None,states=['42501']))
record('separate inquiry activation in isolated database only',lambda:apply('studio_inquiries_activate.proposed.sql'))
def inquiries():
    eq(inquiry(),[(True,)]);eq(inquiry(),[(True,)])
    eq(m.run('select count(*) from studio_inquiries where id=%s',(INQUIRY,))[0][0],1)
    for i in range(2):inquiry(m.ident('mobile-limit'+str(i)))
    try:inquiry(m.ident('mobile-limit-four'))
    except m.psycopg.Error as e:eq(e.sqlstate,'P0001')
    else:raise AssertionError('Per-mobile rate limit bypass')
    for args in [dict(mobile='123'),dict(honey='bot'),dict(date=TODAY-datetime.timedelta(days=1)),dict(name=''),dict(message='x'*2001)]:
        try:inquiry(m.ident('invalid'+str(args)),**args)
        except m.psycopg.Error as e:eq(e.sqlstate,'P0001')
        else:raise AssertionError('Invalid inquiry accepted')
record('inquiry validation, stable-request deduplication and mobile rate limit',inquiries)
def concurrency():
    def submit(i):
        try:inquiry(m.ident('concurrent-inquiry'+str(i)),'+918888888888');return True
        except m.psycopg.Error as e:eq(e.sqlstate,'P0001');return False
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: eq(sum(pool.map(submit,range(8))),3)
record('concurrent inquiry calls cannot bypass durable per-mobile quota',concurrency)
def followup():
    before=m.run('select count(*) from students')[0][0]
    m.run("update studio_inquiries set status='converted',notes='Synthetic follow-up' where id=%s",(INQUIRY,))
    eq(m.run('select count(*) from students')[0][0],before)
    m.reject("update studio_inquiries set mobile='+917777777777' where id=%s",(INQUIRY,),states=['42501'])
    audit=m.run("select details from studio_audit where source='studio_inquiries'")
    assert '+919999999999' not in json.dumps(audit) and 'Synthetic inquiry' not in json.dumps(audit)
    m.reject('delete from studio_audit',states=['42501'])
    m.reject("update studio_audit set action='Changed'",states=['42501'])
record('follow-up column permissions, no implicit admission and private append-only audit',followup)
def history():
    m.run("update students set batch_id=%s,status='inactive' where id=%s",(m.BATCH2,m.STUDENT))
    row=m.run("select details from studio_audit where source='students' and entity_id=%s",(m.STUDENT,))[-1][0]
    eq(set(row['after']),{'program_id','batch_id','status'});eq(row['before']['status'],'active');eq(row['after']['status'],'inactive')
    assert 'SYNTHETIC PRIVATE' not in json.dumps(row)
    m.run("update students set batch_id=%s,status='active' where id=%s",(m.BATCH,m.STUDENT))
    eq(len(m.run('select * from trainer_student_roster()',identity=m.TRAINER)),1)
    eq(m.run('select * from trainer_student_roster()',identity=m.INACTIVE),[])
    eq(m.run('select * from students',identity=m.TRAINER),[])
record('enrollment history excludes contacts and preserves trainer assignment restrictions',history)
def global_limit():
    count=m.run('select count(*) from studio_inquiries')[0][0]
    for i in range(50-count):inquiry(m.ident('global'+str(i)),'+917'+str(i).zfill(9))
    try:inquiry(m.ident('global-excess'),'+916123456789')
    except m.psycopg.Error as e:eq(e.sqlstate,'P0001')
    else:raise AssertionError('Global quota bypass')
    eq(m.run('select count(*) from studio_inquiries')[0][0],50)
record('global inquiry quota is exactly 50 per hour',global_limit)
record('prepared read-only catalog verification executes',lambda:apply('studio_operations_verify_readonly.sql'))
record('existing security metadata remains unchanged after workflows',lambda:eq(m.metadata(),legacy))
def finance_unchanged():
    with m.connect(autocommit=True) as c:eq(c.execute("select relname,relacl::text,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relname like 'fee_%' order by relname").fetchall(),financial)
record('financial schema and quarantine permissions unaffected',finance_unchanged)
def rerun():
    try:apply('studio_operations.proposed.sql')
    except m.psycopg.Error as e:eq(e.sqlstate,'P0001')
    else:raise AssertionError('Reapplication guard missing')
record('one-time operations migration guard rejects rerun',rerun)
def recovery():
    counts=m.run('select (select count(*) from studio_inquiries),(select count(*) from studio_audit)')[0]
    apply('studio_operations_disable.recovery.proposed.sql')
    eq(m.run('select (select count(*) from studio_inquiries),(select count(*) from studio_audit)')[0],counts)
    m.reject('select studio_public_content()',role='anon',identity=None,states=['42501'])
    m.reject("update studio_events set title='Denied'",states=['42501'])
    m.reject("update studio_inquiries set notes='Denied'",states=['42501'])
    eq(m.run("select tgenabled from pg_trigger where tgname='studio_enrollment_history'")[0][0],'D')
    m.run("update students set status='active' where id=%s",(m.STUDENT,))
    eq(m.metadata(),legacy)
record('recovery quarantines new writes/public RPCs, preserves records and existing admin access',recovery)
print('RESULTS',len(RESULTS),'passed, 0 failed')

