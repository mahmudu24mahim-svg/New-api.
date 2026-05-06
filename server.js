const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// ===== CONFIG =====
const ADMIN_PASSWORD = "admin123";          // change
const MAIN_API_KEY = "unknown34";   // change (fixed, never exposed)
const SESSION_SECRET = "secret_salt_123";   // change

// ===== IN-MEMORY DB =====
let users = {};  // { hashedKey: { label, limit, used, expiry, createdAt, lastHitAt, hitsInWindow } }
let sessions = {}; // { sessionId: true }

// ===== HELPERS =====
const hashKey = (k) => crypto.createHash("sha256").update(k).digest("hex");
const now = () => Date.now();

// simple per-key rate limit (5 req / 10s window)
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

function makeSession(res) {
  const sid = crypto.randomBytes(16).toString("hex");
  sessions[sid] = true;
  res.setHeader("Set-Cookie", `sid=${sid}; Path=/; HttpOnly`);
}

function checkSession(req) {
  const cookie = req.headers.cookie || "";
  const sid = cookie.split("sid=")[1]?.split(";")[0];
  return sid && sessions[sid];
}

// ===== HOME =====
app.get("/", (req, res) => {
  res.send(`
  <h2>🚀 PRO API SYSTEM</h2>
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
    <h3>Login</h3>
    <input id="p"><button onclick="l()">Login</button>
    <script>
    function l(){
      fetch('/admin/login?pass='+p.value).then(r=>r.json()).then(d=>{
        if(d.ok) location.reload(); else alert("Wrong");
      })
    }
    </script>
    `);
  }

  res.send(`
  <html><head>
  <style>
  body{background:#0f172a;color:#fff;font-family:sans-serif;text-align:center}
  .box{background:#1e293b;padding:20px;margin:20px auto;width:320px;border-radius:10px}
  input,button{padding:10px;margin:5px;width:90%}
  table{margin:auto;border-collapse:collapse}
  td,th{border:1px solid #555;padding:6px}
  </style></head><body>

  <div class="box">
  <h3>Create Key</h3>
  <input id="label" placeholder="Label">
  <input id="key" placeholder="API Key">
  <input id="limit" placeholder="Limit">
  <input id="days" placeholder="Days">
  <button onclick="c()">Create</button>
  </div>

  <h3>Keys</h3>
  <table id="tbl"></table>

  <script>
  function c(){
    fetch(\`/admin/create?label=\${label.value}&key=\${key.value}&limit=\${limit.value}&days=\${days.value}\`)
    .then(()=>load())
  }

  function del(k){
    fetch('/admin/delete?key='+k).then(()=>load())
  }

  function load(){
    fetch('/admin/list').then(r=>r.json()).then(d=>{
      let html='<tr><th>Label</th><th>Limit</th><th>Used</th><th>Expiry</th><th>Action</th></tr>';
      Object.entries(d).forEach(([k,v])=>{
        html+=\`<tr>
        <td>\${v.label}</td>
        <td>\${v.limit}</td>
        <td>\${v.used}</td>
        <td>\${new Date(v.expiry).toLocaleString()}</td>
        <td><button onclick="del('\${k}')">X</button></td>
        </tr>\`
      })
      tbl.innerHTML=html;
    })
  }
  load();
  </script>

  </body></html>
  `);
});

// ===== ADMIN APIs =====
app.get("/admin/create", (req, res) => {
  if (!checkSession(req)) return res.json({ err: "auth" });

  const { label, key, limit, days } = req.query;
  const h = hashKey(key);

  users[h] = {
    label,
    limit: Number(limit),
    used: 0,
    expiry: now() + Number(days) * 86400000,
    createdAt: now(),
    hitsInWindow: 0
  };

  res.json({ ok: true });
});

app.get("/admin/list", (req, res) => {
  if (!checkSession(req)) return res.json({});
  res.json(users);
});

app.get("/admin/delete", (req, res) => {
  if (!checkSession(req)) return res.json({});
  delete users[req.query.key];
  res.json({ ok: true });
});

// ===== USER PANEL =====
app.get("/user", (req, res) => {
  res.send(`
  <html><head>
  <style>
  body{background:#020617;color:#fff;text-align:center;font-family:sans-serif}
  .card{background:#1e293b;padding:20px;width:320px;margin:60px auto;border-radius:10px}
  input,button{padding:10px;margin:5px;width:90%}
  </style></head><body>

  <div class="card">
  <h3>Check Key</h3>
  <input id="k" placeholder="API Key">
  <button onclick="c()">Check</button>
  <pre id="o"></pre>
  </div>

  <script>
  function c(){
    fetch('/api/status?key='+k.value).then(r=>r.json()).then(d=>{
      o.innerText=JSON.stringify(d,null,2)
    })
  }
  </script>

  </body></html>
  `);
});

// ===== USER STATUS =====
app.get("/api/status", (req, res) => {
  const h = hashKey(req.query.key);
  const u = users[h];
  if (!u) return res.json({ status: "invalid" });

  res.json({
    limit: u.limit,
    used: u.used,
    remaining: u.limit - u.used,
    expiry: new Date(u.expiry)
  });
});

// ===== MAIN API PROXY =====
app.get("/api/send", async (req, res) => {
  const { key, number, msg } = req.query;

  const h = hashKey(key);
  const u = users[h];

  if (!u) return res.json({ status: "invalid key" });
  if (now() > u.expiry) return res.json({ status: "expired" });
  if (u.used >= u.limit) return res.json({ status: "limit reached" });

  if (!checkRateLimit(u)) {
    return res.json({ status: "rate limit exceeded" });
  }

  u.used++;

  try {
    const url = \`http://xlahr.pro.bd/Key/sub.php?key=\${MAIN_API_KEY}&number=\${number}&msg=\${msg}\`;
    const r = await axios.get(url);

    res.json({
      status: "success",
      data: r.data,
      used: u.used,
      remaining: u.limit - u.used
    });

  } catch {
    res.json({ status: "main api failed" });
  }
});

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 PRO RUNNING"));
