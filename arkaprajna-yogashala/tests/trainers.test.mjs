import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

function load(file, deps = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, process: { env: { NODE_ENV: "test" } }, require(name) {
    if (name === "server-only") return {};
    if (!(name in deps)) throw new Error(`Unexpected import ${name}`);
    return deps[name];
  } });
  return exports;
}
const management = load("src/lib/admin/management.ts");
const model = load("src/lib/admin/trainers.ts", { "./management": management });
const trainerId = "11111111-1111-4111-8111-111111111111";
const batchId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
const trainer = { id: trainerId, full_name: "Test teacher", phone: null, role: "trainer", specialization: null, qualifications: null, biography: null, years_of_experience: 0, is_active: true };
const hash = record => createHash("sha256").update(JSON.stringify(record)).digest("hex");
function form(values = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ id: trainerId, version: hash(trainer), full_name: "Test teacher", years_of_experience: "0", is_active: "true", ...values })) data.set(key, value);
  return data;
}
function harness({ unauthorized = false, current = trainer, patchRows = true, denied = false } = {}) {
  let authorized = false;
  const requests = [];
  const db = createClient("https://fixture.supabase.co", "sb_publishable_test_fixture", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, options) => {
      assert.equal(authorized, true);
      const url = new URL(input), table = url.pathname.split("/").at(-1);
      const request = { table, method: options.method, query: url.searchParams, body: options.body ? JSON.parse(options.body) : null };
      requests.push(request);
      const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" } });
      if (denied) return reply({ code: "42501", message: "DO_NOT_EXPOSE" }, 403);
      if (request.method === "HEAD") return new Response(null, { status: 200, headers: { "Content-Range": "*/1" } });
      if (request.method === "PATCH") return reply(patchRows ? [{ id: table === "profiles" ? trainerId : batchId }] : []);
      if (table === "profiles") return reply(current ? [current] : []);
      if (table === "batches") return reply([{ id: batchId, name: "Morning", trainer_id: trainerId, is_active: true, start_time: null, end_time: null, days_of_week: null }]);
      throw new Error("Unexpected test request");
    } },
  });
  const auth = { requireAdmin: async () => { if (unauthorized) throw new Error("ADMIN_REQUIRED"); authorized = true; } };
  const dataErrors = { databaseError: error => error?.code === "42501" ? "Permission denied" : "Database failure" };
  const data = load("src/lib/admin/trainer-data.ts", {
    "node:crypto": { createHash }, "@/lib/supabase/admin": auth,
    "@/lib/supabase/server": { createClient: async () => db }, "./data": dataErrors, "./management": management,
  });
  const actions = load("src/app/admin/(protected)/trainer-actions.ts", {
    "next/cache": { revalidatePath() {} }, "next/navigation": { redirect(path) { throw new Error(`REDIRECT:${path}`); } },
    "@/lib/supabase/admin": auth, "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/admin/data": dataErrors, "@/lib/admin/trainer-data": data,
    "@/lib/admin/trainers": model, "@/lib/admin/management": management,
  });
  return { ...actions, ...data, requests };
}
const filters = { q: "", status: "all", page: 1, program: "" };

