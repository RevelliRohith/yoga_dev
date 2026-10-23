import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, deps) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, URLSearchParams, process: { env: { NODE_ENV: "test" } }, require(name) {
    if (name === "server-only") return {};
    if (!(name in deps)) throw new Error(`Unexpected dependency ${name}`);
    return deps[name];
  } });
  return exports;
}
const management = load("src/lib/admin/management.ts", {});
const id = "11111111-1111-4111-8111-111111111111", batchId = "22222222-2222-4222-8222-222222222222";
const profile = { id, full_name: "Test Teacher", role: "trainer", is_active: true };
function accessHarness({ role = "trainer", active = true, authenticated = true, profileError = false } = {}) {
  const calls = [];
  const db = { auth: { async getUser() { return { data: { user: authenticated ? { id } : null }, error: null }; } }, from(table) {
    calls.push({ table });
    return { select(fields) { calls.push({ fields }); return this; }, eq(key, value) { calls.push({ key, value }); return this; }, async maybeSingle() { return { data: { ...profile, role, is_active: active }, error: profileError ? {} : null }; } };
  } };
  const access = load("src/lib/supabase/trainer.ts", { "next/navigation": { redirect(path) { throw new Error(`REDIRECT:${path}`); } }, "./server": { async createClient() { return db; } } });
  return { ...access, calls, db };
}
test("trainer authorization requires verified identity, current role and active profile", async () => {
  assert.equal((await accessHarness({ authenticated: false }).getTrainer()).status, "anonymous");
  assert.equal((await accessHarness({ active: false }).getTrainer()).status, "inactive");
  assert.equal((await accessHarness({ role: "student" }).getTrainer()).status, "forbidden");
  assert.equal((await accessHarness({ profileError: true }).getTrainer()).status, "unavailable");
  await assert.rejects(accessHarness({ role: "admin" }).requireTrainer(), /REDIRECT:\/admin/);
  await assert.rejects(accessHarness({ active: false }).requireTrainer(), /reason=inactive/);
  const good = accessHarness();
  assert.equal((await good.requireTrainer()).profile.id, id);
  assert.ok(good.calls.some(c => c.key === "id" && c.value === id));
});
const batch = { id: batchId, name: "Morning", program_id: null, program_name: null, start_time: "06:00:00", end_time: "07:00:00", days_of_week: ["Monday"], is_active: true };
const student = { id, student_code: "TEST", full_name: "Fixture Student", program_id: null, batch_id: batchId, status: "active" };
function dashboardHarness({ denied = false, privateField = false, wrongBatch = false, missingCount = false } = {}) {
  const calls = [];
  const db = { rpc(name, args, options) {
    calls.push({ name, args, options });
    return { select(fields) { calls.push({ fields }); return this; }, order() { return this; }, async range() {
      const data = name === "trainer_dashboard_batches" ? [batch] : [{ ...student, ...(privateField ? { guardian_mobile: "MUST_NOT_LEAK" } : {}), ...(wrongBatch ? { batch_id: id } : {}) }];
      return { data, count: missingCount ? null : 1, error: null };
    } };
  } };
  const data = load("src/lib/trainer/dashboard.ts", { "@/lib/admin/management": management, "@/lib/supabase/trainer": { async requireTrainer() { if (denied) throw new Error("TRAINER_REQUIRED"); return { db, profile }; } } });
  return { ...data, calls };
}
test("dashboard uses only the two no-argument RPCs and exactly the six approved roster fields", async () => {
  const h = dashboardHarness();
  const result = await h.loadTrainerDashboard();
  assert.equal(result.error, "");
  assert.equal(result.data.students.length, 1);
  assert.ok(h.calls.some(c => c.fields === "id,student_code,full_name,program_id,batch_id,status"));
  assert.deepEqual(h.calls.filter(c => c.name).map(c => c.name).sort(), ["trainer_dashboard_batches", "trainer_student_roster"]);
  assert.ok(h.calls.filter(c => c.name).every(c => Object.keys(c.args).length === 0));
});
test("dashboard denies before RPC calls and fails closed on private columns, unmatched batches or unavailable totals", async () => {
  const denied = dashboardHarness({ denied: true });
  await assert.rejects(denied.loadTrainerDashboard(), /TRAINER_REQUIRED/);
  assert.equal(denied.calls.length, 0);
  for (const options of [{ privateField: true }, { wrongBatch: true }, { missingCount: true }]) {
    const result = await dashboardHarness(options).loadTrainerDashboard();
    assert.equal(result.data, null);
    assert.ok(result.error);
    assert.equal(JSON.stringify(result).includes("MUST_NOT_LEAK"), false);
  }
});
test("trainer login checks active role after password auth and cleans denied sessions", async () => {
  for (const status of ["trainer", "admin", "inactive", "forbidden"]) {
    let cleaned = false;
    const db = { auth: { async signInWithPassword(input) { assert.equal(input.password, " fixture password "); return { error: null }; }, async signOut() { cleaned = true; return { error: null }; } } };
    const actions = load("src/app/trainer/actions.ts", {
      "next/navigation": { redirect(path) { throw new Error(`REDIRECT:${path}`); } }, "next/cache": { revalidatePath() {} },
      "@/lib/supabase/server": { async createClient() { return db; } }, "@/lib/supabase/trainer": { async getTrainer() { return { status }; } }, "@/lib/supabase/auth-errors": { authFailure() { return "Failed"; } },
    });
    const form = new FormData(); form.set("email", "teacher@example.test"); form.set("password", " fixture password ");
    if (status === "trainer" || status === "admin") await assert.rejects(actions.trainerLogin({}, form), new RegExp(`REDIRECT:/${status === "admin" ? "admin" : "trainer"}`));
    else { assert.ok((await actions.trainerLogin({}, form)).error); assert.equal(cleaned, true); }
  }
});
