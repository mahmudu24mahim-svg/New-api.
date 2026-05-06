const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const User = require("./db");

const app = express();
app.use(express.json());

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
  <h2>🔥 Admin Panel</h2>

  <input id="pass" placeholder="Admin Pass"><br>
  <input id="key" placeholder="API Key"><br>
  <input id="label" placeholder="Label"><br>
  <input id="limit" placeholder="Limit"><br>
  <input id="days" placeholder="Days"><br>

  <button onclick="create()">Create Key</button>
  <button onclick="load()">Load Keys</button>

  <pre id="out"></pre>

  <script>
  function create(){
    fetch('/admin/create?pass='+pass.value+'&key='+key.value+'&label='+label.value+'&limit='+limit.value+'&days='+days.value)
    .then(r=>r.json()).then(d=>{
      alert(JSON.stringify(d));
      load();
    });
  }

  function load(){
    fetch('/admin/list').then(r=>r.json()).then(d=>{
      out.innerText = JSON.stringify(d,null,2);
    });
  }

  function del(k){
    fetch('/admin/delete?pass='+pass.value+'&key='+k)
    .then(()=>load());
  }
  </script>
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

// ================= DELETE KEY =================
app.get("/admin/delete", async (req,res)=>{
  const { pass,key } = req.query;

  if(pass !== ADMIN_PASS){
    return res.json({ error:"wrong pass" });
  }

  await User.deleteOne({ key });

  res.json({ status:"deleted" });
});

// ================= USER PANEL (PRO UI) =================
app.get("/user",(req,res)=>{
  res.send(`
<html>
<head>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

<style>
body{
  margin:0;
  font-family:sans-serif;
  background:linear-gradient(135deg,#0f172a,#020617);
  color:white;
}

.card{
  width:370px;
  margin:60px auto;
  background:#111827;
  padding:20px;
  border-radius:15px;
  box-shadow:0 0 25px rgba(0,255,255,0.25);
  text-align:center;
}

input{
  width:90%;
  padding:10px;
  margin:10px 0;
  border:none;
  border-radius:8px;
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

.box{
  margin-top:15px;
  background:#0b1220;
  padding:10px;
  border-radius:10px;
  text-align:left;
}
</style>
</head>

<body>

<div class="card">
<h2><i class="fa-solid fa-key"></i> API Key Checker</h2>

<input id="k" placeholder="Enter API Key">
<button onclick="check()">Search Key</button>

<div class="box" id="out"></div>
</div>

<script>
function check(){
  fetch('/api/status?key='+k.value)
  .then(r=>r.json())
  .then(d=>{
    out.innerHTML = `
      <p>🔑 Key: ${d.key || 'Invalid'}</p>
      <p>📛 Label: ${d.label || '-'}</p>
      <p>📊 Limit: ${d.limit || 0}</p>
      <p>⚡ Used: ${d.used || 0}</p>
      <p>🟢 Remaining: ${d.remaining || 0}</p>
      <p>⏳ Expiry: ${d.expiry || '-'}</p>
    `;
  });
}
</script>

</body>
</html>
  `);
});

// ================= STATUS API =================
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
    expiry:new Date(u.expiry),
    percentage_used: Math.floor((u.used/u.limit)*100)+"%"
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