test("trainer validation handles optional fields, zero experience, bad status and malicious role input", () => {
  const good = model.validateTrainer(form({ role: "admin", biography: "  Namaste  " }));
  assert.equal(Object.keys(good.fieldErrors).length, 0);
  assert.equal(good.values.years_of_experience, 0);
  assert.equal(good.values.biography, "Namaste");
  assert.equal("role" in good.values, false);
  for (const value of ["-1", "1.5", "101", "1e2", "NaN"]) assert.ok(model.validateTrainer(form({ years_of_experience: value })).fieldErrors.years_of_experience);
  assert.ok(model.validateTrainer(form({ is_active: "yes", full_name: " ", phone: "<script>" })).fieldErrors.phone);
  assert.equal(model.validateTrainer(form({ years_of_experience: "" })).values.years_of_experience, null);
});
test("all trainer reads and mutations authorize before database access", async () => {
  const h = harness({ unauthorized: true });
  for (const run of [() => h.loadTrainers(filters), () => h.loadTrainer(trainerId), () => h.saveTrainer({}, form()), () => h.changeTrainerAssignment({}, form())]) await assert.rejects(run(), /ADMIN_REQUIRED/);
  assert.equal(h.requests.length, 0);
});
test("invalid trainer input never reaches the database and admin profiles cannot be edited", async () => {
  const h = harness();
  assert.ok((await h.saveTrainer({}, form({ full_name: "" }))).fieldErrors.full_name);
  assert.equal(h.requests.length, 0);
  const absent = harness({ current: null });
  assert.ok((await absent.saveTrainer({}, form())).error);
  assert.equal(absent.requests[0].query.get("role"), "eq.trainer");
  assert.equal(absent.requests.some(r => r.method === "PATCH"), false);
});
test("profile update allowlist and original NULL guards prevent tampering and stale saves", async () => {
  const h = harness();
  await assert.rejects(h.saveTrainer({}, form({ role: "admin", photo_path: "untrusted", full_name: "Updated" })), /notice=updated/);
  const patch = h.requests.find(r => r.method === "PATCH");
  assert.equal(patch.query.get("role"), "eq.trainer");
  assert.equal(patch.query.get("phone"), "is.null");
  assert.equal(patch.query.get("full_name"), "eq.Test teacher");
  assert.equal(patch.body.full_name, "Updated");
  assert.equal("role" in patch.body, false);
  assert.equal("id" in patch.body, false);
  assert.equal("photo_path" in patch.body, false);
  const stale = harness();
  assert.ok((await stale.saveTrainer({}, form({ version: "a".repeat(64) }))).error);
  assert.equal(stale.requests.some(r => r.method === "PATCH"), false);
  assert.ok((await harness({ patchRows: false }).saveTrainer({}, form())).error);
});
test("deactivation requires confirmation and never deletes users or changes assignments", async () => {
  const h = harness();
  assert.ok((await h.saveTrainer({}, form({ is_active: "false" }))).fieldErrors.confirm_deactivation);
  assert.equal(h.requests.some(r => r.method === "PATCH"), false);
  await assert.rejects(h.saveTrainer({}, form({ is_active: "false", confirm_deactivation: "on" })), /notice=updated/);
  assert.equal(h.requests.some(r => r.table !== "profiles" || r.method === "DELETE"), false);
});
const assignment = (values = {}) => form({ trainer_id: trainerId, batch_id: batchId, expected_trainer_id: "", intent: "assign", ...values });
test("inactive trainers cannot receive new assignments but can be unassigned", async () => {
  const h = harness({ current: { ...trainer, is_active: false } });
  assert.match((await h.changeTrainerAssignment({}, assignment())).error, /Activate/);
  assert.equal(h.requests.some(r => r.method === "PATCH"), false);
  await assert.rejects(h.changeTrainerAssignment({}, assignment({ intent: "unassign", expected_trainer_id: trainerId })), /notice=assignment/);
  const patch = h.requests.find(r => r.method === "PATCH");
  assert.equal(patch.query.get("trainer_id"), `eq.${trainerId}`);
  assert.equal(JSON.stringify(patch.body), '{"trainer_id":null}');
});
test("reassignment needs confirmation and conditionally updates only the expected batch assignment", async () => {
  const h = harness();
  assert.match((await h.changeTrainerAssignment({}, assignment({ expected_trainer_id: otherId }))).error, /Confirm reassignment/);
  assert.equal(h.requests.some(r => r.method === "PATCH"), false);
  await assert.rejects(h.changeTrainerAssignment({}, assignment({ expected_trainer_id: otherId, confirm_reassignment: "on" })), /notice=assignment/);
  const patch = h.requests.find(r => r.method === "PATCH");
  assert.equal(patch.query.get("id"), `eq.${batchId}`);
  assert.equal(patch.query.get("trainer_id"), `eq.${otherId}`);
  assert.equal(JSON.stringify(patch.body), JSON.stringify({ trainer_id: trainerId }));
  assert.ok((await harness({ patchRows: false }).changeTrainerAssignment({}, assignment())).error);
});
test("list filters are scoped to trainers and assignment queries are scoped to the page's trainers", async () => {
  const h = harness();
  const result = await h.loadTrainers({ ...filters, q: "_%", status: "inactive" });
  assert.equal(result.error, "");
  const list = h.requests.find(r => r.method === "GET" && r.table === "profiles");
  assert.equal(list.query.get("role"), "eq.trainer");
  assert.equal(list.query.get("is_active"), "eq.false");
  assert.equal(list.query.get("full_name"), "ilike.%\\_\\%%");
  const batches = h.requests.find(r => r.table === "batches");
  assert.equal(batches.query.get("trainer_id"), `in.(${trainerId})`);
});
test("permission failures do not report success or expose raw provider messages", async () => {
  const h = harness({ denied: true });
  assert.equal((await h.saveTrainer({}, form())).error, "Permission denied");
  assert.equal((await h.loadTrainers(filters)).data, null);
});
