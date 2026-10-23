import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import crypto from "node:crypto";
function load(file, deps = {}, env = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
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
      Buffer,
      FormData,
      URL,
      Response,
      URLSearchParams,
      Intl,
      require(n) {
        if (n === "server-only") return {};
        if (n === "node:crypto") return crypto;
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
const policy = load("src/lib/fees/policy.ts", {
  "../admin/students": students,
});
const studio = load("src/lib/studio/model.ts", {
  "../admin/students": students,
  "../admin/management": management,
});
const id = "11111111-1111-4111-8111-111111111111",
  pid = "22222222-2222-4222-8222-222222222222";
function form(values) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, String(v));
  return f;
}
test("INR parser uses exact paise, accepts zero/max and rejects ambiguous decimals", () => {
  assert.equal(policy.paise("0.01"), 1);
  assert.equal(policy.paise("0"), 0);
  assert.equal(policy.paise("999999999.99"), 99999999999);
  for (const s of [
    "1e2",
    "-1",
    "NaN",
    "Infinity",
    "1.001",
    "1000000000",
    " 1",
    "",
  ])
    assert.throws(() => policy.paise(s));
  assert.equal(policy.inr(123456), "\u20b91,234.56");
  assert.throws(() => policy.sumPaise([Number.MAX_SAFE_INTEGER, 1]));
});
test("billing boundaries include leap month, year rollover, partial overdue and zero paid", () => {
  for (const month of ["2028-02", "2026-12", "2027-01"]) {
    assert.equal(
      policy.feeStatus(100, 50, month, month + "-15").overdue,
      false,
    );
    assert.equal(policy.feeStatus(100, 50, month, month + "-16").overdue, true);
    assert.equal(policy.feeStatus(100, 50, month, month + "-11").grace, true);
    assert.equal(
      policy.feeStatus(100, 100, month, month + "-16").overdue,
      false,
    );
    assert.equal(policy.feeStatus(0, 0, month, month + "-16").status, "paid");
  }
  assert.equal(policy.feeStatus(100, 0, "2026-12", "2027-01-01").overdue, true);
  assert.equal(
    policy.feeStatus(100, 0, "2027-01", "2026-12-31").overdue,
    false,
  );
  assert.throws(() => policy.feeStatus(100, 101, "2026-12", "2026-12-10"));
});
test("financial CSV protects formulas, whitespace prefixes, quotes and line breaks", () => {
  const s = policy.csv([[" =SUM(A1)", 'a"b', "c,d", "x\ny"]]);
  assert.ok(s.includes("' =SUM"));
  assert.ok(s.includes('a""b'));
  assert.ok(s.includes('"c,d"'));
});
function feeHarness({ enabled = true, authorized = true, user = id } = {}) {
  const calls = [];
  const db = {
    from(table) {
      calls.push(["from", table]);
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async single() {
          return table === "students"
            ? {
                data: {
                  id,
                  full_name: "Synthetic Student",
                  student_code: "SYN",
                  program_id: pid,
                  status: "active",
                  joining_date: "2020-01-25",
                },
              }
            : {
                data: {
                  id: pid,
                  name: "Synthetic Program",
                  monthly_fee: "1000.00",
                  is_active: true,
                },
              };
        },
      };
    },
    async rpc(name, args) {
      calls.push(["rpc", name, args]);
      return { data: "confirmed", error: null };
    },
  };
  const a = load(
    "src/app/admin/(protected)/fees/actions.ts",
    {
      "next/cache": { revalidatePath() {} },
      "@/lib/supabase/admin": {
        async requireAdmin() {
          calls.push(["auth"]);
          if (!authorized) throw Error("DENIED");
          return { id: user };
        },
      },
      "@/lib/supabase/server": {
        async createClient() {
          calls.push(["db"]);
          return db;
        },
      },
      "@/lib/fees/data": { financialWrites: () => enabled },
      "@/lib/fees/policy": policy,
      "@/lib/admin/management": management,
      "@/lib/admin/students": students,
    },
    {
      FINANCIAL_PREVIEW_KEY:
        "synthetic-signing-key-not-used-in-production-1234",
    },
  );
  return { ...a, calls };
}
test("financial action authorizes before gate and cannot access DB when disabled", async () => {
  const denied = feeHarness({ authorized: false });
  await assert.rejects(denied.feeCommand({}, form({})), /DENIED/);
  assert.equal(denied.calls.length, 1);
  const disabled = feeHarness({ enabled: false });
  assert.ok((await disabled.feeCommand({}, form({}))).error);
  assert.equal(disabled.calls.length, 1);
});
test("bill preview is signed, preserves exact source fee, and commit invokes only checked RPC", async () => {
  const h = feeHarness();
  const preview = await h.feeCommand(
    {},
    form({
      kind: "bill",
      student: id,
      month: "2026-12",
      source: "program",
      concession: "10",
      reason: "Synthetic concession",
      amount: "0.01",
    }),
  );
  assert.ok(preview.token);
  assert.ok(!h.calls.some((c) => c[0] === "rpc"));
  const saved = await h.feeCommand(
    preview,
    form({
      stage: "confirm",
      token: preview.token,
      confirm: "on",
      role: "admin",
      amount: "1",
    }),
  );
  assert.ok(saved.message);
  const call = h.calls.find((c) => c[0] === "rpc");
  assert.equal(call[1], "fee_create_bill");
  assert.equal(call[2].p_base_paise, 100000);
  assert.equal(call[2].p_concession_paise, 1000);
  assert.equal(call[2].p_source, "program");
  assert.equal(call[2].p_student, id);
});
test("modified preview, another administrator and missing confirmation cannot mutate", async () => {
  const h = feeHarness();
  const p = await h.feeCommand(
    {},
    form({
      kind: "bill",
      student: id,
      month: "2026-12",
      source: "program",
      concession: "0",
    }),
  );
  assert.ok(p.token);
  for (const token of [p.token + "0", "malformed"])
    assert.ok(
      (await h.feeCommand(p, form({ stage: "confirm", token, confirm: "on" })))
        .error,
    );
  assert.ok(
    (await h.feeCommand(p, form({ stage: "confirm", token: p.token }))).error,
  );
  const other = feeHarness({ user: pid });
  assert.ok(
    (
      await other.feeCommand(
        p,
        form({ stage: "confirm", token: p.token, confirm: "on" }),
      )
    ).error,
  );
  assert.ok(
    !h.calls.some((c) => c[0] === "rpc") &&
      !other.calls.some((c) => c[0] === "rpc"),
  );
});
test("unverified payments, unallocated excess and refund activation fail closed", async () => {
  const h = feeHarness();
  assert.ok(
    (
      await h.feeCommand(
        {},
        form({
          kind: "payment",
          student: id,
          amount: "10",
          date: students.indianToday(),
          method: "upi",
        }),
      )
    ).error,
  );
  assert.ok(
    (
      await h.feeCommand(
        {},
        form({
          kind: "payment",
          student: id,
          amount: "10",
          date: students.indianToday(),
          method: "cash",
          verified: "on",
        }),
      )
    ).error,
  );
  assert.ok(
    (
      await h.feeCommand(
        {},
        form({
          kind: "reversal",
          payment: pid,
          reason: "Synthetic reason",
          reversal_kind: "verified_refund",
        }),
      )
    ).error,
  );
  assert.ok(!h.calls.some((c) => c[0] === "rpc"));
});
test("financial loader authorizes first and disabled reads never query missing tables", async () => {
  let db = 0,
    auth = 0;
  const x = load("src/lib/fees/data.ts", {
    "@/lib/supabase/admin": {
      async requireAdmin() {
        auth++;
      },
    },
    "@/lib/supabase/server": {
      async createClient() {
        db++;
        throw Error("PRIVATE");
      },
    },
    "./policy": policy,
  });
  assert.equal((await x.loadFees()).data, null);
  assert.equal(auth, 1);
  assert.equal(db, 0);
  assert.equal(x.financialWrites(), false);
});
test("public inquiry requires consent and canonical mobile; honeypot/past/invalid dates rejected", () => {
  const base = {
    full_name: "Synthetic Visitor",
    mobile: "9876543210",
    consent: "on",
  };
  assert.equal(studio.validateInquiry(form(base)).mobile, "+919876543210");
  for (const change of [
    { consent: "" },
    { website: "spam" },
    { mobile: "123" },
    { preferred_date: "2020-01-01" },
    { preferred_date: "2027-02-30" },
  ])
    assert.throws(() => studio.validateInquiry(form({ ...base, ...change })));
});
test("public settings reject unsafe URLs and exclude arbitrary submitted private fields", () => {
  const s = studio.settingsFromForm(
    form({
      name: "Studio",
      role: "admin",
      service_role: "never",
      program_name_0: "Approved program",
      trainer_name_0: "Approved Teacher",
      trainer_profile_0: id,
      trainer_email_0: "private@example.invalid",
    }),
  );
  assert.equal(s.name, "Studio");
  assert.equal("role" in s, false);
  assert.equal("service_role" in s, false);
  assert.equal("email" in s.trainers[0], false);
  for (const url of [
    "javascript:alert(1)",
    "http://example.com",
    "https://user:password@example.com",
  ])
    assert.throws(() =>
      studio.settingsFromForm(form({ name: "Studio", social_url: url })),
    );
});
test("studio changes authorize before disabled gate; no public caller can save settings", async () => {
  let db = 0;
  for (const authorized of [false, true]) {
    const x = load("src/app/admin/(protected)/studio-actions.ts", {
      "next/cache": { revalidatePath() {} },
      "@/lib/supabase/admin": {
        async requireAdmin() {
          if (!authorized) throw Error("DENIED");
        },
      },
      "@/lib/supabase/server": {
        async createClient() {
          db++;
        },
      },
      "@/lib/studio/admin-data": { operationsWrite: () => false },
      "@/lib/studio/model": studio,
      "@/lib/admin/management": management,
      "@/lib/admin/students": students,
    });
    if (!authorized)
      await assert.rejects(
        x.saveStudio({}, form({ kind: "settings", confirm: "on" })),
        /DENIED/,
      );
    else
      assert.ok(
        (await x.saveStudio({}, form({ kind: "settings", confirm: "on" })))
          .error,
      );
  }
  assert.equal(db, 0);
});
test("public inquiries remain disabled without invoking Supabase", async () => {
  let calls = 0;
  const x = load("src/app/(public)/trial/actions.ts", {
    "@/lib/studio/public-data": {
      anonymousClient() {
        calls++;
      },
    },
    "@/lib/studio/model": studio,
    "@/lib/admin/management": management,
  });
  assert.ok((await x.submitInquiry({}, form({}))).error);
  assert.equal(calls, 0);
});

test("public settings validation never mutates shared unpublished defaults across requests",()=>{const before=JSON.stringify(studio.EMPTY_SETTINGS);const first=studio.settingsFromForm(form({name:"Studio",program_name_0:"Approved only after publish"}));assert.equal(first.programs.length,1);assert.equal(JSON.stringify(studio.EMPTY_SETTINGS),before);const second=studio.settingsFromForm(form({name:"Another studio"}));assert.equal(second.programs.length,0);assert.equal(second.trainers.length,0);assert.throws(()=>studio.settingsFromForm(form({name:"Studio",trainer_name_0:"Unlinked teacher"})));});
