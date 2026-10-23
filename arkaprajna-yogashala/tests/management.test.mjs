import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Intl, URLSearchParams, process: { env: { NODE_ENV: "test" } },
    require(name) {
      if (name === "server-only") return {};
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

const model = load("src/lib/admin/management.ts");
const id = "11111111-1111-4111-8111-111111111111";
const programId = "22222222-2222-4222-8222-222222222222";
const trainerId = "33333333-3333-4333-8333-333333333333";
const stamp = "2026-10-20T00:00:00Z";
const program = { id: programId, name: "Hatha", description: null, monthly_fee: 1200, is_active: true, created_at: stamp };
const batch = { id, name: "Morning", program_id: programId, trainer_id: null, start_time: "06:00:00", end_time: "07:00:00", days_of_week: ["Monday"], is_active: true, created_at: stamp };
const version = record => createHash("sha256").update(JSON.stringify(record)).digest("hex");

function form(values = {}, kind = "program") {
  const defaults = kind === "program"
    ? { id, mode: "create", name: "Hatha", monthly_fee: "0", description: "", is_active: "true" }
    : { id, mode: "create", name: "Morning", program_id: programId, trainer_id: "", start_time: "06:00", end_time: "07:00", is_active: "true", days_of_week: ["Monday", "Friday"] };
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...defaults, ...values })) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

// Use the real PostgREST query builder with an in-memory HTTP transport. No live writes.
function harness({ unauthorized = false, activeProgram = true, activeTrainer = true, trainerRole = "trainer", currentProgram = program, currentBatch = batch, updateRows = true, databaseDenied = false } = {}) {
  const requests = [];
  const saved = new Map();
  let authorized = false;
  const db = createClient("https://fixture.supabase.co", "sb_publishable_test_fixture", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, options) => {
      assert.equal(authorized, true, "Authorization must finish before every database request");
      const url = new URL(input);
      const table = url.pathname.split("/").at(-1);
      const method = options.method;
      const body = options.body ? JSON.parse(options.body) : null;
      requests.push({ table, method, body, query: url.searchParams });
      const respond = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
      if (databaseDenied) return respond({ code: "42501", message: "PRIVATE_DATABASE_DETAILS" }, 403);
      if (method === "HEAD") {
        const active = url.searchParams.get("is_active") === "eq.true";
        const count = table === "programs" ? (active ? 5 : 7) : (active ? 4 : 9);
        return new Response(null, { status: 200, headers: { "Content-Range": `*/${count}` } });
      }
      if (method === "GET") {
        if (table === "programs") return respond(currentProgram ? [{ ...currentProgram, is_active: activeProgram }] : []);
        if (table === "batches") return respond(currentBatch ? [currentBatch] : []);
        if (table === "profiles") {
          assert.equal(url.searchParams.get("role"), "eq.trainer");
          const columns = url.searchParams.get("select");
          assert.ok(["id", "id,full_name"].includes(columns));
          return respond(trainerRole === "trainer" && (activeTrainer || url.searchParams.get("is_active") !== "eq.true") ? [{ id: trainerId, ...(columns === "id,full_name" ? { full_name: "Fixture Teacher" } : {}) }] : []);
        }
      }
      if (method === "POST") {
        const key = `${table}:${body.id}`;
        if (saved.has(key)) return respond({ code: "23505", message: "PRIVATE_CONSTRAINT_DETAILS" }, 409);
        saved.set(key, body);
        return respond([{ id: body.id }], 201);
      }
      if (method === "PATCH") return respond(updateRows ? [{ id }] : []);
      throw new Error(`Unexpected request ${method} ${table}`);
    } },
  });
  const auth = { requireAdmin: async () => {
    if (unauthorized) throw new Error("REDIRECT:/admin/login");
    authorized = true;
    return { id: "fixture-admin" };
  } };
  const data = load("src/lib/admin/data.ts", {
    "node:crypto": { createHash }, "@/lib/supabase/admin": auth,
    "@/lib/supabase/server": { createClient: async () => db }, "./management": model,
  });
  const actions = load("src/app/admin/(protected)/management-actions.ts", {
    "next/navigation": { redirect: path => { throw new Error(`REDIRECT:${path}`); } },
    "next/cache": { revalidatePath() {} }, "@/lib/supabase/admin": auth,
    "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/admin/data": data, "@/lib/admin/management": model,
  });
  return { ...actions, loadBatchChoices: data.loadBatchChoices, loadOverviewCounts: data.loadOverviewCounts, requests, saved };
}

