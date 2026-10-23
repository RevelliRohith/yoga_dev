"""Synthetic local PostgreSQL tests. Never reads application environment files.

Run from project root. Connection is pinned to loopback:55432/phase5_disposable.
Requires test-only psycopg in ignored supabase/review/baselines/tools and an initialized cluster.
Schema metadata is reused, never production application/Auth records.
"""
from pathlib import Path
import sys, json, uuid, hashlib, concurrent.futures, threading, time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'supabase/review/baselines/tools'))
import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb

LOCAL = ROOT / 'supabase/review/baselines/isolated-postgres'
RESULTS = []
def ident(label): return str(uuid.uuid5(uuid.NAMESPACE_URL, 'phase5-synthetic:' + label))
ADMIN, TRAINER, OTHER, INACTIVE = map(ident, ['admin','trainer','other','inactive'])
STUDENT, STUDENT2, PROGRAM, BATCH, BATCH2 = map(ident, ['student','student2','program','batch','batch2'])
def connect(role=None, identity=None, autocommit=False):
    c = psycopg.connect(host='127.0.0.1',port=55432,dbname='phase5_disposable',user='postgres',
        password=(LOCAL/'test-secret.txt').read_text(),connect_timeout=5,autocommit=autocommit)
    assert c.execute('select current_database(),inet_server_addr()::text,inet_server_port()').fetchone() == ('phase5_disposable','127.0.0.1/32',55432)
    if role: c.execute(sql.SQL('set role {}').format(sql.Identifier(role)))
    c.execute("select set_config('request.jwt.claim.sub',%s,false)", (identity or '',))
    if not autocommit: c.commit()
    return c
def record(name, fn):
    try:
        fn(); RESULTS.append({'name':name,'status':'PASS'})
    except Exception as e:
        RESULTS.append({'name':name,'status':'FAIL','error':str(e),'sqlstate':getattr(e,'sqlstate',None)})
    print(RESULTS[-1]['status'], name, RESULTS[-1].get('error',''),flush=True)
    save()
def save():
    (LOCAL/'results.json').write_text(json.dumps({'server':'PostgreSQL 17.11, 127.0.0.1:55432/phase5_disposable','synthetic_only':True,'results':RESULTS},indent=2))
def check(v):
    assert v
def run(q,params=(),role='authenticated',identity=ADMIN):
    with connect(role,identity) as c:
        return c.execute(q,params if params else None).fetchall()
def reject(q,params=(),role='authenticated',identity=ADMIN,states=None):
    try: run(q,params,role,identity)
    except psycopg.Error as e:
        if states: assert e.sqlstate in states, (e.sqlstate,str(e))
        return
    raise AssertionError('Unexpected SQL success')
def rpc(name,args,c=None):
    q=sql.SQL('select public.{}({})').format(sql.Identifier(name),sql.SQL(',').join(sql.Placeholder() for _ in args))
    if c: return c.execute(q,args).fetchone()[0]
    with connect('authenticated',ADMIN) as db:
        value=db.execute(q,args).fetchone()[0]
        return str(value) if isinstance(value,uuid.UUID) else value

