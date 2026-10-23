// Manual Stage 3B verification ONLY. No account creation or application-row writes.
// Do not run until the trainer-access migration is explicitly approved and applied.
// Existing users sign in through real Auth; passwords are entered locally, hidden.
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { createClient } from "@supabase/supabase-js";

const mode = process.argv.find(value => value.startsWith("--mode="))?.slice(7);
const modes = ["admin", "anonymous", "active-trainer", "inactive-trainer"];
const expectedHost = "ogzdhmptzeyinhgxcgii.supabase.co";
const rosterFields = ["id", "student_code", "full_name", "program_id", "batch_id", "status"].sort();
let hidden = false;
let terminal;
let client;
let signedIn = false;
let failures = 0;
const output = new Writable({ write(chunk, encoding, done) {
  if (!hidden) process.stdout.write(chunk, encoding);
  done();
} });

class VerificationError extends Error {}
function check(condition, label) {
  process.stdout.write(`${condition ? "PASS" : "FAIL"}: ${label}\n`);
  if (!condition) failures++;
}
function requireResponse(result, stage) {
  if (result.error) {
    const code = /^[a-zA-Z0-9_]{1,64}$/.test(result.error.code ?? "") ? result.error.code : "not_provided";
    const status = Number.isInteger(result.status) ? result.status : "unavailable";
    throw new VerificationError(`${stage} failed (code=${code}; status=${status}). No response body displayed.`);
  }
  return result;
}
async function readRows(query, stage) {
  const result = requireResponse(await query, stage);
  if (!Array.isArray(result.data)) throw new VerificationError(`${stage} returned an unexpected shape.`);
  return result.data;
}
async function hiddenPassword() {
  process.stdout.write("Existing account password (hidden): ");
  hidden = true;
  try { return await terminal.question(""); }
  finally { hidden = false; process.stdout.write("\n"); }
}

try {
  if (!modes.includes(mode)) throw new VerificationError(`Specify --mode=${modes.join("|")}.`);
  const env = parseEnv(readFileSync(new URL("../.env.local", import.meta.url), "utf8"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== expectedHost || parsed.username || parsed.password) {
    throw new VerificationError("Configured project does not match the approved target. Stop and review configuration.");
  }
  if (!key) throw new VerificationError("The publishable key is missing.");
  if (!key.startsWith("sb_publishable_")) {
    let role;
    try { role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role; } catch { /* Reject below. */ }
    if (role !== "anon") throw new VerificationError("Only a publishable/legacy anon key is allowed in this verification tool.");
  }
  process.stdout.write(`Project: ${expectedHost}\nMode: ${mode}\nNo accounts or application records will be created or changed.\n`);
  client = createClient(parsed.origin, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

  let user;
  if (mode !== "anonymous") {
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new VerificationError("Authenticated verification requires an interactive local terminal.");
    terminal = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
    const email = (await terminal.question("Existing test-account email: ")).trim();
    let password = await hiddenPassword();
    const login = await client.auth.signInWithPassword({ email, password });
    password = "";
    if (login.error) throw new VerificationError("Sign-in failed. No credential or Auth response details displayed; this case remains unverified.");
    signedIn = true;
    const verified = await client.auth.getUser();
    if (verified.error || !verified.data.user) throw new VerificationError("Auth user verification failed.");
    user = verified.data.user;
    const profile = requireResponse(await client.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle(), "Own-profile lookup").data;
    const expectedRole = mode === "admin" ? "admin" : "trainer";
    if (profile?.role !== expectedRole || (mode !== "admin" && profile.is_active !== (mode === "active-trainer"))) {
      throw new VerificationError("The existing profile does not match the requested test role/status. No profile was changed.");
    }
  }

  for (const table of ["profiles", "programs", "batches", "students"]) {
    const result = requireResponse(await client.from(table).select("id", { count: "exact", head: true }), `${table} count`);
    if (result.count === null) throw new VerificationError("A count was unavailable; cannot treat it as zero.");
    if (mode === "anonymous" || (mode === "inactive-trainer" && table !== "profiles") || (mode === "active-trainer" && ["programs", "students"].includes(table))) {
      check(result.count === 0, `${table}: forbidden base-table rows are not visible`);
    } else {
      check(result.status >= 200 && result.status < 300, `${table}: permitted count request succeeds (not a CRUD-write test)`);
    }
  }

  if (mode === "anonymous") {
    for (const rpc of ["trainer_dashboard_batches", "trainer_student_roster"]) {
      const result = await client.rpc(rpc);
      check([401, 403].includes(result.status) && result.error?.code === "42501", `${rpc}: anonymous execution denied`);
    }
  } else {
    const batches = await readRows(client.rpc("trainer_dashboard_batches"), "Batch RPC");
    const roster = await readRows(client.rpc("trainer_student_roster"), "Roster RPC");
    if (mode !== "active-trainer") {
      check(batches.length === 0 && roster.length === 0, "Trainer-only RPCs return no rows for this identity");
    } else {
      const direct = await readRows(client.from("batches").select("id,trainer_id"), "Direct batch lookup");
      check(direct.every(batch => batch.trainer_id === user.id), "No other trainer's batch is visible");
      const ownIds = new Set(direct.filter(batch => batch.trainer_id === user.id).map(batch => batch.id));
      check(batches.every(batch => ownIds.has(batch.id)), "Batch RPC results belong to this trainer");
      check(roster.every(student => ownIds.has(student.batch_id)), "Roster results belong to this trainer's batches");
      check(roster.every(student => JSON.stringify(Object.keys(student).sort()) === JSON.stringify(rosterFields)), "Roster output is limited to six approved fields");
      const others = requireResponse(await client.from("profiles").select("id", { count: "exact", head: true }).neq("id", user.id), "Other-profile count");
      check(others.count === 0, "Other profiles are not visible");
      if (!direct.length || !roster.length) {
        process.stdout.write("INCOMPLETE: populated assigned-batch/student cases are needed; empty results do not prove cross-trainer isolation.\n");
        process.exitCode = 2;
      }
      const excluded = await client.rpc("trainer_student_roster").select("email");
      check(excluded.error?.code === "42703", "Excluded email column is absent from the roster return type");
    }
  }
  process.stdout.write("Read checks finished. Repeat for both existing active trainers. Real admin mutations and full assignment comparisons remain separate tests.\n");
  if (failures) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error instanceof VerificationError ? error.message : "Verification could not finish. Review local configuration/connectivity; no raw error displayed."}\n`);
  process.exitCode = 1;
} finally {
  terminal?.close();
  output.end();
  if (signedIn && client) {
    try {
      const result = await client.auth.signOut({ scope: "local" });
      if (result.error) { process.stderr.write("The verification session sign-out was not confirmed.\n"); process.exitCode = 1; }
    } catch { process.stderr.write("The verification session sign-out was not confirmed.\n"); process.exitCode = 1; }
  }
  client = undefined;
}