test("program validation accepts free programs and rejects invalid decimal fees and blank names", () => {
  assert.equal(Object.keys(model.validateProgram(form()).errors).length, 0);
  for (const fee of ["-1", "NaN", "Infinity", "1e3", "", "1.001"]) {
    assert.ok(model.validateProgram(form({ monthly_fee: fee })).errors.monthly_fee);
  }
  assert.ok(model.validateProgram(form({ name: "   " })).errors.name);
});

test("batch validation enforces references, same-day times, and canonical weekday names", () => {
  assert.equal(Object.keys(model.validateBatch(form({}, "batch")).errors).length, 0);
  for (const values of [
    { start_time: "07:00", end_time: "06:00" }, { start_time: "07:00", end_time: "07:00" },
    { start_time: "25:00" }, { days_of_week: [] }, { days_of_week: ["Funday"] },
    { program_id: "invalid" }, { trainer_id: "invalid" },
  ]) assert.ok(Object.keys(model.validateBatch(form(values, "batch")).errors).length > 0);
  assert.equal(model.validateBatch(form({ trainer_id: "" }, "batch")).values.trainer_id, null);
  assert.equal(JSON.stringify(model.validateBatch(form({ days_of_week: ["Friday", "Monday", "Monday"] }, "batch")).values.days_of_week), '["Monday","Friday"]');
});

test("every mutation rejects unauthenticated requests before database access", async () => {
  const h = harness({ unauthorized: true });
  await assert.rejects(h.saveProgram({}, form()), /REDIRECT:\/admin\/login/);
  await assert.rejects(h.saveBatch({}, form({}, "batch")), /REDIRECT:\/admin\/login/);
  assert.equal(h.requests.length, 0);
});

test("invalid submitted values never reach the database", async () => {
  const h = harness();
  assert.ok((await h.saveProgram({}, form({ monthly_fee: "-1" }))).fieldErrors.monthly_fee);
  assert.ok((await h.saveBatch({}, form({ days_of_week: [] }, "batch"))).fieldErrors.days_of_week);
  assert.equal(h.requests.length, 0);
});

test("a repeated program submission inserts only one record and returns a helpful conflict", async () => {
  const h = harness();
  await assert.rejects(h.saveProgram({}, form()), /REDIRECT:\/admin\/programs\?notice=created/);
  const retry = await h.saveProgram({}, form());
  assert.match(retry.error, /already saved|conflicts/);
  assert.doesNotMatch(retry.error, /PRIVATE/);
  assert.equal(h.saved.size, 1);
});

test("program edits require explicit deactivation confirmation and reject stale versions", async () => {
  const h = harness();
  const values = { id: programId, mode: "edit", version: version(program), is_active: "false" };
  assert.ok((await h.saveProgram({}, form(values))).fieldErrors.confirm_deactivation);
  assert.equal(h.requests.some(request => request.method === "PATCH"), false);
  assert.match((await h.saveProgram({}, form({ ...values, version: "0".repeat(64) }))).error, /changed after/);
  await assert.rejects(h.saveProgram({}, form({ ...values, confirm_deactivation: "on" })), /notice=updated/);
  assert.equal(h.requests.find(request => request.method === "PATCH").body.is_active, false);
  assert.equal(h.requests.some(request => request.table === "students" || request.method === "DELETE"), false);
});

test("new batches reject inactive/missing programs and non-trainer profiles", async () => {
  for (const options of [{ activeProgram: false }, { currentProgram: null }, { trainerRole: "admin" }]) {
    const h = harness(options);
    const result = await h.saveBatch({}, form({ trainer_id: trainerId }, "batch"));
    assert.ok(result.fieldErrors.program_id || result.fieldErrors.trainer_id);
    assert.equal(h.requests.some(request => request.method === "POST"), false);
  }
});

test("new batches save full weekday names and support no assigned trainer", async () => {
  const h = harness();
  await assert.rejects(h.saveBatch({}, form({}, "batch")), /REDIRECT:\/admin\/batches\?notice=created/);
  const inserted = [...h.saved.values()][0];
  assert.equal(inserted.trainer_id, null);
  assert.deepEqual(inserted.days_of_week, ["Monday", "Friday"]);
  assert.equal(inserted.program_id, programId);
  assert.equal(h.requests.some(request => request.table === "profiles"), false);
});