def bootstrap():
    s=json.loads((ROOT/'supabase/review/baselines/module_3_after_migration.json').read_text())
    with connect(autocommit=True) as c:
        assert not c.execute("select to_regclass('public.profiles')").fetchone()[0], 'Use a fresh disposable DB'
        c.execute("do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;end$$; revoke create on schema public from public; create schema auth; create table auth.users(id uuid primary key)")
        c.execute("create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role")
        for t in ['profiles','programs','batches','students']:
            cols=[]
            for col in s['columns']:
                if col['table_name']!=t: continue
                typ=col['data_type'] if col['data_type']!='ARRAY' else col['udt_name'][1:]+'[]'
                cols.append(sql.SQL('{} {} {} {}').format(sql.Identifier(col['column_name']),sql.SQL(typ),sql.SQL('not null' if col['is_nullable']=='NO' else ''),sql.SQL('default '+col['column_default'] if col['column_default'] else '')))
            c.execute(sql.SQL('create table public.{} ({})').format(sql.Identifier(t),sql.SQL(',').join(cols)))
        for fk in [False,True]:
            for k in s['constraints']:
                if k['definition'].startswith('FOREIGN KEY')!=fk: continue
                c.execute(sql.SQL('alter table public.{} add constraint {} {}').format(sql.Identifier(k['table_name']),sql.Identifier(k['conname']),sql.SQL(k['definition'])))
        for f in s['functions']: c.execute(f['definition'].replace('\\r','\r').replace('\\n','\n'))
        for t in ['profiles','programs','batches','students']:
            c.execute(sql.SQL('alter table public.{} enable row level security; grant select,insert,update,delete on public.{} to anon,authenticated; grant all on public.{} to service_role').format(*[sql.Identifier(t)]*3))
        for p in s['policies']:
            q=sql.SQL('create policy {} on public.{} as {} for {} to {}').format(sql.Identifier(p['policyname']),sql.Identifier(p['tablename']),sql.SQL(p['permissive']),sql.SQL(p['cmd']),sql.SQL(',').join(sql.Identifier(r) for r in p['roles']))
            if p['qual']: q+=sql.SQL(' using ({})').format(sql.SQL(p['qual']))
            if p['with_check']: q+=sql.SQL(' with check ({})').format(sql.SQL(p['with_check']))
            c.execute(q)
        c.execute('revoke all on function public.is_admin(),public.is_trainer() from public; grant execute on function public.is_admin(),public.is_trainer() to anon,authenticated,service_role; grant maintain on profiles,programs,batches,students to anon,authenticated')
        for n in ['trainer_dashboard_batches','trainer_student_roster']:
            c.execute(sql.SQL('revoke all on function public.{}() from public,anon; grant execute on function public.{}() to authenticated').format(sql.Identifier(n),sql.Identifier(n)))
        for who,role,active in [(ADMIN,'admin',True),(TRAINER,'trainer',True),(OTHER,'trainer',True),(INACTIVE,'trainer',False)]:
            c.execute('insert into auth.users values(%s)',(who,))
            c.execute('insert into public.profiles(id,full_name,role,is_active) values(%s,%s,%s,%s)',(who,'SYNTHETIC '+role,role,active))
        c.execute('insert into programs(id,name,monthly_fee,is_active) values(%s,%s,1000,true)',(PROGRAM,'SYNTHETIC program'))
        for b,t in [(BATCH,TRAINER),(BATCH2,OTHER)]: c.execute("insert into batches(id,name,program_id,trainer_id,is_active) values(%s,'SYNTHETIC batch',%s,%s,true)",(b,PROGRAM,t))
        for st,b in [(STUDENT,BATCH),(STUDENT2,BATCH2)]:
            c.execute("insert into students(id,student_code,full_name,program_id,batch_id,joining_date,status,mobile,guardian_mobile) values(%s,%s,'SYNTHETIC student',%s,%s,'2020-01-25','active','SYNTHETIC PRIVATE','SYNTHETIC PRIVATE')",(st,'SYN-'+st[:8],PROGRAM,b))
    (LOCAL/'existing-before.json').write_text(json.dumps(metadata(),default=str,sort_keys=True))
def metadata():
    with connect(autocommit=True) as c:
        return {'policies':c.execute("select tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename in ('profiles','programs','batches','students') order by tablename,policyname").fetchall(),
        'columns':c.execute("select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name in ('profiles','programs','batches','students') order by table_name,ordinal_position").fetchall(),
        'constraints':c.execute("select conrelid::regclass::text,conname,pg_get_constraintdef(oid) from pg_constraint where conrelid in ('profiles'::regclass,'programs'::regclass,'batches'::regclass,'students'::regclass) order by conname").fetchall(),
        'helpers':c.execute("select proname,pg_get_functiondef(oid),proacl::text,proconfig from pg_proc where pronamespace='public'::regnamespace and proname in ('is_admin','is_trainer','trainer_dashboard_batches','trainer_student_roster') order by proname").fetchall(),
        'grants':c.execute("select relname,relacl::text,relrowsecurity,relforcerowsecurity from pg_class where oid in ('profiles'::regclass,'programs'::regclass,'batches'::regclass,'students'::regclass) order by relname").fetchall()}
