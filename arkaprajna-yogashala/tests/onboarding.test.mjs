import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, deps = {}, env = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, FormData, URL, Buffer, AbortSignal, process: { env }, ...globals, require(name) {
    if (name === "server-only") return {};
    if (!(name in deps)) throw new Error(`Unexpected import: ${name}`);
    return deps[name];
  } });
  return exports;
}
const management = load("src/lib/admin/management.ts");
const trainers = load("src/lib/admin/trainers.ts", { "./management": management });
const model = load("src/lib/admin/onboarding.ts", { "./trainers": trainers });
const service = load("src/lib/admin/onboarding-service.ts", { "./onboarding": model });
const id = "11111111-1111-4111-8111-111111111111";
function form(values = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ full_name: "Fixture Teacher", email: "teacher@example.test", confirm_invitation: "on", ...values })) f.set(k, v);
  return f;
}
function harness({ profile = null, user = null, insertFail = false, emailFail = false, updateFail = false } = {}) {
  let record = profile, identity = user;
  const calls = [];
  const db = { from(table) {
    assert.equal(table, "profiles");
    let inserting;
    return { select() { return this; }, eq() { return this; }, insert(values) { inserting = values; return this; }, async maybeSingle() {
      calls.push({ kind: inserting ? "profile.insert" : "profile.read", values: inserting });
      if (inserting && insertFail) return { data: null, error: { code: "42501" } };
      if (inserting) record = inserting;
      return { data: record, error: null };
    } };
  } };
  const admin = {
    async listUsers() { calls.push({ kind: "list" }); return { data: { users: identity ? [identity] : [], nextPage: null }, error: null }; },
    async createUser(attributes) {
      calls.push({ kind: "create", attributes }); identity = { id, email: "teacher@example.test", app_metadata: attributes.app_metadata };
      return { data: { user: identity }, error: null };
    },
    async updateUserById(userId, attributes) {
      calls.push({ kind: "metadata", userId, attributes });
      if (updateFail) return { error: { message: "SENSITIVE_PROVIDER_MESSAGE" } };
      identity = { ...identity, app_metadata: JSON.parse(JSON.stringify(attributes.app_metadata)) };
      return { data: { user: identity }, error: null };
    },
    async getUserById() { return { data: { user: identity }, error: null }; },
    async inviteUserByEmail(email, options) { calls.push({ kind: "invite", email, options }); return { data: { user: identity }, error: emailFail ? { message: "PRIVATE_PROVIDER_DATA" } : null }; },
  };
  return { db, admin, calls, get record() { return record; }, get user() { return identity; } };
}
const values = model.validateOnboarding(form()).values;
const ownedUser = (extra = {}) => ({ id, email: "teacher@example.test", app_metadata: { trainer_onboarding: { application: model.ONBOARDING_APP, stage: "profile_pending", draft: values, attempt_id: id, created_by: "admin" } }, ...extra });
const input = { email: "teacher@example.test", values, attemptId: id, adminId: "admin" };

