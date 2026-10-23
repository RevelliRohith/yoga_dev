import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, deps = {}, env = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(new URL("../" + file, import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      },
    ).outputText,
    {
      exports,
      process: { env },
      FormData,
      Date,
      Intl,
      URL,
      Response,
      require(n) {
        if (n === "server-only") return {};
        if (!(n in deps)) throw Error("Unexpected dependency " + n);
        return deps[n];
      },
    },
  );
  return exports;
}
const management = load("src/lib/admin/management.ts");
const students = load("src/lib/admin/students.ts", {
  "./management": management,
});
const model = load("src/lib/studio/model.ts", {
  "../admin/management": management,
  "../admin/students": students,
});
const id = "11111111-1111-4111-8111-111111111111";
function form(v) {
  const f = new FormData();
  for (const [k, value] of Object.entries(v)) f.set(k, String(value));
  return f;
}
function harness({
  enabled = true,
  authorized = true,
  response = { data: [{ id }], error: null },
  throws = false,
} = {}) {
  const calls = [];
  const query = {};
  for (const method of ["select", "eq", "in", "insert", "update"])
    query[method] = (...args) => {
      calls.push([method, ...args]);
      return query;
    };
  query.maybeSingle = async () => ({ data: null, error: null });
  query.then = (resolve, reject) =>
    (throws
      ? Promise.reject(Error("PRIVATE PROVIDER SENTINEL"))
      : Promise.resolve(response)
    ).then(resolve, reject);
  const actions = load("src/app/admin/(protected)/studio-actions.ts", {
    "next/cache": { revalidatePath: () => {} },
    "@/lib/supabase/admin": {
      requireAdmin: async () => {
        calls.push(["authorize"]);
        if (!authorized) throw Error("Unauthorized");
      },
    },
    "@/lib/supabase/server": {
      createClient: async () => ({
        from: (t) => {
          calls.push(["table", t]);
          return query;
        },
      }),
    },
    "@/lib/studio/admin-data": { operationsWrite: () => enabled },
    "@/lib/studio/model": model,
    "@/lib/admin/management": management,
    "@/lib/admin/students": students,
  });
  return {
    calls,
    save: (v) => actions.saveStudio({}, form({ confirm: "on", id, ...v })),
  };
}
const event = {
  kind: "event",
  title: "Workshop",
  starts_at: "2028-02-29T10:30",
  published: "false",
  venue: "Studio",
};

