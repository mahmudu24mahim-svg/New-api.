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

// ================= ADMIN =================
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
    let txt = "";
    d.forEach(v=>{
      txt += "KEY: "+v.key+"\n";
      txt += "LABEL: "+v.label+"\n";
      txt += "LIMIT: "+v.limit+"\n";
      txt += "USED: "+v.used+"\n";
      txt += "EXPIRE: "+new Date(v.expiry).toLocaleString()+"\n";
      txt += "----------------------\n";
    });
    out.innerText = txt;
  });
}

function del(k){
  fetch('/admin/delete?pass='+pass.value+'&key='+k)
  .then(()=>load());
}

</script>

</body>
</html>
  `);
});

// ================= CREATE =================
app.get("/admin/create", async (req,res)=>{
  const { pass,key,label,limit,days } = req.query;

  if(pass !== ADMIN_PASS) return res.json({ error:"wrong pass" });
  if(!key || !limit || !days) return res.json({ error:"missing" });

  await User.create({
    key,
    label: label || "user",
    limit: Number(limit),
    used: 0,
    expiry: Date.now() + Number(days)*86400000
  });

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

  if(pass !== ADMIN_PASS) return res.json({ error:"wrong pass" });

  await User.deleteOne({ key });

  res.json({ status:"deleted" });
});

// ================= USER =================
app.get("/user",(req,res)=>{
  res.send(`
<!DOCTYPE html>
<html>
<head>
<style>
body{
  background:#020617;
  color:#fff;
  font-family:sans-serif;
  text-align:center;
}
.card{
  width:360px;
  margin:80px auto;
  padding:20px;
  background:#111827;
  border-radius:12px;
}
input,button{
  width:90%;
  padding:10px;
  margin:8px;
  border:none;
  border-radius:8px;
}
button{background:#06b6d4;color:#fff}
#out{margin-top:10px;text-align:left}
</style>
</head>
<body>

<div class="card">
<h2>🔑 Key Checker</h2>

<input id="k" placeholder="API Key">
<button onclick="check()">Check</button>

<div id="out">Enter key...</div>
</div>

<script>
function check(){
  fetch('/api/status?key='+k.value)
  .then(r=>r.json())
  .then(d=>{

    if(d.status==="invalid key"){
      out.innerHTML="❌ Invalid Key";
      return;
    }

    out.innerHTML =
    "KEY: "+d.key+"<br>"+
    "LABEL: "+d.label+"<br>"+
    "LIMIT: "+d.limit+"<br>"+
    "USED: "+d.used+"<br>"+
    "REMAINING: "+d.remaining+"<br>"+
    "EXPIRE: "+d.expiry;
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

  if(!u) return res.json({ status:"invalid key" });

  res.json({
    key:u.key,
    label:u.label,
    limit:u.limit,
    used:u.used,
    remaining:u.limit - u.used,
    expiry:new Date(u.expiry)
  });
});

// ================= SEND =================
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
app.listen(process.env.PORT || 3000, ()=>{
  console.log("🚀 SYSTEM RUNNING");
});