test("onboarding validates email and forces trainer active defaults regardless of submitted role/status", () => {
  const result = model.validateOnboarding(form({ role: "admin", is_active: "false", email: " Teacher@Example.Test " }));
  assert.equal(result.email, "teacher@example.test");
  assert.equal(result.values.is_active, true);
  assert.equal("role" in result.values, false);
  assert.ok(model.validateOnboarding(form({ email: "not-an-email" })).fieldErrors.email);
});
test("Auth identity is created without password or confirmation and profile links its returned UUID before email", async () => {
  const h = harness();
  await service.beginOnboarding(h.db, h.admin, input);
  const created = h.calls.find(c => c.kind === "create");
  assert.equal("password" in created.attributes, false);
  assert.equal(created.attributes.email_confirm, false);
  assert.equal(h.record.id, id);
  assert.equal(h.record.role, "trainer");
  assert.equal(h.record.is_active, true);
  assert.equal(h.calls.some(c => c.kind === "invite"), false);
  await service.sendTrainerSetup(h.db, h.admin, id, "https://studio.example.test");
  assert.ok(h.calls.findIndex(c => c.kind === "invite") > h.calls.findIndex(c => c.kind === "profile.insert"));
  assert.equal(h.calls.find(c => c.kind === "invite").options.redirectTo, "https://studio.example.test/auth/trainer/confirm");
});
test("duplicates and client-editable metadata never adopt an unrelated account", async () => {
  const h = harness({ user: { id, email: input.email, app_metadata: {}, user_metadata: { trainer_onboarding: { application: model.ONBOARDING_APP } } } });
  await assert.rejects(service.beginOnboarding(h.db, h.admin, input), error => !error.resumeId && /already exists/.test(error.message));
  assert.deepEqual(h.calls.map(c => c.kind), ["list"]);
  const pending = harness({ user: ownedUser() });
  await assert.rejects(service.beginOnboarding(pending.db, pending.admin, input), error => error.resumeId === id);
});
test("partial profile failure preserves Auth identity and resumes the same UUID without recreating it", async () => {
  const h = harness({ insertFail: true });
  await assert.rejects(service.beginOnboarding(h.db, h.admin, input), error => error.resumeId === id);
  assert.equal(h.calls.some(c => c.kind === "invite"), false);
  const resumed = harness({ user: h.user });
  await service.ensureTrainerProfile(resumed.db, resumed.admin, resumed.user);
  assert.equal(resumed.record.id, id);
  assert.equal(resumed.calls.some(c => c.kind === "create"), false);
});
test("existing admin or inactive trainer profiles stop onboarding without overwriting them", async () => {
  for (const profile of [{ id, role: "admin", is_active: true }, { id, role: "trainer", is_active: false }]) {
    const h = harness({ user: ownedUser(), profile });
    await assert.rejects(service.ensureTrainerProfile(h.db, h.admin, h.user));
    assert.equal(h.calls.some(c => ["profile.insert", "invite", "metadata"].includes(c.kind)), false);
  }
});
test("email failure retains the linked trainer and never deletes accounts; repeat requests honor cooldown", async () => {
  const h = harness({ emailFail: true });
  await service.beginOnboarding(h.db, h.admin, input);
  await assert.rejects(service.sendTrainerSetup(h.db, h.admin, id, "https://studio.example.test"), /could not be confirmed/);
  assert.equal(h.record.role, "trainer");
  const emails = h.calls.filter(c => c.kind === "invite").length;
  await assert.rejects(service.sendTrainerSetup(h.db, h.admin, id, "https://studio.example.test"), /Wait at least/);
  assert.equal(h.calls.filter(c => c.kind === "invite").length, emails);
});
test("email-confirmed trainers cannot be reinvited as new accounts", async () => {
  const h = harness({ user: ownedUser({ email_confirmed_at: "2026-10-22T00:00:00Z" }), profile: { id, role: "trainer", is_active: true } });
  await assert.rejects(service.sendTrainerSetup(h.db, h.admin, id, "https://studio.example.test"), /password-recovery/);
  assert.equal(h.calls.some(c => c.kind === "invite"), false);
});
function actions({ unauthorized = false, configFailure = false } = {}) {
  const calls = [];
  const exports = load("src/app/admin/(protected)/onboarding-actions.ts", {
    "next/cache": { revalidatePath() {} }, "next/navigation": { redirect() { throw new Error("REDIRECT"); } }, "node:crypto": { randomUUID: () => id },
    "@/lib/supabase/admin": { async requireAdmin() { if (unauthorized) throw new Error("ADMIN_REQUIRED"); return { id: "admin" }; } },
    "@/lib/supabase/server": { async createClient() { calls.push("db"); return {}; } },
    "@/lib/supabase/privileged": { privilegedClient() { calls.push("privileged"); if (configFailure) throw new Error("SECRET_MUST_NOT_LEAK"); return { client: { auth: { admin: {} } }, config: {} }; }, async requireInvitationOnly() { calls.push("signup-check"); } },
    "@/lib/admin/management": management, "@/lib/admin/onboarding": model, "@/lib/admin/onboarding-service": { ...service, async beginOnboarding() { calls.push("create"); return id; } },
  });
  return { ...exports, calls };
}
test("unauthenticated and non-admin requests stop before privileged clients or data access", async () => {
  const h = actions({ unauthorized: true });
  await assert.rejects(h.createTrainer({}, form()), /ADMIN_REQUIRED/);
  await assert.rejects(h.retryTrainerSetup({}, form({ id, intent: "invite", confirm_email: "on" })), /ADMIN_REQUIRED/);
  assert.equal(h.calls.length, 0);
});
test("invalid, unconfirmed and disabled onboarding submissions cannot create accounts or leak configuration", async () => {
  const h = actions({ configFailure: true });
  assert.ok((await h.createTrainer({}, form({ email: "bad" }))).fieldErrors.email);
  assert.equal(h.calls.length, 0);
  assert.match((await h.createTrainer({}, form({ confirm_invitation: "" }))).error, /Confirm/);
  assert.equal(h.calls.length, 0);
  const result = await h.createTrainer({}, form());
  assert.equal(result.error.includes("SECRET_MUST_NOT_LEAK"), false);
  assert.deepEqual(h.calls, ["privileged"]);
});
test("privileged configuration rejects public keys and unsafe sites and remains disabled by default", () => {
  const deps = { "@supabase/supabase-js": {}, "./config": { getSupabaseConfig: () => ({ url: "https://ogzdhmptzeyinhgxcgii.supabase.co", key: "sb_publishable_fixture" }) } };
  const env = { NODE_ENV: "production", SUPABASE_SECRET_KEY: "sb_secret_fixture", APP_SITE_URL: "https://studio.example.test" };
  assert.throws(() => load("src/lib/supabase/privileged.ts", deps, env).onboardingConfig());
  const enabled = { ...env, TRAINER_ONBOARDING_ENABLED: "true" };
  assert.equal(load("src/lib/supabase/privileged.ts", deps, enabled).onboardingConfig().site, env.APP_SITE_URL);
  assert.throws(() => load("src/lib/supabase/privileged.ts", deps, { ...enabled, SUPABASE_SECRET_KEY: "sb_publishable_fixture" }).onboardingConfig());
  for (const site of ["http://studio.example.test", "https://attacker@studio.example.test", "https://studio.example.test/path", "https://studio.example.test/?next=bad"]) assert.throws(() => load("src/lib/supabase/privileged.ts", deps, { ...enabled, APP_SITE_URL: site }).onboardingConfig());
});

