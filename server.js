const express = require("express");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

const PORT = process.env.PORT || 10000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_USER = process.env.ADMIN_USER || "LamMOD";
const ADMIN_PASS = process.env.ADMIN_PASS || "hwtyeye7ud";
const adminTokens = new Set();

function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}

function parseCookie(req) {
  const raw = req.headers.cookie || "";
  const out = {};
  raw.split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function isOwner(req) {
  const cookies = parseCookie(req);
  const token = cookies.lam_owner || "";
  return token && adminTokens.has(token);
}

function requireOwnerPage(req, res, next) {
  if (isOwner(req)) return next();
  return res.redirect("/admin");
}

function requireOwnerApi(req, res, next) {
  if (isOwner(req)) return next();
  return res.status(403).json({ error: "Chưa đăng nhập owner" });
}

function parseFlag(val) {
  if (val === undefined || val === null || val === "") return null;
  const s = String(val).trim().toLowerCase();
  if (["yes", "true", "1", "on", "y"].includes(s)) return true;
  if (["no", "false", "0", "off", "n"].includes(s)) return false;
  return null;
}

function shouldObfuscate(req) {
  const fromBody = parseFlag(req.body && req.body.obfuscate);
  if (fromBody !== null) return fromBody;
  const fromQuery = parseFlag(req.query && req.query.obfuscate);
  if (fromQuery !== null) return fromQuery;
  return true;
}

function obfuscateLuaCode(codeText) {
  const xorKey = crypto.randomBytes(16);
  const srcBuf = Buffer.from(codeText, "utf-8");
  const xored = Buffer.alloc(srcBuf.length);
  for (let i = 0; i < srcBuf.length; i++) {
    xored[i] = srcBuf[i] ^ xorKey[i % xorKey.length];
  }

  const b64 = xored.toString("base64");
  const reversed = b64.split("").reverse().join("");
  const chunkSize = 18 + Math.floor(Math.random() * 40);
  const chunks = [];
  for (let i = 0; i < reversed.length; i += chunkSize) {
    chunks.push(reversed.slice(i, i + chunkSize));
  }

  const rnd = () => "_" + crypto.randomBytes(5).toString("hex");
  const used = new Set();
  const unique = () => {
    let n;
    do { n = rnd(); } while (used.has(n));
    used.add(n);
    return n;
  };

  const v = {
    parts: unique(), key: unique(), rev: unique(), b64: unique(),
    xor: unique(), chunk: unique(), data: unique(), s: unique(),
    load: unique(), fn: unique(), err: unique(),
    i: unique(), out: unique(), kl: unique(), byte: unique(), k: unique(),
    a: unique(), b: unique(), r: unique(), p: unique(),
    abit: unique(), bbit: unique(),
    J: unique(), j1: unique(), j2: unique()
  };

  const keyLua = Array.from(xorKey).join(",");
  const partsLua = chunks.map((c) => `"${c}"`).join(",");

  const maxJunk = 8000;
  const minJunk = 400;
  const numJunk = Math.floor(Math.random() * (maxJunk - minJunk + 1)) + minJunk;

  const junkLines = [];
  junkLines.push(`local ${v.J} = {}`);

  for (let i = 0; i < numJunk; i++) {
    const t = Math.floor(Math.random() * 11);
    const key = Math.random() < 0.4 ? i : `"${crypto.randomBytes(3).toString("hex")}"`;
    if (t === 0) junkLines.push(`${v.J}[${key}] = ${Math.floor(Math.random() * 999999)}`);
    else if (t === 1) junkLines.push(`${v.J}[${key}] = "${crypto.randomBytes(4 + (i % 5)).toString("hex")}"`);
    else if (t === 2) junkLines.push(`${v.J}[${key}] = {${Math.floor(Math.random() * 80)}, ${Math.floor(Math.random() * 80)}, "${crypto.randomBytes(2).toString("hex")}"}`);
    else if (t === 3) junkLines.push(`${v.J}[${key}] = function() return ${Math.floor(Math.random() * 4000)} end`);
    else if (t === 4) junkLines.push(`if false then ${v.J}[${key}] = 1 end`);
    else if (t === 5) junkLines.push(`${v.J}[${key}] = (${Math.floor(Math.random() * 30)}*${Math.floor(Math.random() * 30)})%997`);
    else if (t === 6) junkLines.push(`${v.J}[${key}] = function(x) return type(x)=="number" and x*0 or 0 end`);
    else if (t === 7) junkLines.push(`for _=1,${1 + Math.floor(Math.random() * 2)} do ${v.J}[${key}]=_ end`);
    else if (t === 8) junkLines.push(`${v.J}[${key}] = string.rep("${String.fromCharCode(97 + (i % 26))}",${1 + (i % 3)})`);
    else if (t === 9) junkLines.push(`${v.J}[${key}] = {{${Math.floor(Math.random() * 8)}},{${Math.floor(Math.random() * 8)}}}`);
    else junkLines.push(`${v.J}[${key}] = "${crypto.randomBytes(2).toString("hex")}".."${crypto.randomBytes(2).toString("hex")}"`);
  }

  for (let i = 0; i < 12; i++) {
    const fn = unique();
    const a = unique();
    const inner = unique();
    junkLines.push(`local ${fn}=function(${a}) local ${inner}=${Math.floor(Math.random() * 50)} if ${a}==nil then return 0 end return 0 end`);
    junkLines.push(`${v.J}["f${i}"]=${fn}`);
  }

  const junkCode = junkLines.join("\n");

  const banner = `--[[
.____                  ________ ___.    _____                           __                
|    |    __ _______   \\_____  \\\\ _ |___/ ____\\_ __  ______ ____ _____ _/  |_  ___________ 
|    |   |  |  \\__  \\   /   |   \\| __ \\   __\\  |  \\/  ___// ___\\\\__  \\\\   __\\/  _ \\_  __ \\
|    |___|  |  // __ \\_/    |    \\ \\_\\ \\  | |  |  /\\___ \\\\  \\___ / __ \\|  | (  <_> )  | \\/
|_______ \\____/(____  /\\_______  /___  /__| |____//____  >\\___  >____  /__|  \\____/|__|   
        \\/          \\/         \\/    \\/
                  
                  L Â M   M O D
        Obfuscate Protect by Lâm Mod Voltrixvex
]]--`;

  return `${banner}
${junkCode}

local ${v.parts}={${partsLua}}
local ${v.key}={${keyLua}}
local function ${v.rev}(s) return (s or ""):reverse() end
local function ${v.b64}(data)
  local b="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  data=string.gsub(data or "","[^"..b.."=]","")
  return (data:gsub(".",function(x)
    if x=="=" then return "" end
    local r,f="",(b:find(x)-1)
    for i=6,1,-1 do r=r..(f%2^i-f%2^(i-1)>0 and "1" or "0") end
    return r
  end):gsub("%d%d%d?%d?%d?%d?%d?%d?",function(x)
    if #x~=8 then return "" end
    local c=0
    for i=1,8 do c=c+(x:sub(i,i)=="1" and 2^(8-i) or 0) end
    return string.char(c)
  end))
end
local function ${v.xor}(str,key)
  if type(str)~="string" or type(key)~="table" then return "" end
  local ${v.out}={}
  local ${v.kl}=#key
  for ${v.i}=1,#str do
    local ${v.byte}=string.byte(str,${v.i})
    local ${v.k}=key[((${v.i}-1)%${v.kl})+1]
    ${v.out}[${v.i}]=string.char((function(${v.a},${v.b})
      local ${v.r},${v.p}=0,1
      while ${v.a}>0 or ${v.b}>0 do
        local ${v.abit}=${v.a}%2
        local ${v.bbit}=${v.b}%2
        if ${v.abit}~=${v.bbit} then ${v.r}=${v.r}+${v.p} end
        ${v.a}=math.floor(${v.a}/2)
        ${v.b}=math.floor(${v.b}/2)
        ${v.p}=${v.p}*2
      end
      return ${v.r}
    end)(${v.byte},${v.k}))
  end
  return table.concat(${v.out})
end
local ${v.chunk}=table.concat(${v.parts})
local ${v.data}=${v.b64}(${v.rev}(${v.chunk}))
local ${v.s}=${v.xor}(${v.data},${v.key})
local ${v.load}=loadstring or load
local ${v.fn},${v.err}=${v.load}(${v.s})
if not ${v.fn} then error("LÂM MOD: "..tostring(${v.err})) end
return ${v.fn}()
`;
}

function safeFilename(name) {
  return String(name || "")
    .replace(/\\/g, "")
    .replace(/\//g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getBaseUrl(req) {
  const host = req.get("host") || "lam-mod-host.onrender.com";
  return `https://${host}`;
}

function lockPage(filename, msg) {
  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LÂM MOD - Protected</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;background:#080808;color:#fff;font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;padding:20px}
.box{width:90%;max-width:520px;padding:40px 28px;text-align:center;background:#111;border:1px solid #00ffcc44;border-radius:20px}
h1{color:#00ffcc;font-size:1.35rem;margin:10px 0;line-height:1.35}
.filename{color:#666;font-size:.85rem;margin-bottom:18px;word-break:break-all}
p{color:#888;font-size:.9rem;line-height:1.5}
</style></head>
<body><div class="box"><div style="font-size:56px">🔒</div>
<h1>CODE ĐƯỢC BẢO VỆ BỞI<br>LÂM MOD</h1>
<div class="filename">${filename || ""}</div>
<p>${msg || "Mã nguồn này được bảo vệ.<br>Không thể xem trực tiếp trên trình duyệt."}</p>
</div></body></html>`;
}

function loginPage(err) {
  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LÂM MOD — Đăng nhập</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;background:#080808;color:#fff;font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;padding:20px}
.box{width:90%;max-width:420px;padding:36px 28px;background:#111;border:1px solid #00ffcc44;border-radius:20px}
h1{color:#00ffcc;margin-bottom:8px}
p{color:#777;margin-bottom:20px;font-size:14px}
input{width:100%;padding:12px;margin:0 0 12px;background:#1a1a1a;border:1px solid #333;color:#fff;border-radius:10px}
button{width:100%;padding:12px;background:#00ffcc;border:0;border-radius:10px;font-weight:800;cursor:pointer}
.err{color:#ff6b6b;margin-bottom:12px;font-size:14px}
</style></head>
<body><div class="box">
<h1>👑 LÂM MOD</h1>
<p>Đăng nhập owner để quản lý toàn bộ script</p>
${err ? `<div class="err">${err}</div>` : ""}
<form method="POST" action="/admin/login">
<input name="username" value="LamMOD" required>
<input name="password" type="password" placeholder="Mật khẩu" required>
<button type="submit">Đăng nhập</button>
</form>
</div></body></html>`;
}

async function dashboardPage(req) {
  const { data } = await supabase.storage.from("scripts").list("", {
    limit: 1000,
    sortBy: { column: "name", order: "asc" }
  });
  const baseUrl = getBaseUrl(req);
  const files = (data || []).filter((f) => f.name && !f.name.endsWith(".lamkey"));
  const rows = files.map((f) => {
    const encoded = encodeURIComponent(f.name);
    const url = `${baseUrl}/${encoded}`;
    const rawUrl = `${baseUrl}/raw/${encoded}`;
    return `<div class="row">
      <div>
        <div class="name">${f.name}</div>
        <div class="meta">${(f.metadata && f.metadata.size) || 0} bytes</div>
        <div class="link">${rawUrl}</div>
      </div>
      <div class="acts">
        <a href="${rawUrl}" target="_blank">Mở raw</a>
        <form method="POST" action="/admin/delete" onsubmit="return confirm('Xóa ${f.name}?')">
          <input type="hidden" name="filename" value="${f.name}">
          <button class="del" type="submit">Xóa</button>
        </form>
      </div>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LÂM MOD — Owner</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;background:#080808;color:#eee;font-family:Arial,sans-serif;padding:24px}
.wrap{max-width:980px;margin:0 auto}
h1{color:#00ffcc;margin-bottom:6px}
.sub{color:#777;margin-bottom:18px}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px}
.card{background:#111;border:1px solid #00ffcc33;border-radius:16px;padding:8px 18px}
.row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 0;border-bottom:1px solid #222;flex-wrap:wrap}
.name{color:#00ffcc;word-break:break-all}
.meta,.link{color:#666;font-size:12px;word-break:break-all}
.acts{display:flex;gap:8px;align-items:center}
a{color:#00ffcc;font-size:13px}
button,.logout{background:#00ffcc;border:0;padding:8px 12px;border-radius:8px;font-weight:700;cursor:pointer;text-decoration:none;color:#000}
.del{background:#ff4d6d;color:#fff}
.empty{padding:24px;color:#777}
</style></head>
<body><div class="wrap">
<div class="top">
  <div>
    <h1>👑 Owner Lâm Mod</h1>
    <div class="sub">${files.length} script trên server</div>
  </div>
  <a class="logout" href="/admin/logout">Đăng xuất</a>
</div>
<div class="card">
${files.length ? rows : '<div class="empty">Chưa có script nào</div>'}
</div>
</div></body></html>`;
}

app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LÂM MOD</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;background:#080808;color:#fff;font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center}
.box{width:90%;max-width:560px;padding:40px;text-align:center;background:#111;border:1px solid #00ffcc44;border-radius:20px}
h1{color:#00ffcc;margin-bottom:10px}
p{color:#888}
a{color:#00ffcc}
</style></head>
<body><div class="box">
<h1>🔒 LÂM MOD</h1>
<p>Hệ thống lưu trữ và bảo vệ mã nguồn Lua</p>
<p style="margin-top:14px"><a href="/admin">Owner đăng nhập</a></p>
</div></body></html>`);
});

app.get("/admin", async (req, res) => {
  if (isOwner(req)) {
    return res.send(await dashboardPage(req));
  }
  res.send(loginPage());
});

app.post("/admin/login", (req, res) => {
  const username = String(req.body.username || "");
  const password = String(req.body.password || "");
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(403).send(loginPage("Sai tài khoản hoặc mật khẩu"));
  }
  const token = makeToken();
  adminTokens.add(token);
  res.setHeader("Set-Cookie", `lam_owner=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
  res.redirect("/admin");
});

app.get("/admin/logout", (req, res) => {
  const cookies = parseCookie(req);
  if (cookies.lam_owner) adminTokens.delete(cookies.lam_owner);
  res.setHeader("Set-Cookie", "lam_owner=; Path=/; Max-Age=0");
  res.redirect("/admin");
});

app.post("/admin/delete", requireOwnerPage, async (req, res) => {
  const filename = safeFilename(String(req.body.filename || ""));
  if (filename && (filename.includes(".lua") || filename.includes(".txt"))) {
    await supabase.storage.from("scripts").remove([filename, filename + ".lamkey"]);
  }
  res.redirect("/admin");
});

app.get("/raw/:filename", async (req, res) => {
  const filename = safeFilename(req.params.filename);
  if (!filename.includes(".lua") && !filename.includes(".txt")) {
    return res.status(404).send("Not Found");
  }
  const { data, error } = await supabase.storage.from("scripts").download(filename);
  if (error || !data) return res.status(404).send("File not found");
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    return res.send(lockPage(filename, "Link này dành cho executor / HttpGet.<br>Không thể xem trên trình duyệt."));
  }
  const text = await data.text();
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(text);
});

app.get("/:filename", async (req, res) => {
  const filename = safeFilename(req.params.filename);
  if (!filename.includes(".lua") && !filename.includes(".txt")) {
    return res.status(404).send("Not Found");
  }
  if (filename.endsWith(".lamkey")) return res.status(404).send("Not Found");
  const { data, error } = await supabase.storage.from("scripts").download(filename);
  if (error || !data) return res.status(404).send("File not found");
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) return res.send(lockPage(filename));
  const text = await data.text();
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(text);
});

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Chưa chọn file" });

  const filename = safeFilename(req.file.originalname);
  if (!filename.includes(".lua") && !filename.includes(".txt")) {
    return res.status(400).json({ error: "Chỉ cho phép file chứa .lua hoặc .txt" });
  }

  let fileContent = req.file.buffer.toString("utf-8");
  const wantObfuscate = shouldObfuscate(req);
  if (wantObfuscate) fileContent = obfuscateLuaCode(fileContent);

  const { error } = await supabase.storage.from("scripts").upload(
    filename,
    Buffer.from(fileContent, "utf-8"),
    { contentType: "text/plain; charset=utf-8", upsert: true }
  );
  if (error) return res.status(500).json({ error: error.message });

  const deleteKey = crypto.randomBytes(16).toString("hex");
  await supabase.storage.from("scripts").upload(
    filename + ".lamkey",
    Buffer.from(deleteKey, "utf-8"),
    { contentType: "text/plain", upsert: true }
  );

  const baseUrl = getBaseUrl(req);
  const encodedName = encodeURIComponent(filename);
  res.json({
    success: true,
    filename,
    obfuscated: wantObfuscate,
    lines: fileContent.split("\n").length,
    size: fileContent.length,
    url: `${baseUrl}/${encodedName}`,
    rawUrl: `${baseUrl}/raw/${encodedName}`,
    deleteKey
  });
});

app.post("/delete", async (req, res) => {
  const filename = safeFilename(String(req.body.filename || ""));
  const key = String(req.body.key || "");
  if (!filename || (!filename.includes(".lua") && !filename.includes(".txt"))) {
    return res.status(400).json({ error: "Filename không hợp lệ" });
  }
  if (!key || key.length < 8) return res.status(400).json({ error: "Thiếu deleteKey" });

  const { data: keyData, error: keyErr } = await supabase.storage.from("scripts").download(filename + ".lamkey");
  if (keyErr || !keyData) return res.status(403).json({ error: "Không có quyền xóa hoặc file không tồn tại" });
  const realKey = (await keyData.text()).trim();
  if (realKey !== key) return res.status(403).json({ error: "Sai deleteKey" });

  const { error: delErr } = await supabase.storage.from("scripts").remove([filename, filename + ".lamkey"]);
  if (delErr) return res.status(500).json({ error: delErr.message });
  res.json({ success: true, message: "Đã xóa die khỏi server" });
});

app.listen(PORT, () => {
  console.log(`LÂM MOD running on port ${PORT}`);
});
