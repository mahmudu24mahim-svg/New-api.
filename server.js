const express = require("express");
const fs = require("fs");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// ================= CONFIG =================
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123";
const MAIN_API_KEY = "unknown34";
const DB_FILE = "./data.json";

// ================= SESSION MEMORY =================
let sessions = {};

// ================= INIT DB =================
function initDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
      keys: {},
      history: []
    }, null, 2));
  }
}

function loadDB() {
  initDB();
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ================= HELPERS =================
function now() {
  return Date.now();
}

function genId() {
  return Math.random().toString(36).substring(2, 10);
}

function createSession() {
  const sid = crypto.randomBytes(16).toString("hex");
  sessions[sid] = true;
  return sid;
}

function getSession(req) {
  const cookie = req.headers.cookie || "";
  const sid = cookie.split("sid=")[1]?.split(";")[0];
  return sid && sessions[sid];
}

function auth(req) {
  return getSession(req) === true;
}

// ================= HOME =================
app.get("/", (req, res) => {
  res.send(`
  <h1>🚀 SECURE API SYSTEM</h1>
  <a href="/admin">Admin Panel</a> | <a href="/user">User Panel</a>
  `);
});

// =================================================
// ================= ADMIN PANEL ===================
// =================================================
app.get("/admin", (req, res) => {

  if (!auth(req)) {
    return res.send(`
<!DOCTYPE html>
<html>
<head>
<style>
body{background:#0f172a;color:#fff;text-align:center;font-family:sans-serif}
.box{width:300px;margin:100px auto;padding:20px;background:#111;border-radius:10px}
input,button{width:90%;padding:10px;margin:5px;border-radius:8px;border:none}
button{background:#06b6d4;color:white}
</style>
</head>
<body>

<div class="box">
<h2>🔐 Admin Login</h2>

<input id="u" placeholder="User">
<input id="p" placeholder="Password">

<button onclick="login()">Login</button>

</div>

<script>
function login(){
  fetch("/admin/login?user="+u.value+"&pass="+p.value)
  .then(r=>r.json())
  .then(d=>{
    if(d.ok){
      document.cookie = "sid="+d.sid;
      location.reload();
    } else alert("Wrong login");
  });
}
</script>

</body>
</html>
    `);
  }

  res.send(`
<!DOCTYPE html>
<html>
<head>
<style>
body{background:#020617;color:#fff;font-family:sans-serif;text-align:center}
.card{width:450px;margin:40px auto;padding:20px;background:#111;border-radius:10px}
input,button{width:90%;padding:10px;margin:5px;border-radius:8px;border:none}
button{background:#22d3ee}
pre{background:#000;padding:10px;height:300px;overflow:auto;text-align:left}
</style>
</head>
<body>

<div class="card">
<h2>🔥 Admin Dashboard</h2>

<h3>Create Key</h3>
<input id="key" placeholder="Key">
<input id="label" placeholder="Label">
<input id="limit" placeholder="Limit">
<input id="days" placeholder="Days">
<button onclick="create()">Create</button>

<h3>Tools</h3>
<button onclick="load()">Load Keys</button>
<button onclick="history()">History</button>
<input id="search" placeholder="Search">
<button onclick="search()">Search</button>

<pre id="out"></pre>
</div>

<script>

function create(){
  fetch("/admin/create?key="+key.value+"&label="+label.value+"&limit="+limit.value+"&days="+days.value)
  .then(r=>r.json()).then(load);
}

function load(){
  fetch("/admin/list")
  .then(r=>r.json())
  .then(d=>out.innerText=JSON.stringify(d,null,2));
}

function search(){
  fetch("/admin/search?key="+search.value)
  .then(r=>r.json())
  .then(d=>out.innerText=JSON.stringify(d,null,2));
}

function history(){
  fetch("/admin/history")
  .then(r=>r.json())
  .then(d=>out.innerText=JSON.stringify(d,null,2));
}

</script>

</body>
</html>
  `);
});

// ================= LOGIN API =================
app.get("/admin/login", (req, res) => {
  const { user, pass } = req.query;

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    const sid = createSession();
    return res.json({ ok: true, sid });
  }

  res.json({ ok: false });
});