def apply():
    with connect(autocommit=True) as c:
        # Reproduce the supplied postgres/public default ACLs in this disposable DB.
        c.execute('alter default privileges in schema public grant all on tables to anon,authenticated,service_role; alter default privileges in schema public grant all on sequences to anon,authenticated,service_role; alter default privileges in schema public grant execute on functions to anon,authenticated,service_role')
        c.execute((ROOT/'supabase/review/phase_5_financial.proposed.sql').read_text())
def bill(label,month,base=100000,discount=0,reason=None,student=STUDENT,source='program',ref=None):
    return rpc('fee_create_bill',[ident(label),student,month,source,PROGRAM if source=='program' else None,base,discount,reason,ref,None,True])
def payment(label,bills,amounts,student=STUDENT,method='cash',ref=None):
    import datetime
    return rpc('fee_record_payment',[ident(label),student,sum(amounts),method,datetime.date.today(),ref,None,Jsonb([{'bill_id':b,'amount_paise':a} for b,a in zip(bills,amounts)]),True])
def balance(b): return run('select due_paise,paid_paise,outstanding_paise,payment_status,overdue,ledger_version from fee_bill_balances() where id=%s',(b,))[0]
def reverse(label,p,kind='entry_correction',ref=None,verified=False): return rpc('fee_reverse_payment',[ident(label),p,kind,'Synthetic verified correction',ref,verified,True])

