import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise server modules without Next request globals or live account credentials.
function loadModule(file, dependencies = {}, env = {}) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, URL, atob, process: { env },
    require(name) {
      if (name === "server-only") return {};
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

const publicConfig = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture",
};
const configDependency = { getSupabaseConfig: () => ({ projectHost: "example.supabase.co" }) };

function errorModule(mode) {
  return loadModule("src/lib/supabase/auth-errors.ts", { "./config": configDependency }, { NODE_ENV: mode });
}

test("development preserves actual code/status and excludes raw provider messages", () => {
  const { authFailure } = errorModule("development");
  const result = authFailure("Password sign-in", "Sign-in failed", {
    code: "email_not_confirmed", status: 400, message: "SENSITIVE_PROVIDER_PAYLOAD",
  });
  assert.match(result, /email has not been confirmed/);
  assert.match(result, /code=email_not_confirmed; HTTP=400/);
  assert.doesNotMatch(result, /SENSITIVE_PROVIDER_PAYLOAD/);
  assert.match(authFailure("Password sign-in", "Failed", { status: 0 }), /no HTTP response status/);
});

test("production diagnostics do not expose provider code/status/project", () => {
  const { authFailure } = errorModule("production");
  assert.equal(authFailure("Password sign-in", "Sign-in failed", {
    code: "email_not_confirmed", status: 400,
  }), "Sign-in failed");
});

test("transport diagnostics allowlist nested permission and TLS failures", () => {
  const { networkFailureCode } = loadModule("src/lib/supabase/network-errors.ts");
  assert.equal(networkFailureCode({ cause: { errors: [{ code: "EACCES" }] } }), "EACCES");
  assert.equal(networkFailureCode({ cause: { code: "CERT_HAS_EXPIRED" } }), "CERT_HAS_EXPIRED");
  assert.equal(networkFailureCode({ code: "SENSITIVE_VALUE" }), undefined);
  const result = errorModule("development").authFailure("Password sign-in", "Failed", { status: 0, networkCode: "EACCES" });
  assert.match(result, /denied outbound network access/);
  assert.match(result, /Network=EACCES/);
});

test("public configuration accepts publishable keys and rejects secret/service-role keys", () => {
  const load = env => loadModule("src/lib/supabase/config.ts", {}, { ...publicConfig, ...env });
  assert.equal(load({}).getSupabaseConfig().projectHost, "example.supabase.co");
  assert.throws(() => load({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_fixture" }).getSupabaseConfig());
  const serviceRole = `e30.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.fixture`;
  assert.throws(() => load({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: serviceRole }).getSupabaseConfig());
  assert.throws(() => load({ NEXT_PUBLIC_SUPABASE_URL: "" }).getSupabaseConfig());
});

function actionModule(client, getAdmin) {
  return loadModule("src/app/admin/actions.ts", {
    "next/navigation": { redirect: path => { throw new Error(`REDIRECT:${path}`); } },
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": {
      createClient: async options => {
        assert.equal(options.requireCookieWrites, true);
        return client;
      },
      SessionCookieWriteError: class extends Error {},
    },
    "@/lib/supabase/admin": { getAdmin },
    "@/lib/supabase/auth-errors": errorModule("development"),
    "@/lib/supabase/config": { SupabaseConfigurationError: class extends Error {} },
  }, { NODE_ENV: "development" });
}

function form() {
  const data = new FormData();
  data.set("email", " admin@example.com ");
  data.set("password", " fixture with spaces ");
  return data;
}

test("login passes email/password correctly and preserves the actual token error", async () => {
  const client = { auth: { signInWithPassword: async credentials => {
    assert.equal(credentials.email, "admin@example.com");
    assert.equal(credentials.password, " fixture with spaces ");
    return { error: { code: "invalid_credentials", status: 400, message: "NEVER_DISPLAY" } };
  } } };
  const actions = actionModule(client, () => assert.fail("Role lookup must not run on failed sign-in"));
  const result = await actions.login({ error: "" }, form());
  assert.match(result.error, /token\?grant_type=password/);
  assert.match(result.error, /code=invalid_credentials; HTTP=400/);
  assert.doesNotMatch(result.error, /NEVER_DISPLAY|fixture with spaces/);
});

test("successful sign-in reuses the cookie-writing client for role verification", async () => {
  const client = { auth: { signInWithPassword: async () => ({ error: null }) } };
  const actions = actionModule(client, async received => {
    assert.equal(received, client);
    return { user: { id: "test-admin" }, status: "admin" };
  });
  await assert.rejects(actions.login({ error: "" }, form()), /REDIRECT:\/admin$/);
});

test("non-admin sign-in is denied and its local session is cleared", async () => {
  let signedOut = false;
  const client = { auth: {
    signInWithPassword: async () => ({ error: null }),
    signOut: async options => { assert.equal(options.scope, "local"); signedOut = true; return { error: null }; },
  } };
  const actions = actionModule(client, async () => ({ user: null, status: "forbidden", diagnostic: "Role verification: admin required" }));
  assert.match((await actions.login({ error: "" }, form())).error, /Role verification/);
  assert.equal(signedOut, true);
});

test("profile authorization fails closed for missing rows, trainer roles, and query failures", async () => {
  for (const profile of [
    { data: null, error: null, status: 200 },
    { data: { role: "trainer" }, error: null, status: 200 },
    { data: null, error: { code: "42501", message: "PRIVATE_DETAILS" }, status: 403 },
  ]) {
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: "fixture-id" } }, error: null }) },
      from(table) {
        assert.equal(table, "profiles");
        return { select(column) {
          assert.equal(column, "role");
          return { eq(column, id) {
            assert.equal(column, "id"); assert.equal(id, "fixture-id");
            return { maybeSingle: async () => profile };
          } };
        } };
      },
    };
    const { getAdmin } = loadModule("src/lib/supabase/admin.ts", {
      "next/navigation": {}, "./server": {}, "./auth-errors": errorModule("development"),
    });
    const result = await getAdmin(client);
    assert.equal(result.user, null);
    assert.equal(result.status, profile.error ? "unavailable" : "forbidden");
    assert.doesNotMatch(result.diagnostic, /PRIVATE_DETAILS/);
    if (profile.error) assert.match(result.diagnostic, /code=42501; HTTP=403/);
  }
});
