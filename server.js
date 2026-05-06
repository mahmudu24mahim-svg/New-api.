const express = require("express");
const fs = require("fs");
const axios = require("axios");

const app = express();
app.use(express.json());

// ================= CONFIG =================
const ADMIN_PASS = "admin123";
const MAIN_API_KEY = "unknown34";
const DB_FILE = "./data.json";

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

// ================= HOME =================
app.get("/", (req, res) => {
  res.send(`
  <h1>🚀 API SYSTEM PRO</h1>
  <a href="/admin">Admin Panel</a> | <a href="/user">User Panel</a>
  `);
});

// =================================================
// ================ ADMIN PANEL UI =================
// =================================================
app.get("/admin", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Admin Panel</title>
<style>
body{background:#0f172a;color:#fff;font-family:sans-serif;text-align:center}
.box{width:420px;margin:50px auto;padding:20px;background:#111;border-radius:12px}
input,button{width:90%;padding:10px;margin:5px;border-radius:8px;border:none}
button{background:#06b6d4;color:white;cursor:pointer}
pre{background:#000;text-align:left;padding:10px;height:400px;overflow:auto}
</style>
</head>
<body>

<div class="box">
<h2>🔐 Admin Login</h2>
<input id="pass" placeholder="Password">
<button onclick="login()">Login</button>

<hr>

<h3>Create Key</h3>
<input id="key" placeholder="Key">
<input id="label" placeholder="Label">
<input id="limit" placeholder="Limit">
<input id="days" placeholder="Days">
<button onclick="create()">Create</button>

<h3>Tools</h3>
<button onclick="load()">Load All Keys</button>
<button onclick="history()">History</button>

<input id="search" placeholder="Search Key">
<button onclick="search()">Search</button>

<pre id="out"></pre>
</div>

<script>

function login(){
  if(pass.value === "${ADMIN_PASS}"){
    localStorage.setItem("admin","1");
    alert("Logged In");
  } else alert("Wrong Password");
}

function auth(){
  return localStorage.getItem("admin") === "1";
}

function create(){
  if(!auth()) return alert("Login first");

  fetch("/admin/create?key="+key.value+"&label="+label.value+"&limit="+limit.value+"&days="+days.value)
  .then(r=>r.json())
  .then(d=>{ alert(JSON.stringify(d)); load(); });
}

function load(){
  fetch("/admin/list")
  .then(r=>r.json())
  .then(d=>{
    out.innerText = JSON.stringify(d,null,2);
  });
}

function search(){
  fetch("/admin/search?key="+search.value)
  .then(r=>r.json())
  .then(d=>{
    out.innerText = JSON.stringify(d,null,2);
  });
}

function history(){
  fetch("/admin/history")
  .then(r=>r.json())
  .then(d=>{
    out.innerText = JSON.stringify(d,null,2);
  });
}

</script>

</body>
</html>
  `);
});

// ================= CREATE KEY =================
app.get("/admin/create", (req, res) => {
  const db = loadDB();

  const { key, label, limit, days } = req.query;

  if (!key || !limit) {
    return res.json({ error: "missing data" });
  }

  db.keys[key] = {
    id: genId(),
    label: label || "user",
    limit: Number(limit),
    used: 0,
    created: now(),
    expiry: now() + (Number(days || 1) * 86400000)
  };

  db.history.push({
    type: "CREATE",
    key,
    time: new Date().toISOString()
  });

  saveDB(db);

  res.json({ status: "key created", key });
});

// ================= LIST KEYS =================
app.get("/admin/list", (req, res) => {
  const db = loadDB();

  let list = Object.entries(db.keys).map(([k,v]) => ({
    key: k,
    label: v.label,
    limit: v.limit,
    used: v.used,
    remaining: v.limit - v.used,
    expiry: new Date(v.expiry)
  }));

  res.json(list);
});

// ================= SEARCH =================
app.get("/admin/search", (req, res) => {
  const db = loadDB();
  const k = req.query.key;

  if (!db.keys[k]) return res.json({ status: "not found" });

  res.json(db.keys[k]);
});

// ================= HISTORY =================
app.get("/admin/history", (req, res) => {
  const db = loadDB();
  res.json(db.history);
});

// ================= DELETE =================
app.get("/admin/delete", (req, res) => {
  const db = loadDB();
  const k = req.query.key;

  if (db.keys[k]) {
    delete db.keys[k];

    db.history.push({
      type: "DELETE",
      key: k,
      time: new Date().toISOString()
    });

    saveDB(db);
  }

  res.json({ status: "deleted" });
});

// =================================================
// ================= USER PANEL ====================
// =================================================
app.get("/user", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<style>
body{background:#000;color:#fff;text-align:center;font-family:sans-serif}
.card{width:360px;margin:80px auto;padding:20px;background:#111;border-radius:12px}
input,button{width:90%;padding:10px;margin:5px;border-radius:8px;border:none}
button{background:#22d3ee}
pre{background:#0f172a;padding:10px;border-radius:10px;text-align:left}
</style>
</head>
<body>

<div class="card">
<h2>🔑 Key Checker</h2>

<input id="k" placeholder="API Key">
<button onclick="check()">Check</button>

<pre id="out">Result show here...</pre>
</div>

<script>
function check(){
  fetch("/api/status?key="+k.value)
  .then(r=>r.json())
  .then(d=>{
    out.innerText = JSON.stringify(d,null,2);
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

  if (!u) return res.json({ status: "invalid key" });

  res.json({
    key: req.query.key,
    label: u.label,
    limit: u.limit,
    used: u.used,
    remaining: u.limit - u.used,
    expiry: new Date(u.expiry)
  });
});

// ================= SEND API =================
app.get("/api/send", async (req, res) => {
  const db = loadDB();
  const u = db.keys[req.query.key];

  if (!u) return res.json({ status: "invalid key" });
  if (now() > u.expiry) return res.json({ status: "expired" });
  if (u.used >= u.limit) return res.json({ status: "limit reached" });

  u.used++;

  db.history.push({
    type: "USAGE",
    key: req.query.key,
    time: new Date().toISOString()
  });

  saveDB(db);

  try {
    const url = `http://xlahr.pro.bd/Key/sub.php?key=${MAIN_API_KEY}&number=${req.query.number}&msg=${req.query.msg}`;
    const r = await axios.get(url);

    res.json({
      status: "success",
      response: r.data
    });

  } catch (e) {
    res.json({ status: "api failed" });
  }
});

// ================= START =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 PRO SYSTEM RUNNING"));