test("public signup must be disabled before privileged onboarding writes", async () => {
  const deps = { "@supabase/supabase-js": {}, "./config": {} };
  for (const disabled of [true, false, undefined]) {
    const configuration = load("src/lib/supabase/privileged.ts", deps, {}, { fetch: async () => ({ ok: true, json: async () => ({ disable_signup: disabled }) }) });
    const task = configuration.requireInvitationOnly({ url: "https://fixture.supabase.co", publicKey: "public" });
    if (disabled === true) await task;
    else await assert.rejects(task, /Invitation-only/);
  }
});

function setupHarness({ active = true, role = "trainer", signedIn = true, invalidOtp = false } = {}) {
  const calls = [];
  const user = ownedUser({ email_confirmed_at: "2026-10-22T00:00:00Z" });
  const db = { auth: {
    async getUser() { calls.push("getUser"); return { data: { user: signedIn ? user : null }, error: null }; },
    async verifyOtp() { calls.push("verifyOtp"); return { data: { user }, error: invalidOtp ? { message: "PRIVATE_TOKEN_DATA" } : null }; },
    async updateUser() { calls.push("password-update"); return { data: { user }, error: null }; },
    async signOut() { calls.push("signOut"); return { error: null }; },
  }, from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { calls.push("profile"); return { data: { role, is_active: active }, error: null }; } }; } };
  const actions = load("src/app/auth/trainer/actions.ts", {
    "next/navigation": { redirect(path) { throw new Error(`REDIRECT:${path}`); } },
    "@/lib/supabase/server": { async createClient() { return db; } },
    "@/lib/supabase/privileged": { onboardingConfig() {} },
    "@/lib/admin/onboarding-service": service,
  });
  return { ...actions, calls };
}
test("setup links accept only invite/recovery hashes, never auto-confirm GETs, and reject inactive/admin profiles", async () => {
  const h = setupHarness();
  assert.ok((await h.confirmTrainerLink({}, form({ token_hash: "bad", type: "signup" }))).error);
  assert.equal(h.calls.length, 0);
  for (const options of [{ active: false }, { role: "admin" }]) {
    const blocked = setupHarness(options);
    assert.match((await blocked.confirmTrainerLink({}, form({ token_hash: "a".repeat(64), type: "invite" }))).error, /active linked/);
    assert.ok(blocked.calls.includes("signOut"));
  }
  await assert.rejects(h.confirmTrainerLink({}, form({ token_hash: "a".repeat(64), type: "invite" })), /REDIRECT:\/auth\/trainer\/password/);
  const expired = setupHarness({ invalidOtp: true });
  const error = await expired.confirmTrainerLink({}, form({ token_hash: "a".repeat(64), type: "recovery" }));
  assert.equal(JSON.stringify(error).includes("PRIVATE_TOKEN_DATA"), false);
});
test("password changes require a verified active trainer's own session and never return submitted credentials", async () => {
  const password = "fixture-only-passphrase";
  for (const options of [{ active: false }, { role: "admin" }, { signedIn: false }]) {
    const h = setupHarness(options);
    const result = await h.saveTrainerPassword({}, form({ password, confirmation: password }));
    assert.ok(result.error);
    assert.equal(h.calls.includes("password-update"), false);
    assert.equal(JSON.stringify(result).includes(password), false);
  }
  const h = setupHarness();
  assert.ok((await h.saveTrainerPassword({}, form({ password, confirmation: "different" }))).error);
  assert.equal(h.calls.length, 0);
  await assert.rejects(h.saveTrainerPassword({}, form({ password, confirmation: password })), /REDIRECT:\/auth\/trainer\/complete/);
  assert.ok(h.calls.includes("password-update"));
});
