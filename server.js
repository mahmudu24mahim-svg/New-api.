process.on('uncaughtException', err => {
  console.log("CRASH ERROR:", err);
});

process.on('unhandledRejection', err => {
  console.log("PROMISE ERROR:", err);
});

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// ===== CONFIG =====
const ADMIN_PASSWORD = "admin123";
const MAIN_API_KEY = "unknown34";

// ===== IN-MEMORY DB =====
let users = {};
let sessions = {};

// ===== HELPERS =====
const hashKey = (k) => crypto.createHash("sha256").update(k).digest("hex");
const now = () => Date.now();

// ===== RATE LIMIT =====
function checkRateLimit(u) {
  const WINDOW = 10000;
  const MAX = 5;

  if (!u.lastHitAt || now() - u.lastHitAt > WINDOW) {
    u.lastHitAt = now();
    u.hitsInWindow = 1;
    return true;
  }

  if (u.hitsInWindow < MAX) {
    u.hitsInWindow++;
    return true;
  }

  return false;
}

// ===== SESSION =====
function makeSession(res) {
  const sid = crypto.randomBytes(16).toString("hex");
  sessions[sid] = true;
  res.setHeader("Set-Cookie", `sid=${sid}; Path=/; HttpOnly`);
}

function checkSession(req) {
  const cookie = req.headers.cookie || "";

  if (!cookie.includes("sid=")) return false;

  const sid = cookie.split("sid=")[1].split(";")[0];

  return sessions[sid] || false;
}

// ===== HOME =====
app.get("/", (req, res) => {
  res.send(`
  <h2>🚀 API SYSTEM RUNNING</h2>
  <a href="/admin">Admin</a> | <a href="/user">User</a>
  `);
});

// ===== ADMIN LOGIN =====
app.get("/admin/login", (req, res) => {
  const { pass } = req.query;

  if (pass === ADMIN_PASSWORD) {
    makeSession(res);
    return res.json({ ok: true });
  }

  res.json({ ok: false });
});

// ===== ADMIN PANEL =====
app.get("/admin", (req, res) => {

  if (!checkSession(req)) {
    return res.send(`
    <h3>Admin Login</h3>
    <input id="p" placeholder="Password">
    <button onclick="l()">Login</button>

    <script>
    function l(){
      fetch('/admin/login?pass='+p.value)
      .then(r=>r.json())
      .then(d=>{
        if(d.ok) location.reload();
        else alert("Wrong password");
      });
    }
    </script>
    `);
  }

  res.send(`
  <html>
  <body style="background:#111;color:#fff;text-align:center;font-family:sans-serif">

  <h2>Admin Panel</h2>

  <input id="label" placeholder="Label"><br>
  <input id="key" placeholder="API Key"><br>
  <input id="limit" placeholder="Limit"><br>
  <input id="days" placeholder="Days"><br>
  <button onclick="create()">Create</button>

  <h3>Users</h3>
  <pre id="out"></pre>

  <script>
  function create(){
    fetch(\`/admin/create?label=\${label.value}&key=\${key.value}&limit=\${limit.value}&days=\${days.value}\`)
    .then(r=>r.json())
    .then(()=>load());
  }

  function del(k){
    fetch('/admin/delete?key='+k)
    .then(()=>load());
  }

  function load(){
    fetch('/admin/list')
    .then(r=>r.json())
    .then(d=>{
      let txt = "";
      Object.entries(d).forEach(([k,v])=>{
        txt += "KEY: "+k+"\\n";
        txt += JSON.stringify(v,null,2)+"\\n";
        txt += "----------------------\\n";
      });
      out.innerText = txt;
    });
  }

  load();
  </script>

  </body>
  </html>
  `);
});

// ===== CREATE KEY =====
app.get("/admin/create", (req, res) => {
  if (!checkSession(req)) return res.json({ error: "auth" });

  const { label, key, limit, days } = req.query;

  if (!key || !limit || !days) {
    return res.json({ error: "missing data" });
  }

  const h = hashKey(key);

  users[h] = {
    label: label || "user",
    limit: Number(limit),
    used: 0,
    expiry: now() + Number(days) * 86400000,
    createdAt: now(),
    hitsInWindow: 0
  };

  res.json({ status: "created", key });
});

// ===== LIST =====
app.get("/admin/list", (req, res) => {
  if (!checkSession(req)) return res.json({});
  res.json(users);
});

// ===== DELETE =====
app.get("/admin/delete", (req, res) => {
  if (!checkSession(req)) return res.json({ error: "auth" });

  const key = req.query.key;

  if (!key) return res.json({ error: "missing key" });

  delete users[hashKey(key)];

  res.json({ status: "deleted" });
});

// ===== USER PANEL =====
app.get("/user", (req, res) => {
  res.send(`
  <html>
  <body style="background:#000;color:#fff;text-align:center;font-family:sans-serif">

  <h2>User Panel</h2>

  <input id="k" placeholder="Enter API Key">
  <button onclick="c()">Check</button>

  <pre id="o"></pre>

  <script>
  function c(){
    fetch('/api/status?key='+k.value)
    .then(r=>r.json())
    .then(d=>{
      o.innerText = JSON.stringify(d,null,2);
    });
  }
  </script>

  </body>
  </html>
  `);
});

// ===== STATUS =====
app.get("/api/status", (req, res) => {
  const key = req.query.key;

  if (!key) return res.json({ error: "missing key" });

  const u = users[hashKey(key)];

  if (!u) return res.json({ status: "invalid" });

  res.json({
    limit: u.limit,
    used: u.used,
    remaining: u.limit - u.used,
    expiry: new Date(u.expiry)
  });
});

// ===== SEND API =====
app.get("/api/send", async (req, res) => {
  const { key, number, msg } = req.query;

  if (!key || !number || !msg) {
    return res.json({ error: "missing params" });
  }

  const u = users[hashKey(key)];

  if (!u) return res.json({ status: "invalid key" });

  if (now() > u.expiry) return res.json({ status: "expired" });

  if (u.used >= u.limit) return res.json({ status: "limit reached" });

  if (!checkRateLimit(u)) {
    return res.json({ status: "rate limit exceeded" });
  }

  u.used++;

  try {
    const url = `http://xlahr.pro.bd/Key/sub.php?key=${MAIN_API_KEY}&number=${number}&msg=${msg}`;
    const r = await axios.get(url);

    res.json({
      status: "success",
      data: r.data,
      used: u.used,
      remaining: u.limit - u.used
    });

  } catch (e) {
    res.json({ status: "main api failed" });
  }
});

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 RUNNING OK"));