// ================= CREATE KEY =================
app.get("/admin/create", (req, res) => {
  if (!auth(req)) return res.json({ error: "unauthorized" });

  const db = loadDB();
  const { key, label, limit, days } = req.query;

  db.keys[key] = {
    id: genId(),
    label,
    limit: Number(limit),
    used: 0,
    expiry: now() + Number(days || 1) * 86400000
  };

  db.history.push({ type: "CREATE", key, time: new Date().toISOString() });

  saveDB(db);

  res.json({ status: "created" });
});

// ================= LIST =================
app.get("/admin/list", (req, res) => {
  if (!auth(req)) return res.json({ error: "unauthorized" });

  const db = loadDB();
  res.json(db.keys);
});

// ================= SEARCH =================
app.get("/admin/search", (req, res) => {
  if (!auth(req)) return res.json({ error: "unauthorized" });

  const db = loadDB();
  const k = req.query.key;

  res.json(db.keys[k] || { status: "not found" });
});

// ================= HISTORY =================
app.get("/admin/history", (req, res) => {
  if (!auth(req)) return res.json({ error: "unauthorized" });

  const db = loadDB();
  res.json(db.history);
});

// ================= USER PANEL =================
app.get("/user", (req, res) => {
res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>API Key Checker</title>

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

<style>
body{
  margin:0;
  font-family:Segoe UI;
  background:linear-gradient(135deg,#0f172a,#020617);
  color:white;
}

.card{
  width:380px;
  margin:100px auto;
  padding:25px;
  background:rgba(255,255,255,0.06);
  border-radius:16px;
  backdrop-filter:blur(12px);
  box-shadow:0 0 25px rgba(0,255,255,0.15);
  text-align:center;
}

h2{
  color:#22d3ee;
}

input{
  width:90%;
  padding:12px;
  margin:10px 0;
  border:none;
  border-radius:10px;
  text-align:center;
  background:#0b1220;
  color:white;
}

button{
  width:95%;
  padding:12px;
  border:none;
  border-radius:10px;
  background:linear-gradient(90deg,#06b6d4,#3b82f6);
  color:white;
  font-weight:bold;
  cursor:pointer;
}

button:hover{transform:scale(1.05);}

#out{
  margin-top:15px;
  text-align:left;
  background:#0b1220;
  padding:12px;
  border-radius:10px;
  border-left:3px solid #22d3ee;
}
</style>
</head>

<body>

<div class="card">

<h2><i class="fa fa-search"></i> KEY CHECKER</h2>

<input id="k" placeholder="Enter API Key">
<button onclick="check()">Search</button>

<div id="out">🔍 Search a key to view details</div>

</div>

<script>

function check(){
  fetch('/api/status?key='+k.value)
  .then(r=>r.json())
  .then(d=>{

    if(d.status === "invalid key"){
      out.innerHTML = "❌ Key Not Found";
      return;
    }

    out.innerHTML = `
      🔑 <b>Key:</b> ${d.key}<br>
      📛 <b>Label:</b> ${d.label}<br>
      📊 <b>Limit:</b> ${d.limit}<br>
      ⚡ <b>Used:</b> ${d.used}<br>
      🟢 <b>Remaining:</b> ${d.remaining}<br>
      ⏳ <b>Expiry:</b> ${new Date(d.expiry).toLocaleString()}
    `;
  });
}

</script>

</body>
</html>
`);
});

// ================= STATUS =================
app.get("/api/status", (req, res) => {
  const db = loadDB();
  const u = db.keys[req.query.key];

  if (!u) return res.json({ status: "invalid" });

  res.json({
    ...u,
    remaining: u.limit - u.used
  });
});

// ================= SEND =================
app.get("/api/send", async (req, res) => {
  const db = loadDB();
  const u = db.keys[req.query.key];

  if (!u) return res.json({ status: "invalid" });
  if (now() > u.expiry) return res.json({ status: "expired" });
  if (u.used >= u.limit) return res.json({ status: "limit reached" });

  u.used++;
  saveDB(db);

  try {
    const url = `http://xlahr.pro.bd/Key/sub.php?key=${MAIN_API_KEY}&number=${req.query.number}&msg=${req.query.msg}`;
    const r = await axios.get(url);

    res.json({ status: "success", data: r.data });

  } catch {
    res.json({ status: "failed" });
  }
});

// ================= START =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 SECURE SYSTEM RUNNING"));
