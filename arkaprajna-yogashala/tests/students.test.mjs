import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

function load(file, deps) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, Response, URL, URLSearchParams, process: { env: { NODE_ENV: "test" } }, require(name) {
    if (name === "server-only") return {};
    if (!(name in deps)) throw new Error(`Unexpected dependency ${name}`);
    return deps[name];
  } });
  return exports;
}
const management = load("src/lib/admin/management.ts", {});
const model = load("src/lib/admin/students.ts", { "./management": management });
const id = "11111111-1111-4111-8111-111111111111", programId = "22222222-2222-4222-8222-222222222222", batchId = "33333333-3333-4333-8333-333333333333";
const current = { id, student_code: "TEST-001", full_name: "Fixture Student", date_of_birth: null, gender: null, mobile: null, email: null, guardian_name: null, guardian_mobile: null, address: null, program_id: programId, batch_id: batchId, joining_date: "2026-10-01", status: "active", created_at: "2026-10-01T00:00:00Z" };
const version = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function form(values = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ id, mode: "create", full_name: "Fixture Student", program_id: programId, batch_id: batchId, joining_date: "2026-10-01", status: "active", ...values })) data.set(key, value);
  return data;
}
function harness({ unauthorized = false, activeProgram = true, activeBatch = true, wrongProgram = false, patchRows = true, denied = false } = {}) {
  const requests = [], saved = new Map();
  let authorized = false;
  const db = createClient("https://fixture.supabase.co", "sb_publishable_fixture", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, options) => {
    assert.equal(authorized, true);
    const url = new URL(input), table = url.pathname.split("/").at(-1), method = options.method;
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ table, method, body, query: url.searchParams });
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" } });
    if (denied) return reply({ code: "42501", message: "PRIVATE_PROVIDER_INFORMATION" }, 403);
    if (method === "HEAD") return new Response(null, { status: 200, headers: { "Content-Range": "*/1" } });
    if (method === "POST") {
      if (saved.has(body.id) || [...saved.values()].some(s => s.student_code === body.student_code)) return reply({ code: "23505", message: "PRIVATE_CONSTRAINT" }, 409);
      saved.set(body.id, body); return reply([{ id: body.id }], 201);
    }
    if (method === "PATCH") return reply(patchRows ? [{ id }] : []);
    if (table === "programs") return reply([{ id: programId, name: "Test Program", is_active: activeProgram }]);
    if (table === "batches") return reply([{ id: batchId, name: "Test Batch", program_id: wrongProgram ? id : programId, is_active: activeBatch }]);
    if (table === "students") return reply([current]);
    throw new Error("Unexpected table");
  } } });
  const auth = { async requireAdmin() { if (unauthorized) throw new Error("ADMIN_REQUIRED"); authorized = true; } };
  const errorHelper = { databaseError(error) { return error?.code === "23505" ? "Duplicate registration" : "Permission or database error"; } };
  const data = load("src/lib/admin/student-data.ts", { "node:crypto": { createHash }, "@/lib/supabase/admin": auth, "@/lib/supabase/server": { async createClient() { return db; } }, "./data": errorHelper, "./management": management, "./students": model });
  const actions = load("src/app/admin/(protected)/student-actions.ts", { "node:crypto": { randomBytes: () => Buffer.from("1234567890", "hex") }, "next/navigation": { redirect(path) { throw new Error(`REDIRECT:${path}`); } }, "next/cache": { revalidatePath() {} }, "@/lib/supabase/admin": auth, "@/lib/supabase/server": { async createClient() { return db; } }, "@/lib/admin/data": errorHelper, "@/lib/admin/student-data": data, "@/lib/admin/students": model });
  const csv = load("src/app/admin/(protected)/students/export/route.ts", { "@/lib/supabase/admin": auth, "@/lib/supabase/server": { async createClient() { return db; } }, "@/lib/admin/student-data": data, "@/lib/admin/students": model });
  return { ...actions, ...data, csv: csv.GET, requests, saved };
}
test("student dates and Indian phone validation reject impossible dates and normalize optional mobiles", () => {
  assert.equal(model.validDate("2024-02-29"), true);
  for (const date of ["2023-02-29", "2026-04-31", "0000-01-01"]) assert.equal(model.validDate(date), false);
  assert.equal(model.mobileNumber("+91 98765-43210"), "+919876543210");
  assert.equal(model.mobileNumber("1234567890"), null);
  assert.equal(Object.keys(model.validateStudent(form()).fieldErrors).length, 0);
  assert.ok(model.validateStudent(form({ date_of_birth: "2999-01-01", guardian_mobile: "123" })).fieldErrors.date_of_birth);
  assert.ok(model.validateStudent(form({ batch_id: batchId, program_id: "" })).fieldErrors.batch_id);
});
test("student mutation, list/detail and CSV routes require admin before database requests", async () => {
  const h = harness({ unauthorized: true });
  for (const task of [() => h.saveStudent({}, form()), () => h.loadStudents(model.studentFilters({})), () => h.loadStudentForm(id), () => h.csv(new Request("http://localhost/admin/students/export"))]) await assert.rejects(task(), /ADMIN_REQUIRED/);
  assert.equal(h.requests.length, 0);
});
test("registration generates immutable code server-side and duplicate submissions cannot create another student", async () => {
  const h = harness();
  await assert.rejects(h.saveStudent({}, form({ student_code: "FORGED", role: "admin" })), /notice=created/);
  const inserted = h.saved.get(id);
  assert.match(inserted.student_code, /^AY-\d{4}-[A-F0-9]{10}$/);
  assert.equal("role" in inserted, false);
  assert.equal((await h.saveStudent({}, form())).error, "Duplicate registration");
  assert.equal(h.saved.size, 1);
});
test("invalid fields and mismatched/inactive enrollment references cannot insert students", async () => {
  const invalid = harness();
  assert.ok((await invalid.saveStudent({}, form({ full_name: "" }))).fieldErrors.full_name);
  assert.equal(invalid.requests.length, 0);
  for (const config of [{ wrongProgram: true }, { activeProgram: false }, { activeBatch: false }]) {
    const h = harness(config);
    assert.ok((await h.saveStudent({}, form())).error);
    assert.equal(h.requests.some(r => r.method === "POST"), false);
  }
});
test("enrollment/status changes need confirmation; profile edits guard original nullable fields and code", async () => {
  const h = harness();
  const edit = { mode: "edit", version: version(current), status: "inactive" };
  assert.ok((await h.saveStudent({}, form(edit))).fieldErrors.confirm_enrollment);
  assert.equal(h.requests.some(r => r.method === "PATCH"), false);
  await assert.rejects(h.saveStudent({}, form({ ...edit, confirm_enrollment: "on", student_code: "FORGED" })), /notice=updated/);
  const patch = h.requests.find(r => r.method === "PATCH");
  assert.equal(patch.query.get("student_code"), "eq.TEST-001");
  assert.equal(patch.query.get("guardian_mobile"), "is.null");
  assert.equal("student_code" in patch.body, false);
  const stale = harness();
  assert.ok((await stale.saveStudent({}, form({ mode: "edit", version: "a".repeat(64) }))).error);
  assert.equal(stale.requests.some(r => r.method === "PATCH"), false);
  assert.ok((await harness({ patchRows: false }).saveStudent({}, form({ mode: "edit", version: version(current) }))).error);
});
test("student CSV applies current filters and excludes guardian, contact and birth fields", async () => {
  const h = harness();
  const response = await h.csv(new Request(`http://localhost/admin/students/export?status=inactive&batch=${batchId}`));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const csv = await response.text();
  assert.equal(csv.includes("guardian"), false);
  assert.equal(csv.includes("mobile"), false);
  const query = h.requests.find(r => r.table === "students");
  assert.equal(query.query.get("status"), "eq.inactive");
  assert.equal(query.query.get("batch_id"), `eq.${batchId}`);
  assert.equal(query.query.get("select"), "student_code,full_name,program_id,batch_id,joining_date,status");
});
test("CSV neutralizes spreadsheet formulas and quotes delimiters; search quotes PostgREST grammar", () => {
  for (const value of ["=1+1", " +SUM(A1)", "@bad", "-1", "\tformula"]) assert.ok(model.csvCell(value).startsWith('"\''));
  assert.equal(model.csvCell('A,"B"'), '"A,""B"""');
  const search = model.studentSearch('x"),status.eq.active');
  assert.ok(search.includes('x\\"),status.eq.active'));
  assert.equal(search.startsWith('full_name.ilike."%'), true);
});
test("database errors remain safe and never claim registration success", async () => {
  const h = harness({ denied: true });
  const result = await h.saveStudent({}, form());
  assert.ok(result.error);
  assert.equal(JSON.stringify(result).includes("PRIVATE_PROVIDER_INFORMATION"), false);
});
