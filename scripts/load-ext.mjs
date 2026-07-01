const EXT = "/srv/appdata/aidict/dist";
const ver = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
let id = 0; const pend = {};
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend[i] = { res, rej }; ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => rej(new Error("timeout " + m)), 15000); });
ws.onmessage = (e) => { const d = JSON.parse(e.data); if (d.id && pend[d.id]) { d.error ? pend[d.id].rej(new Error(d.error.message)) : pend[d.id].res(d.result); delete pend[d.id]; } };
await new Promise((r) => (ws.onopen = r));
try { console.log(JSON.stringify(await send("Extensions.loadUnpacked", { path: EXT }))); }
catch (err) { console.log("load failed:", err.message); }
ws.close();