test("trainer choices are read from real profile queries with only display fields and trainer role", async () => {
  const h = harness();
  const result = await h.loadBatchChoices();
  assert.equal(result.data.trainers[0].full_name, "Fixture Teacher");
  const request = h.requests.find(request => request.table === "profiles");
  assert.equal(request.query.get("select"), "id,full_name");
  assert.equal(request.query.get("role"), "eq.trainer");
  assert.equal(h.requests.some(request => request.method !== "GET"), false);
});

test("assigned trainers are verified on save and repeated batch submissions cannot insert twice", async () => {
  const h = harness();
  await assert.rejects(h.saveBatch({}, form({ trainer_id: trainerId }, "batch")), /notice=created/);
  assert.match((await h.saveBatch({}, form({ trainer_id: trainerId }, "batch"))).error, /already saved|conflicts/);
  assert.equal(h.saved.size, 1);
  const request = h.requests.find(request => request.table === "profiles");
  assert.equal(request.query.get("id"), `eq.${trainerId}`);
  assert.equal(request.query.get("role"), "eq.trainer");
});

test("dashboard counts come from count queries and failures are never converted to zero", async () => {
  const h = harness();
  const result = await h.loadOverviewCounts();
  assert.equal(JSON.stringify(result.data), JSON.stringify({ programs: 7, activePrograms: 5, batches: 9, activeBatches: 4, students: 9, activeStudents: 9, trainers: 9 }));
  assert.equal(h.requests.filter(request => request.method === "HEAD").length, 7);
  assert.equal(h.requests.find(r => r.table === "profiles").query.get("role"), "eq.trainer");
  const denied = await harness({ databaseDenied: true }).loadOverviewCounts();
  assert.equal(denied.data, null);
  assert.ok(denied.error);
});

test("batch edits can retain the current inactive program and use array containment guards", async () => {
  const h = harness({ activeProgram: false });
  await assert.rejects(h.saveBatch({}, form({ mode: "edit", version: version(batch) }, "batch")), /notice=updated/);
  const patch = h.requests.find(request => request.method === "PATCH");
  assert.deepEqual(patch.query.getAll("days_of_week"), ["cs.{Monday}", "cd.{Monday}"]);
  const other = harness({ activeProgram: false, currentProgram: { ...program, id: trainerId } });
  assert.ok((await other.saveBatch({}, form({ mode: "edit", version: version(batch), program_id: trainerId }, "batch"))).fieldErrors.program_id);
});

test("batch deactivation needs confirmation and concurrent changes do not report a false save", async () => {
  const h = harness();
  const values = { mode: "edit", version: version(batch), is_active: "false" };
  assert.ok((await h.saveBatch({}, form(values, "batch"))).fieldErrors.confirm_deactivation);
  assert.equal(h.requests.some(request => request.method === "PATCH"), false);
  const racing = harness({ updateRows: false });
  assert.match((await racing.saveBatch({}, form({ ...values, confirm_deactivation: "on" }, "batch"))).error, /changed after/);
});

test("new inactive-trainer assignments are rejected while existing inactive assignments can be retained", async () => {
  const h = harness({ activeTrainer: false });
  const result = await h.saveBatch({}, form({ trainer_id: trainerId }, "batch"));
  assert.ok(result.fieldErrors.trainer_id);
  assert.equal(h.requests.some(request => request.method === "POST" || request.method === "PATCH"), false);
  const current = { ...batch, trainer_id: trainerId };
  const edit = harness({ activeTrainer: false, currentBatch: current });
  await assert.rejects(edit.saveBatch({}, form({ mode: "edit", trainer_id: trainerId, version: version(current) }, "batch")), /notice=updated/);
});

test("database permission errors remain safe and do not claim a successful write", async () => {
  const h = harness({ databaseDenied: true });
  const result = await h.saveProgram({}, form());
  assert.match(result.error, /permissions denied/);
  assert.doesNotMatch(result.error, /PRIVATE_DATABASE_DETAILS/);
});

test("filters treat wildcard characters literally and schedule formatting is deterministic", () => {
  assert.equal(model.escapeSearch("50%_practice"), "50\\%\\_practice");
  assert.equal(model.parseFilters({ page: "-4", status: "invalid", program: "invalid" }).page, 1);
  assert.equal(model.formatTime("00:15:00"), "12:15 AM");
  assert.equal(model.formatTime("18:30:00"), "6:30 PM");
  assert.equal(model.formatDays(["Friday", "Monday"]), "Mon · Fri");
});
