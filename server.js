process.on("uncaughtException", err => console.log("CRASH:", err));
process.on("unhandledRejection", err => console.log("PROMISE:", err));

const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const User = require("./db");

const app = express();
app.use(express.json());

// ===== CONFIG =====
const MAIN_API_KEY = "unknown34";

// ===== DB CONNECT =====
mongoose.connect("mongodb+srv://Mahim125:125mahim@cluster0.t5lz8wx.mongodb.net/apiDB?retryWrites=true&w=majority")
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log("DB ERROR:", err));

// ================= HOME =================
app.get("/", (req,res)=>{
  res.send(`
  <h2>🚀 API SYSTEM RUNNING</h2>
  <a href="/admin">Admin Panel</a> | <a href="/user">User Panel</a>
  `);
});

// ================= ADMIN PANEL =================
app.get("/admin",(req,res)=>{
  res.send(`
  <h2>🔥 Admin Panel</h2>

  <input id="key" placeholder="API Key"><br>
  <input id="label" placeholder="Label"><br>
  <input id="limit" placeholder="Limit"><br>
  <input id="days" placeholder="Days"><br>

  <button onclick="create()">Create</button>
  <button onclick="load()">Load</button>

  <pre id="out"></pre>

  <script>
  function create(){
    fetch('/admin/create?key='+key.value+'&label='+label.value+'&limit='+limit.value+'&days='+days.value)
    .then(r=>r.json()).then(()=>load());
  }

  function load(){
    fetch('/admin/list')
    .then(r=>r.json())
    .then(d=>{
      out.innerText = JSON.stringify(d,null,2);
    });
  }

  function del(k){
    fetch('/admin/delete?key='+k).then(()=>load());
  }
  </script>
  `);
});

// ================= CREATE KEY =================
app.get("/admin/create", async (req,res)=>{
  const { key,label,limit,days } = req.query;

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

  res.json({ status:"created", key });
});

// ================= LIST =================
app.get("/admin/list", async (req,res)=>{
  const data = await User.find();
  res.json(data);
});

// ================= DELETE =================
app.get("/admin/delete", async (req,res)=>{
  await User.deleteOne({ key:req.query.key });
  res.json({ status:"deleted" });
});

// ================= USER PANEL =================
app.get("/user",(req,res)=>{
  res.send(`
  <h2>User Panel</h2>

  <input id="k" placeholder="Enter API Key">
  <button onclick="check()">Check</button>

  <pre id="o"></pre>

  <script>
  function check(){
    fetch('/api/status?key='+k.value)
    .then(r=>r.json())
    .then(d=>{
      o.innerText = JSON.stringify(d,null,2);
    });
  }
  </script>
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
    expiry:new Date(u.expiry),
    percentage_used: Math.floor((u.used/u.limit)*100) + "%"
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
