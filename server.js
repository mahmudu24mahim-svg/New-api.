const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const User = require("./db");

const app = express();

// ===== CONFIG =====
const ADMIN_PASS = "admin123";
const MAIN_API_KEY = "unknown34";

// ===== DB CONNECT =====
mongoose.connect("mongodb+srv://Mahim125:125mahim@cluster0.t5lz8wx.mongodb.net/apiDB?retryWrites=true&w=majority")
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log("DB ERROR:", err));

// ================= HOME =================
app.get("/", (req,res)=>{
  res.send(`
  <h2>🚀 API SYSTEM</h2>
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
input,button{padding:10px;margin:5px;width:250px;border-radius:8px;border:none}
button{cursor:pointer;background:#06b6d4;color:#fff}
.box{margin-top:20px}
</style>
</head>
<body>

<h2>🔥 Admin Panel</h2>

<div class="box">
<input id="pass" placeholder="Admin Pass"><br>
<input id="key" placeholder="API Key"><br>
<input id="label" placeholder="Label"><br>
<input id="limit" placeholder="Limit"><br>
<input id="days" placeholder="Days"><br>

<button onclick="create()">Create Key</button>
<button onclick="load()">Load Keys</button>
</div>

<pre id="out"></pre>

<script>

function create(){
  const pass = document.getElementById("pass").value;
  const key = document.getElementById("key").value;
  const label = document.getElementById("label").value;
  const limit = document.getElementById("limit").value;
  const days = document.getElementById("days").value;

  fetch(\`/admin/create?pass=\${pass}&key=\${key}&label=\${label}&limit=\${limit}&days=\${days}\`)
  .then(r=>r.json())
  .then(d=>{
    alert(JSON.stringify(d));
    load();
  });
}

function load(){
  fetch('/admin/list')
  .then(r=>r.json())
  .then(d=>{
    let html = "";

    d.forEach(v=>{
      html += `
        🔑 ${v.key}
        📛 ${v.label}
        📊 Limit: ${v.limit}
        ⚡ Used: ${v.used}
        ⏳ Expiry: ${new Date(v.expiry).toLocaleString()}
        
        <button onclick="del('${v.key}')">Delete</button>
        -------------------
      `;
    });

    out.innerText = html;
  });
}

function del(k){
  const pass = document.getElementById("pass").value;
  fetch(\`/admin/delete?pass=\${pass}&key=\${k}\`)
  .then(()=>load());
}

</script>

</body>
</html>
  `);
});

// ================= CREATE KEY =================
app.get("/admin/create", async (req,res)=>{
  const { pass,key,label,limit,days } = req.query;

  if(pass !== ADMIN_PASS){
    return res.json({ error:"wrong admin pass" });
  }

  if(!key || !limit || !days){
    return res.json({ error:"missing data" });
  }

  const user = new User({
    key,
    label: label || "user",
    limit: Number(limit),
    used: 0,
    expiry: Date.now() + Number(days)*86400000
  });

  await user.save();

  res.json({ status:"created" });
});

// ================= LIST =================
app.get("/admin/list", async (req,res)=>{
  const data = await User.find();
  res.json(data);
});

// ================= DELETE =================
app.get("/admin/delete", async (req,res)=>{
  const { pass,key } = req.query;

  if(pass !== ADMIN_PASS){
    return res.json({ error:"wrong pass" });
  }

  await User.deleteOne({ key });

  res.json({ status:"deleted" });
});

// ================= USER PANEL =================
app.get("/user",(req,res)=>{
  res.send(`
<!DOCTYPE html>
<html>
<head>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

<style>
body{
  margin:0;
  font-family:sans-serif;
  background:linear-gradient(135deg,#0f172a,#020617);
  color:white;
  text-align:center;
}

.card{
  width:360px;
  margin:80px auto;
  padding:20px;
  background:rgba(255,255,255,0.05);
  border-radius:15px;
}

input{
  width:90%;
  padding:10px;
  margin:10px 0;
  border:none;
  border-radius:8px;
  text-align:center;
}

button{
  width:95%;
  padding:10px;
  background:#06b6d4;
  border:none;
  border-radius:8px;
  color:white;
  cursor:pointer;
}

#out{
  margin-top:10px;
  text-align:left;
  background:#111827;
  padding:10px;
  border-radius:10px;
}
</style>
</head>

<body>

<div class="card">

<h2><i class="fa fa-key"></i> Key Checker</h2>

<input id="k" placeholder="Enter API Key">
<button onclick="check()">Check</button>

<div id="out">Enter key...</div>

</div>

<script>
function check(){
  fetch('/api/status?key='+document.getElementById("k").value)
  .then(r=>r.json())
  .then(d=>{

    if(d.status === "invalid key"){
      out.innerHTML = "❌ Invalid Key";
      return;
    }

    out.innerHTML = `
      🔑 Key: ${d.key}<br>
      📛 Label: ${d.label}<br>
      📊 Limit: ${d.limit}<br>
      ⚡ Used: ${d.used}<br>
      🟢 Remaining: ${d.remaining}<br>
      ⏳ Expiry: ${d.expiry}
    `;
  });
}
</script>

</body>
</html>
  `);
});

// ================= STATUS =================
app.get("/api/status", async (req,res)=>{
  const u = await User.findOne({ key:req.query.key });

  if(!u){
    return res.json({ status:"invalid key" });
  }

  res.json({
    key:u.key,
    label:u.label,
    limit:u.limit,
    used:u.used,
    remaining:u.limit - u.used,
    expiry:new Date(u.expiry)
  });
});

// ================= API SEND =================
app.get("/api/send", async (req,res)=>{
  const { key,number,msg } = req.query;

  const u = await User.findOne({ key });

  if(!u) return res.json({ status:"invalid key" });
  if(Date.now() > u.expiry) return res.json({ status:"expired" });
  if(u.used >= u.limit) return res.json({ status:"limit reached" });

  u.used++;
  await u.save();

  try{
    const url = `http://xlahr.pro.bd/Key/sub.php?key=${MAIN_API_KEY}&number=${number}&msg=${msg}`;
    const r = await axios.get(url);

    res.json({
      status:"success",
      data:r.data,
      used:u.used,
      remaining:u.limit - u.used
    });

  }catch(e){
    res.json({ status:"main api failed" });
  }
});

// ================= START =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log("🚀 SYSTEM RUNNING"));