if __name__=='__main__':
    record('synthetic baseline setup',bootstrap)
    if RESULTS[-1]['status']=='FAIL': sys.exit(1)
    record('complete guarded migration applies',apply)
    if RESULTS[-1]['status']=='FAIL': sys.exit(1)
    record('existing columns/policies/helpers/constraints/grants unchanged',lambda:check(json.loads((LOCAL/'existing-before.json').read_text())==json.loads(json.dumps(metadata(),default=str))))
    record('five RLS-enabled tables and fourteen checked functions',lambda:check(run("select count(*) from pg_class where relnamespace='public'::regnamespace and relname like 'fee_%' and relkind='r' and relrowsecurity",role=None)==[(5,)] and run("select count(*) from pg_proc where pronamespace='public'::regnamespace and proname like 'fee_%'",role=None)==[(14,)]))
    # Stop the first bill failure early: dependent transaction tests need valid bills.
    record('normal monthly bill and exact 10th due date',lambda:check(bill('jan','2026-01-01')==ident('jan') and run('select due_on::text from fee_bills where id=%s',(ident('jan'),))==[('2026-01-10',)]))
    if RESULTS[-1]['status']=='FAIL': sys.exit(1)
    def partial():
        payment('partial',[ident('jan')],[40000]);check(balance(ident('jan'))[:4]==(100000,40000,60000,'partially_paid'))
        payment('full',[ident('jan')],[60000]);check(balance(ident('jan'))[:4]==(100000,100000,0,'paid'))
    record('partial then complete settlement',partial)
    record('overcollection rejected',lambda:reject('select fee_record_payment(%s,%s,1,\'cash\',current_date,null,null,%s,true)',(ident('excess'),STUDENT,Jsonb([{'bill_id':ident('jan'),'amount_paise':1}]))))
    record('idempotent payment retry preserves receipt',lambda:check(payment('partial',[ident('jan')],[40000])==ident('partial') and run('select count(*) from fee_payments where id=%s',(ident('partial'),))==[(1,)]))
    record('mismatched payment request rejected',lambda:reject('select fee_record_payment(%s,%s,2,\'cash\',current_date,null,null,%s,true)',(ident('partial'),STUDENT,Jsonb([{'bill_id':ident('jan'),'amount_paise':2}]))))
    record('duplicate student-month rejected',lambda:reject('select fee_create_bill(%s,%s,\'2026-01-01\',\'program\',%s,100000,0,null,null,null,true)',(ident('duplicate-month'),STUDENT,PROGRAM),states=['23505']))
    def advances():
        a=bill('advance1','2030-01-01');b=bill('advance2','2030-02-01');payment('advance',[a,b],[30000,20000]);check(balance(a)[1]==30000 and balance(b)[1]==20000)
    record('explicit future multi-month advance allocation',advances)
    def concessions():
        b=ident('advance1');v=balance(b)[-1];rpc('fee_set_concession',[ident('discount'),b,v,10000,'Synthetic concession',True]);check(balance(b)[:3]==(90000,30000,60000))
        rpc('fee_set_concession',[ident('discount'),b,v,10000,'Synthetic concession',True])
        reject('select fee_set_concession(%s,%s,%s,80000,\'Below paid\',true)',(ident('bad-discount'),b,balance(b)[-1]))
        reject('select fee_set_concession(%s,%s,%s,20000,\'Stale preview\',true)',(ident('stale'),b,v))
    record('reasoned concession, replay, paid floor and stale preview',concessions)
    def zero():
        b=bill('zero','2026-02-01',100000,100000,'Synthetic full concession');check(balance(b)[:4]==(0,0,0,'paid'));check(run('select count(*) from fee_allocations where bill_id=%s',(b,))==[(0,)])
    record('zero bill paid without payment/receipt',zero)
    def reversals():
        reverse('reverse-partial',ident('partial'));check(balance(ident('jan'))[:4]==(100000,60000,40000,'partially_paid'));reverse('reverse-partial',ident('partial'))
        check(run('select count(*) from fee_payments where id=%s and reversed_at is not null',(ident('partial'),))==[(1,)])
        reject('select fee_reverse_payment(%s,%s,\'verified_refund\',\'Synthetic refund\',null,false,true)',(ident('bad-refund'),ident('full')))
        reverse('refund-full',ident('full'),'verified_refund','SYNTHETIC-REFUND',True);check(balance(ident('jan'))[1]==0)
    record('audited reversals/refund checks preserve original receipts',reversals)
    def references():
        b=bill('ref-bill','2026-03-01');payment('upi1',[b],[10000],method='upi',ref='SYN-REF')
        reject('select fee_record_payment(%s,%s,10000,\'upi\',current_date,\' syn-ref \',null,%s,true)',(ident('upi-duplicate'),STUDENT,Jsonb([{'bill_id':b,'amount_paise':10000}])),states=['23505'])
        reverse('reverse-upi',ident('upi1'));payment('upi-replacement',[b],[10000],method='upi',ref='SYN-REF')
    record('normalized duplicate reference and explicit reversed replacement',references)
    def atomic():
        before=run('select (select count(*) from fee_payments),(select count(*) from fee_allocations),(select count(*) from fee_events)')[0]
        reject('select fee_record_payment(%s,%s,20000,\'cash\',current_date,null,null,%s,true)',(ident('atomic-bad'),STUDENT,Jsonb([{'bill_id':ident('ref-bill'),'amount_paise':10000},{'bill_id':ident('missing'),'amount_paise':10000}])))
        check(before==run('select (select count(*) from fee_payments),(select count(*) from fee_allocations),(select count(*) from fee_events)')[0])
        with connect('authenticated',ADMIN) as c:
            rpc('fee_record_payment',[ident('rolled-back'),STUDENT,10000,'cash','2026-01-01',None,None,Jsonb([{'bill_id':ident('ref-bill'),'amount_paise':10000}]),True],c);c.rollback()
        check(run('select count(*) from fee_payments where id=%s',(ident('rolled-back'),))==[(0,)])
    record('invalid multi-allocation and explicit transaction rollback are atomic',atomic)
    def invalid():
        for value in ['1.5','NaN','Infinity','-1','100000000000']:
            reject('select fee_create_bill(%s,%s,\'2031-01-01\',\'program\',%s,%s::numeric,0,null,null,null,true)',(str(uuid.uuid4()),STUDENT,PROGRAM,value))
    record('fractional/nonfinite/negative/out-of-range paise rejected',invalid)
    record('explicit historical opening bill',lambda:check(bill('opening','2019-01-01',45000,source='opening',ref='SYNTHETIC OPENING')==ident('opening')))
    def immutable():
        with connect('authenticated',ADMIN) as c:c.execute('update programs set monthly_fee=1200 where id=%s',(PROGRAM,))
        check(balance(ident('jan'))[0]==100000)
        reject('select fee_create_bill(%s,%s,\'2032-01-01\',\'program\',%s,100000,0,null,null,null,true)',(ident('old-rate'),STUDENT,PROGRAM))
        with connect('authenticated',ADMIN) as c:c.execute('update programs set monthly_fee=1000 where id=%s',(PROGRAM,))
    record('program fee changes preserve generated bills and reject stale previews',immutable)
    for who,label in [(None,'anonymous'),(TRAINER,'active trainer'),(OTHER,'other trainer'),(INACTIVE,'inactive trainer')]:
        def denied(who=who):
            role='anon' if who is None else 'authenticated'
            for t in ['fee_bills','fee_payments','fee_allocations','fee_reversals','fee_events']:
                if role=='anon':reject('select * from '+t,role=role,identity=who,states=['42501'])
                else:check(run('select count(*) from '+t,role=role,identity=who)==[(0,)])
            reject('select * from fee_bill_balances()',role=role,identity=who)
            reject('select fee_create_bill(%s,%s,\'2033-01-01\',\'program\',%s,100000,0,null,null,null,true)',(str(uuid.uuid4()),STUDENT,PROGRAM),role=role,identity=who)
            reject("select nextval('fee_receipt_seq')",role=role,identity=who,states=['42501'])
            reject('select fee_require_admin()',role=role,identity=who,states=['42501'])
        record(label+' financial tables/RPC/sequence isolation',denied)
    record('admin cannot write financial tables directly',lambda:reject('delete from fee_payments',states=['42501']))
    def trainer_rules():
        check(run('select id from batches',identity=TRAINER)==[(uuid.UUID(BATCH),)])
        check(run('select count(*) from students',identity=TRAINER)==[(0,)])
        rows=run('select * from trainer_student_roster()',identity=TRAINER);check(len(rows)==1 and len(rows[0])==6 and str(rows[0][0])==STUDENT)
        check(run('select count(*) from trainer_dashboard_batches()',identity=INACTIVE)==[(0,)])
    record('existing trainer assignment, inactive restriction and private student isolation',trainer_rules)
    def race(level,label):
        b=bill(label,'2034-01-01' if level=='READ COMMITTED' else '2034-02-01');barrier=threading.Barrier(2)
        def worker(i):
            try:
                with connect('authenticated',ADMIN) as c:
                    c.execute('set transaction isolation level '+level)
                    c.execute('select count(*) from fee_bills').fetchone();barrier.wait(timeout=10)
                    rpc('fee_record_payment',[ident(label+str(i)),STUDENT,70000,'cash','2026-01-01',None,None,Jsonb([{'bill_id':b,'amount_paise':70000}]),True],c)
                return 'committed'
            except psycopg.Error as e:return e.sqlstate
        with concurrent.futures.ThreadPoolExecutor(2) as pool:out=list(pool.map(worker,[1,2]))
        check(out.count('committed')==1 and balance(b)[1]==70000)
        (LOCAL/(label+'.json')).write_text(json.dumps(out))
    record('concurrent READ COMMITTED overcollection protection',lambda:race('READ COMMITTED','race-rc'))
    record('concurrent REPEATABLE READ stale snapshot protection',lambda:race('REPEATABLE READ','race-rr'))
    def receipts():check(run('select count(*)=count(distinct receipt_number),bool_and(receipt_number ~ \'^AYR-[0-9]{4}-[0-9]+$\') from fee_payments')==[(True,True)])
    record('receipt uniqueness and numbering',receipts)
    def schema_assertions():
        with connect(autocommit=True) as c:
            check(c.execute("select count(*) from pg_policies where schemaname='public' and tablename like 'fee_%' and cmd='SELECT' and roles='{authenticated}'").fetchone()[0]==5)
            check(c.execute("select count(*) from pg_trigger where tgrelid in (select oid from pg_class where relnamespace='public'::regnamespace and relname like 'fee_%') and not tgisinternal and tgdeferrable and tginitdeferred").fetchone()[0]==4)
            check(c.execute("select count(*) from pg_constraint where conrelid in (select oid from pg_class where relnamespace='public'::regnamespace and relname like 'fee_%') and not convalidated").fetchone()[0]==0)
            check(c.execute("select count(*) from pg_index where indrelid in (select oid from pg_class where relnamespace='public'::regnamespace and relname like 'fee_%') and (not indisvalid or not indisready)").fetchone()[0]==0)
            check(c.execute("select count(*) from pg_proc where pronamespace='public'::regnamespace and proname like 'fee_%' and has_function_privilege('authenticated',oid,'EXECUTE')").fetchone()[0]==6)
            check(c.execute("select count(*) from pg_proc where pronamespace='public'::regnamespace and proname like 'fee_%' and not ('search_path=\"\"'=any(proconfig))").fetchone()[0]==0)
    record('constraints/index validity, deferred triggers, RLS and exact function grants',schema_assertions)
    def dates():
        # Clock replacement is transaction-local test DDL, always rolled back.
        # It is not part of the migration and never runs outside the pinned DB.
        with connect(identity=ADMIN) as c:
            c.execute("create or replace function public.fee_today() returns date language sql stable set search_path='' as $$select date '2028-01-08'$$")
            c.execute('set local role authenticated')
            b=rpc('fee_create_bill',[ident('date-bill'),STUDENT2,'2028-01-01','program',PROGRAM,100000,0,None,None,None,True],c)
            for day,overdue,grace in [(8,False,False),(10,False,False),(11,False,True),(15,False,True),(16,True,False)]:
                c.execute('reset role')
                c.execute(sql.SQL("create or replace function public.fee_today() returns date language sql stable set search_path='' as $$select date {}$$").format(sql.Literal('2028-01-'+str(day).zfill(2))))
                c.execute('set local role authenticated')
                check(c.execute('select overdue,grace from fee_bill_balances() where id=%s',(b,)).fetchone()==(overdue,grace))
                if day in (8,11,16):
                    kind={8:'upcoming',11:'grace',16:'overdue'}[day]
                    e=rpc('fee_prepare_reminder',[ident('reminder'+kind),b,kind,None],c)
                    check(e==rpc('fee_prepare_reminder',[ident('reminder'+kind),b,kind,None],c))
            p=rpc('fee_record_payment',[ident('date-pay'),STUDENT2,100000,'cash','2028-01-16',None,None,Jsonb([{'bill_id':str(b),'amount_paise':100000}]),True],c)
            check(c.execute('select overdue,payment_status from fee_bill_balances() where id=%s',(b,)).fetchone()==(False,'paid'))
            rpc('fee_prepare_reminder',[ident('confirmation'),b,'payment_confirmation',p],c)
            check(c.execute("select bool_and(details->>'delivery'='not_sent') from fee_events where action='reminder_prepared'").fetchone()[0])
            # Leap-year period and full fee, independent of month length.
            feb=rpc('fee_create_bill',[ident('leap-bill'),STUDENT2,'2028-02-01','program',PROGRAM,100000,0,None,None,None,True],c)
            check(c.execute('select due_on::text,due_paise from fee_bills where id=%s',(feb,)).fetchone()==('2028-02-10',100000))
            c.rollback()
    record('10/11/15/16 boundaries, leap month, reminder dates and no sending',dates)
    def rpc_denials():
        args=[('fee_create_bill',[ident('deny-b'),STUDENT,'2040-01-01','program',PROGRAM,100000,0,None,None,None,True]),
          ('fee_set_concession',[ident('deny-c'),ident('jan'),0,1,'Synthetic reason',True]),
          ('fee_record_payment',[ident('deny-p'),STUDENT,1,'cash','2026-01-01',None,None,Jsonb([{'bill_id':ident('jan'),'amount_paise':1}]),True]),
          ('fee_reverse_payment',[ident('deny-r'),ident('full'),'entry_correction','Synthetic reason',None,False,True]),
          ('fee_prepare_reminder',[ident('deny-m'),ident('jan'),'overdue',None])]
        for who,role in [(None,'anon'),(TRAINER,'authenticated'),(INACTIVE,'authenticated')]:
            for name,a in args:
                q='select '+name+'('+','.join(['%s']*len(a))+')'
                reject(q,a,role,who)
        reject("select fee_bill_balances()",identity=None)
    record('all five write RPCs reject anonymous/active/inactive trainer identities',rpc_denials)
    def owner_guards():
        # Deliberate malformed SQL only as the disposable owner to exercise
        # defense-in-depth triggers/constraints rather than API grant failures.
        def must_fail(action,state):
            try:
                with connect(identity=ADMIN) as c:
                    c.execute('select fee_begin(%s)',(str(uuid.uuid4()),));action(c)
            except psycopg.Error as e:
                check(e.sqlstate==state);return
            raise AssertionError('Malformed financial write committed')
        must_fail(lambda c:c.execute("insert into fee_payments(id,student_id,amount_paise,method,received_on,receipt_number,student_code_snapshot,student_name_snapshot,request_payload,created_by) values(%s,%s,123,'cash',current_date,'SYNTHETIC-INVALID','SYN','SYN','{}',%s)",(ident('unallocated'),STUDENT,ADMIN)),'P0001')
        must_fail(lambda c:c.execute('delete from fee_payments where id=%s',(ident('partial'),)),'P0001')
        must_fail(lambda c:c.execute('update fee_payments set amount_paise=5 where id=%s',(ident('partial'),)),'P0001')
        must_fail(lambda c:c.execute("update fee_events set details='{}' where id=(select min(id) from fee_events)"),'P0001')
        must_fail(lambda c:c.execute('delete from students where id=%s',(STUDENT,)),'23503')
        must_fail(lambda c:c.execute('delete from programs where id=%s',(PROGRAM,)),'23503')
        must_fail(lambda c:c.execute('insert into fee_allocations(payment_id,bill_id,student_id,amount_paise) values(%s,%s,%s,1)',(ident('full'),ident('advance1'),STUDENT2)),'23503')
    record('deferred unallocated-payment rejection, immutable history, FK and append-only audit',owner_guards)
    def concurrent_retry():
        b=bill('retry-bill','2036-01-01');barrier=threading.Barrier(2)
        def worker(_):
            with connect('authenticated',ADMIN) as c:
                barrier.wait(timeout=10)
                return str(rpc('fee_record_payment',[ident('retry-race'),STUDENT,40000,'cash','2026-01-01',None,None,Jsonb([{'bill_id':b,'amount_paise':40000}]),True],c))
        with concurrent.futures.ThreadPoolExecutor(2) as pool: values=list(pool.map(worker,[1,2]))
        check(values==[ident('retry-race')]*2 and balance(b)[1]==40000)
    record('simultaneous same-request retries create one payment',concurrent_retry)
    def existing_crud():
        with connect('authenticated',ADMIN) as c:
            st=ident('crud-student');pr=ident('crud-program');ba=ident('crud-batch');tr=ident('crud-trainer')
            # Auth stub row is owner-only; profile creation is a separate fixture,
            # not an onboarding operation or an Auth integration test.
            c.execute('reset role');c.execute('insert into auth.users values(%s)',(tr,));c.execute('set local role authenticated')
            c.execute("insert into profiles(id,full_name,role) values(%s,'SYN CRUD','trainer')",(tr,));c.execute("update profiles set phone='SYN' where id=%s",(tr,))
            c.execute("insert into programs(id,name,monthly_fee) values(%s,'SYN CRUD',1000)",(pr,));c.execute("update programs set monthly_fee=1100 where id=%s",(pr,))
            c.execute("insert into batches(id,name,program_id,trainer_id) values(%s,'SYN CRUD',%s,%s)",(ba,pr,tr));c.execute("update batches set name='SYN EDIT' where id=%s",(ba,))
            c.execute("insert into students(id,student_code,full_name,program_id,batch_id) values(%s,'SYN-CRUD','SYN CRUD',%s,%s)",(st,pr,ba));c.execute("update students set full_name='SYN EDIT' where id=%s",(st,))
            for table,key in [('students',st),('batches',ba),('programs',pr),('profiles',tr)]:
                check(c.execute('select count(*) from '+table+' where id=%s',(key,)).fetchone()[0]==1)
                c.execute('delete from '+table+' where id=%s',(key,))
            c.rollback()
    record('existing admin four-table CRUD on rolled-back synthetic fixtures',existing_crud)
    def verification():
        with connect(autocommit=True) as c:
            cur=c.execute((ROOT/'supabase/review/phase_5_verify_readonly.sql').read_text());sets=[]
            while True:
                if cur.description:
                    rows=cur.fetchall();sets.append({'columns':[x.name for x in cur.description],'rows':rows})
                    if [x.name for x in cur.description]==['check_name','violations']:check(all(r[1]==0 for r in rows))
                if not cur.nextset():break
            (LOCAL/'verification.json').write_text(json.dumps(sets,default=str,indent=2))
    record('prepared read-only verification and all financial violation counts zero',verification)
    def recovery():
        before=run('select count(*) from fee_payments')
        with connect(autocommit=True) as c:c.execute((ROOT/'supabase/review/phase_5_disable_writes.recovery.proposed.sql').read_text())
        check(run('select count(*) from fee_payments')==before)
        reject('select fee_create_bill(%s,%s,\'2035-01-01\',\'program\',%s,100000,0,null,null,null,true)',(ident('quarantine'),STUDENT,PROGRAM),states=['42501'])
        run('select * from fee_bill_balances()')
    record('recovery quarantine blocks writes and preserves admin reads/history',recovery)
    def rerun_guard():
        try:
            with connect(autocommit=True) as c:c.execute((ROOT/'supabase/review/phase_5_financial.proposed.sql').read_text())
        except psycopg.Error as e:
            check(e.sqlstate=='P0001' and 'already exist' in str(e));return
        raise AssertionError('Rerun guard did not reject')
    record('one-time migration guard rejects reapplication without mutation',rerun_guard)
    def timezone():
        with connect(autocommit=True) as c:
            check('Asia/Kolkata' in c.execute("select pg_get_functiondef('fee_today()'::regprocedure)").fetchone()[0])
            for tz in ['UTC','Pacific/Honolulu','Asia/Kolkata']:
                c.execute("select set_config('TimeZone',%s,false)",(tz,))
                check(c.execute("select fee_today()=(current_timestamp at time zone 'Asia/Kolkata')::date").fetchone()[0])
    record('India billing date remains independent of session timezone',timezone)
    save()
    print('RESULTS',sum(r['status']=='PASS' for r in RESULTS),'passed,',sum(r['status']=='FAIL' for r in RESULTS),'failed')
