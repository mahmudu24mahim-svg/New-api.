const express = require("express");
const axios = require("axios");
const fs = require("fs-extra");

const app = express();
app.use(express.json());

// ================= CONFIG =================
const ADMIN_PASS = "admin123";
const MAIN_API_KEY = "unknown34";

const DB_FILE = "./db.json";

// ================= DB HELPERS =================
function loadDB(){
  if(!fs.existsSync(DB_FILE)) fs.writeJsonSync(DB_FILE,{});
  return fs.readJsonSync(DB_FILE);
}

function saveDB(data){
  fs.writeJsonSync(DB_FILE,data,{spaces:2});
}

// ================= HOME =================
app.get("/",(req,res)=>{
  res.send(`
  <h2>🚀 SIMPLE API SYSTEM</h2>
  <a href="/admin">Admin Panel</a> | <a href="/user">User Panel</a>
  `);
});

// ================= ADMIN PANEL =================
app.get("/admin",(req,res)=>{
  res.send(`
<!DOCTYPE html>
<html>
<head>
<style>
body{background:#0f172a;color:#fff;font-family:sans-serif;text-align:center}
.card{width:360px;margin:60px auto;padding:20px;background:#111827;border-radius:12px}
input,button{width:90%;padding:10px;margin:6px;border:none;border-radius:8px}
button{background:#06b6d4;color:#fff;cursor:pointer}
pre{text-align:left;background:#000;padding:10px;border-radius:8px}
</style>
</head>
<body>

<div class="card">

<h2>🔥 Admin Panel</h2>

<input id="pass" placeholder="Admin Pass">
<input id="key" placeholder="API Key">
<input id="label" placeholder="Label">
<input id="limit" placeholder="Limit">
<input id="days" placeholder="Days">

<button onclick="create()">Create</button>
<button onclick="load()">Load</button>

<input id="search" placeholder="Search Key">
<button onclick="find()">Search</button>

<pre id="out">No data</pre>

</div>

<script>

function create(){
 fetch('/admin/create?pass='+pass.value+'&key='+key.value+'&label='+label.value+'&limit='+limit.value+'&days='+days.value)
 .then(r=>r.json()).then(d=>{
   alert(JSON.stringify(d));
   load();
 });
}

function load(){
 fetch('/admin/list')
 .then(r=>r.json())
 .then(d=>{
   out.innerText = JSON.stringify(d,null,2);
 });
}

function find(){
 fetch('/admin/search?key='+search.value)
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
app.get("/admin/create",(req,res)=>{

  if(req.query.pass !== ADMIN_PASS){
    return res.json({ error:"wrong pass" });
  }

  const db = loadDB();

  const { key,label,limit,days } = req.query;

  if(!key || !limit || !days){
    return res.json({ error:"missing fields" });
  }

  db[key] = {
    label: label || "user",
    limit: Number(limit),
    used: 0,
    expiry: Date.now() + Number(days)*86400000
  };

  saveDB(db);

  res.json({ status:"created", key });
});

// ================= LIST =================
app.get("/admin/list",(req,res)=>{
  res.json(loadDB());
});

// ================= SEARCH =================
app.get("/admin/search",(req,res)=>{

  const db = loadDB();
  const key = req.query.key;

  if(!db[key]){
    return res.json({ status:"not found" });
  }

  res.json({ key, ...db[key] });
});

// ================= DELETE =================
app.get("/admin/delete",(req,res)=>{

  if(req.query.pass !== ADMIN_PASS){
    return res.json({ error:"wrong pass" });
  }

  const db = loadDB();
  delete db[req.query.key];
  saveDB(db);

  res.json({ status:"deleted" });
});

// ================= USER PANEL =================
app.get("/user",(req,res)=>{
  res.send(`
<!DOCTYPE html>
<html>
<head>
<style>
body{background:#020617;color:#fff;font-family:sans-serif;text-align:center}
.card{width:350px;margin:70px auto;padding:20px;background:#111827;border-radius:12px}
input,button{width:90%;padding:10px;margin:8px;border:none;border-radius:8px}
button{background:#06b6d4;color:#fff}
#out{text-align:left;margin-top:10px}
</style>
</head>
<body>

<div class="card">

<h2>🔑 Key Checker</h2>

<input id="k" placeholder="Enter Key">
<button onclick="check()">Check</button>

<div id="out">Waiting...</div>

</div>

<script>
function check(){
 fetch('/api/status?key='+k.value)
 .then(r=>r.json())
 .then(d=>{

   if(d.status==="invalid"){
     out.innerHTML="❌ Key Not Found";
     return;
   }

   out.innerHTML =
   "KEY: "+d.key+"<br>"+
   "LABEL: "+d.label+"<br>"+
   "LIMIT: "+d.limit+"<br>"+
   "USED: "+d.used+"<br>"+
   "REMAIN: "+d.remaining+"<br>"+
   "EXPIRE: "+new Date(d.expiry);
 });
}
</script>

</body>
</html>
  `);
});

// ================= STATUS =================
app.get("/api/status",(req,res)=>{

  const db = loadDB();
  const u = db[req.query.key];

  if(!u){
    return res.json({ status:"invalid" });
  }

  res.json({
    key:req.query.key,
    label:u.label,
    limit:u.limit,
    used:u.used,
    remaining:u.limit - u.used,
    expiry:u.expiry
  });
});

// ================= SEND API =================
app.get("/api/send",(req,res)=>{

  const db = loadDB();
  const { key,number,msg } = req.query;

  const u = db[key];

  if(!u) return res.json({ status:"invalid key" });
  if(Date.now() > u.expiry) return res.json({ status:"expired" });
  if(u.used >= u.limit) return res.json({ status:"limit reached" });

  u.used++;
  db[key] = u;
  saveDB(db);

  axios.get(`http://xlahr.pro.bd/Key/sub.php?key=${MAIN_API_KEY}&number=${number}&msg=${msg}`)
  .then(r=>{
    res.json({
      status:"success",
      data:r.data,
      used:u.used,
      remaining:u.limit - u.used
    });
  })
  .catch(()=>{
    res.json({ status:"api failed" });
  });

});

// ================= START =================
app.listen(process.env.PORT || 3000, ()=>{
  console.log("🚀 SYSTEM RUNNING");
});
