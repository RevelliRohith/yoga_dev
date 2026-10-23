import fs from "node:fs";
const base = "http://127.0.0.1:3100",
  out = "supabase/review/baselines";
const pages = await (await fetch("http://127.0.0.1:9228/json/list")).json();
const page = pages.find((p) => p.type === "page");
if (!page) throw Error("No isolated browser page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.addEventListener("open", r, { once: true });
  ws.addEventListener("error", j, { once: true });
});
let next = 1;
const pending = new Map(),
  exceptions = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id) {
    const p = pending.get(m.id);
    if (p) {
      pending.delete(m.id);
      if (m.error) p.reject(Error(m.error.message));
      else p.resolve(m.result);
    }
  }
  if (m.method === "Runtime.exceptionThrown")
    exceptions.push(m.params.exceptionDetails.text);
});
function send(method, params = {}) {
  const id = next++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
await send("Page.enable");
await send("Runtime.enable");
const results = [];
for (const [width, height, label] of [
  [1440, 1000, "desktop"],
  [768, 1024, "tablet"],
  [390, 844, "mobile"],
]) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: label === "mobile",
  });
  for (const path of [
    "/",
    "/about",
    "/programs",
    "/trainers",
    "/events",
    "/contact",
    "/trial",
    "/privacy",
  ]) {
    await send("Page.navigate", { url: base + path });
    let ready = false;
    for (let i = 0; i < 50; i++) {
      const r = await send("Runtime.evaluate", {
        expression: `document.readyState==='complete' && location.pathname===${JSON.stringify(path)}`,
        returnByValue: true,
      });
      if (r.result.value) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!ready) throw Error("Page did not load " + path);
    await send("Runtime.evaluate", { expression: "window.scrollTo(0,0)" });
    await new Promise((r) => setTimeout(r, 100));
    const r = await send("Runtime.evaluate", {
      expression: `JSON.stringify({path:location.pathname,width:innerWidth,scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),h1:document.querySelector('h1')?.textContent,disabledForm:location.pathname==='/trial'?!!document.querySelector('fieldset[disabled]'):null})`,
      returnByValue: true,
    });
    const state = JSON.parse(r.result.value);
    state.viewport = label;
    state.pass = state.scrollWidth <= width + 1 && !!state.h1;
    results.push(state);
    if (path === "/" || (path === "/trial" && label === "mobile")) {
      const shot = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(
        `${out}/public-${path === "/" ? "home" : "trial"}-${label}.png`,
        Buffer.from(shot.data, "base64"),
      );
    }
  }
}
for (const path of [
  "/admin/fees",
  "/admin/fees/export",
  "/admin/events",
  "/admin/inquiries",
  "/admin/certificates",
  "/admin/settings",
  "/admin/reminders",
  "/admin/reports",
  "/trainer",
  "/trainer/roster",
]) {
  const r = await fetch(base + path, { redirect: "manual" });
  results.push({
    path,
    status: r.status,
    location: r.headers.get("location"),
    pass:
      [303, 307].includes(r.status) &&
      /\/(admin|trainer)\/login/.test(r.headers.get("location") || ""),
  });
}
fs.writeFileSync(
  `${out}/master-browser-qa.json`,
  JSON.stringify({ results, exceptions }, null, 2),
);
console.log(
  JSON.stringify(
    {
      checks: results.length,
      failed: results.filter((r) => !r.pass),
      browserExceptions: exceptions,
    },
    null,
    2,
  ),
);
await send("Browser.close");