test("India event time uses real calendar dates and an explicit offset", () => {
  assert.equal(
    model.indianDateTime("2028-02-29T10:30"),
    "2028-02-29T05:00:00.000Z",
  );
  for (const s of [
    "2027-02-29T10:30",
    "2028-02-30T10:30",
    "2028-01-01T24:00",
    "2028-01-01T10:60",
    "2028-01-01T10:30Z",
  ])
    assert.throws(() => model.indianDateTime(s));
  assert.throws(() => model.eventValues(form({ ...event, published: "yes" })));
});
test("settings normalize incomplete data without retaining private or malformed fields", () => {
  const s = model.settingsContent({
    name: "Studio",
    secret: "private",
    programs: null,
    trainers: [
      {
        name: "Teacher",
        specialization: "Yoga",
        qualifications: "Q",
        biography: "Bio",
        profile_id: id,
        mobile: "private",
      },
    ],
  });
  assert.equal(s.programs.length, 0);
  assert.equal(s.trainers.length, 1);
  assert.ok(!JSON.stringify(s).includes("private"));
  assert.ok(!("profile_id" in s.trainers[0]));
  assert.equal(
    model.settingsContent({ trainers: s.trainers }).trainers.length,
    1,
  );
  assert.equal(
    model.settingsContent(
      { trainers: [{ ...s.trainers[0], profile_id: id }] },
      true,
    ).trainers[0].profile_id,
    id,
  );
  s.programs.push({ name: "x" });
  assert.equal(model.settingsContent({}).programs.length, 0);
});
test("public event projection drops drafts, invalid identities and private properties", () => {
  const e = {
    id,
    title: "Public",
    description: "Text",
    venue: "Studio",
    starts_at: "2026-12-01T04:00:00Z",
    published: true,
    private: "secret",
  };
  const rows = model.publicEvents([
    e,
    { ...e, published: false },
    { ...e, id: "invalid" },
  ]);
  assert.equal(rows.length, 1);
  assert.ok(!JSON.stringify(rows).includes("secret"));
  assert.throws(() => model.publicEvents(null));
});
test("studio actions authorize before all data access and honor disabled writes", async () => {
  const denied = harness({ authorized: false });
  await assert.rejects(() => denied.save(event), /Unauthorized/);
  assert.equal(denied.calls.length, 1);
  const disabled = harness({ enabled: false });
  assert.match((await disabled.save(event)).error, /disabled/);
  assert.equal(disabled.calls.length, 1);
});
test("valid event creation converts India time and published events require consent", async () => {
  const h = harness();
  assert.equal((await h.save(event)).error, "");
  const value = h.calls.find((x) => x[0] === "insert")[1];
  assert.equal(value.starts_at, "2028-02-29T05:00:00.000Z");
  const no = harness();
  assert.match(
    (await no.save({ ...event, published: "true" })).error,
    /approval/,
  );
  assert.ok(!no.calls.some((x) => x[0] === "insert"));
  const yes = harness();
  assert.equal(
    (await yes.save({ ...event, published: "true", publish_consent: "on" }))
      .error,
    "",
  );
});
test("invalid event dates never reach a database write", async () => {
  const h = harness();
  assert.match(
    (await h.save({ ...event, starts_at: "2026-02-30T10:30" })).error,
    /calendar/,
  );
  assert.ok(!h.calls.some((x) => x[0] === "insert" || x[0] === "update"));
});
test("event edits compare original version and report stale writes as unconfirmed", async () => {
  const h = harness({ response: { data: [], error: null } });
  assert.match(
    (await h.save({ ...event, version: "original" })).error,
    /changed/,
  );
  assert.ok(
    h.calls.some(
      (x) => x[0] === "eq" && x[1] === "updated_at" && x[2] === "original",
    ),
  );
});
test("inquiry conversion writes only allowed follow-up fields and never creates a student", async () => {
  const h = harness();
  assert.equal(
    (
      await h.save({
        kind: "inquiry",
        status: "converted",
        notes: "Reviewed",
        version: "v",
        mobile: "malicious",
      })
    ).error,
    "",
  );
  const fields = Object.keys(h.calls.find((x) => x[0] === "update")[1]).sort();
  assert.deepEqual(fields, ["notes", "status", "updated_at"]);
  assert.ok(!h.calls.some((x) => x[0] === "table" && x[1] === "students"));
});
test("certificate issuance keeps a stable unique reference and rejects future dates", async () => {
  const h = harness();
  assert.equal(
    (
      await h.save({
        kind: "certificate",
        participant_name: "Test participant",
        title: "Participation",
        issue_date: "2020-01-01",
      })
    ).error,
    "",
  );
  assert.equal(
    h.calls.find((x) => x[0] === "insert")[1].reference,
    "AYC-2020-111111111111",
  );
  const future = harness();
  assert.match(
    (
      await future.save({
        kind: "certificate",
        participant_name: "Test",
        title: "Participation",
        issue_date: "2999-01-01",
      })
    ).error,
    /issue date/,
  );
  assert.ok(!future.calls.some((x) => x[0] === "insert"));
});
test("duplicate requests are conflicts, and unexpected provider errors never leak", async () => {
  const duplicate = harness({
    response: {
      data: null,
      error: { code: "23505", message: "PRIVATE PROVIDER SENTINEL" },
    },
  });
  assert.match((await duplicate.save(event)).error, /already exists/);
  const broken = harness({ throws: true });
  const r = await broken.save(event);
  assert.equal(r.error, "Could not confirm this change.");
  assert.ok(!JSON.stringify(r).includes("SENTINEL"));
});
test("public settings refuse a trainer that is no longer active", async () => {
  const h = harness({ response: { data: [], error: null } });
  const r = await h.save({
    kind: "settings",
    name: "Studio",
    publish_consent: "on",
    trainer_name_0: "Teacher",
    trainer_profile_0: id,
  });
  assert.match(r.error, /inactive/);
  assert.ok(!h.calls.some((x) => x[0] === "insert" || x[0] === "update"));
});
test("scoped admin loader avoids unrelated private sources and normalizes stored settings", async () => {
  const calls = [];
  const db = {
    from(table) {
      calls.push(table);
      const q = {
        select: () => q,
        order: () => q,
        range: async () => ({
          data:
            table === "studio_settings"
              ? [{ content: { name: "Studio" } }]
              : [],
          count: table === "studio_settings" ? 1 : 0,
          error: null,
        }),
      };
      return q;
    },
  };
  const data = load(
    "src/lib/studio/admin-data.ts",
    {
      "@/lib/supabase/admin": { requireAdmin: async () => {} },
      "@/lib/supabase/server": { createClient: async () => db },
      "./model": model,
    },
    { STUDIO_OPERATIONS_READS_ENABLED: "true" },
  );
  const e = await data.loadStudio("events");
  assert.ok(e.data);
  assert.deepEqual(calls, ["studio_events"]);
  calls.length = 0;
  const c = await data.loadStudio("certificates");
  assert.equal(c.data.settings.name, "Studio");
  assert.equal(c.data.settings.programs.length, 0);
  assert.ok(!calls.includes("studio_inquiries"));
});
test("report export denies anonymous access and unavailable sources do not become zero CSVs", async () => {
  let reads = 0;
  const deps = {
    "@/lib/supabase/admin": {
      requireAdmin: async () => {
        throw Error("Unauthorized");
      },
    },
    "@/lib/studio/admin-data": {
      loadStudio: async () => {
        reads++;
        return { data: null, error: "Unavailable" };
      },
    },
    "@/lib/admin/students": students,
  };
  const denied = load(
    "src/app/admin/(protected)/reports/export/route.ts",
    deps,
  );
  await assert.rejects(() =>
    denied.GET(new Request("http://localhost/export?report=events")),
  );
  assert.equal(reads, 0);
  deps["@/lib/supabase/admin"] = { requireAdmin: async () => {} };
  const unavailable = load(
    "src/app/admin/(protected)/reports/export/route.ts",
    deps,
  );
  assert.equal(
    (
      await unavailable.GET(
        new Request("http://localhost/export?report=events"),
      )
    ).status,
    503,
  );
});
test("inquiry CSV aggregates outcomes without contact or notes and escapes spreadsheet formulas", async () => {
  const route = load("src/app/admin/(protected)/reports/export/route.ts", {
    "@/lib/supabase/admin": { requireAdmin: async () => {} },
    "@/lib/studio/admin-data": {
      loadStudio: async () => ({
        data: {
          inquiries: [
            {
              program: "=FORMULA()",
              status: "new",
              mobile: "PRIVATE",
              notes: "PRIVATE",
            },
          ],
        },
        error: "",
      }),
    },
    "@/lib/admin/students": students,
  });
  const response = await route.GET(
    new Request("http://localhost/export?report=inquiries"),
  );
  assert.equal(response.status, 200);
  const csv = await response.text();
  assert.ok(!csv.includes("PRIVATE"));
  assert.ok(csv.includes("'=FORMULA()"));
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});
