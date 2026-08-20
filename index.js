const express = require("express");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const PORT = Number(process.env.PORT) || 10000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!ADMIN_USER || !ADMIN_PASS) {
  console.error("Thiếu ADMIN_USER hoặc ADMIN_PASS");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const adminTokens = new Set();
const AUTH_SECRET = process.env.AUTH_SECRET || SUPABASE_SERVICE_ROLE_KEY;
const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidUsername(username) {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString("hex");
}

function signUserToken(username) {
  const payload = Buffer.from(
    JSON.stringify({ u: username, exp: Date.now() + TOKEN_TTL_MS })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyUserToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data || !data.u || data.exp < Date.now()) return null;
    return data.u;
  } catch {
    return null;
  }
}

function accountPath(username) {
  return `_accounts/${username}.json`;
}

async function loadAccount(username) {
  const { data, error } = await supabase.storage.from("scripts").download(accountPath(username));
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text());
  } catch {
    return null;
  }
}

async function saveAccount(account) {
  const { error } = await supabase.storage.from("scripts").upload(
    accountPath(account.username),
    Buffer.from(JSON.stringify(account), "utf8"),
    { contentType: "application/json", upsert: true }
  );
  if (error) throw new Error(error.message);
}

function publicUser(account) {
  return {
    username: account.username,
    scripts: Array.isArray(account.scripts) ? account.scripts : [],
    repos: Array.isArray(account.repos) ? account.repos : [],
  };
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  const cookies = parseCookie(req);
  return cookies.lam_user || "";
}

async function requireUser(req, res, next) {
  const username = verifyUserToken(getBearerToken(req));
  if (!username) return res.status(401).json({ error: "Chưa đăng nhập" });
  const account = await loadAccount(username);
  if (!account) return res.status(401).json({ error: "Tài khoản không tồn tại" });
  req.account = account;
  return next();
}

function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseCookie(req) {
  const raw = req.headers.cookie || "";
  const out = {};
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const key = part.slice(0, i).trim();
    const val = part.slice(i + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function isOwner(req) {
  const token = parseCookie(req).lam_owner || "";
  return Boolean(token) && adminTokens.has(token);
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

function isAllowedScriptName(name) {
  return name.includes(".lua") || name.includes(".txt");
}

function safeFilename(name) {
  return String(name || "")
    .replace(/\\/g, "")
    .replace(/\//g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 180);
}

function getBaseUrl(req) {
  const forwarded = (req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const proto = forwarded || req.protocol || "https";
  const host = req.get("host") || "localhost:" + PORT;
  return `${proto}://${host}`;
}

function obfuscateLuaCode(codeText) {
  const xorKey = crypto.randomBytes(32);
  const srcBuf = Buffer.from(codeText, "utf8");
  const xored = Buffer.alloc(srcBuf.length);

  for (let i = 0; i < srcBuf.length; i++) {
    xored[i] = srcBuf[i] ^ xorKey[i % xorKey.length];
  }

  const reversed = xored.toString("base64").split("").reverse().join("");
  const chunkSize = 15 + Math.floor(Math.random() * 20);
  const chunks = [];
  for (let i = 0; i < reversed.length; i += chunkSize) {
    chunks.push(reversed.slice(i, i + chunkSize));
  }

  const rnd = () =>
    "LamMod_" + crypto.randomBytes(4).toString("hex") + "_" + Math.floor(Math.random() * 999);

  const v = {
    parts: rnd(),
    key: rnd(),
    rev: rnd(),
    b64: rnd(),
    xor: rnd(),
    chunk: rnd(),
    data: rnd(),
    s: rnd(),
    load: rnd(),
    fn: rnd(),
    err: rnd(),
    antiDump: rnd(),
  };

  const keyLua = Array.from(xorKey).join(",");
  const partsLua = chunks.map((c) => JSON.stringify(c)).join(",");

  return `--[[ LÂM MOD PRO ]]--
local ${v.antiDump} = function()
  local i = 0
  if hookfunction or hookmetamethod then i = i + 1 end
  if getgenv and getgenv().hookfunction then i = i + 1 end
  if i > 2 then return false end
  return true
end
if not ${v.antiDump}() then while true do end end

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
  local out={}
  for i=1,#str do
    local byte=string.byte(str,i)
    local k=key[((i-1)%#key)+1]
    out[i]=string.char(bit32 and bit32.bxor(byte,k) or (function()
      local r,p,a,b=0,1,byte,k
      while a>0 or b>0 do
        if a%2 ~= b%2 then r=r+p end
        a=math.floor(a/2) b=math.floor(b/2) p=p*2
      end
      return r
    end)())
  end
  return table.concat(out)
end
local ${v.chunk}=table.concat(${v.parts})
local ${v.data}=${v.b64}(${v.rev}(${v.chunk}))
local ${v.s}=${v.xor}(${v.data},${v.key})
local ${v.load}=loadstring or load
local ${v.fn},${v.err}=${v.load}(${v.s})
if not ${v.fn} then
  error("LÂM MOD: Tamper Detected / "..tostring(${v.err}))
end
return ${v.fn}()
`;
}

function lockPage(filename, rawUrl) {
  const safeName = escapeHtml(filename);
  const loadstringCmd = escapeHtml(`loadstring(game:HttpGet("${rawUrl}", true))()`);

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LÂM MOD - Protected</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100vh;background:#080808;color:#fff;font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;padding:20px}
    .box{width:90%;max-width:550px;padding:40px 28px;text-align:center;background:#111;border:1px solid #00ffcc44;border-radius:20px}
    h1{color:#00ffcc;font-size:1.35rem;margin:10px 0;line-height:1.35}
    .filename{color:#666;font-size:.85rem;margin-bottom:18px;word-break:break-all}
    p{color:#888;font-size:.9rem;line-height:1.5;margin-bottom:20px}
    .code-box{background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:15px;text-align:left;font-family:monospace;color:#00ffcc;word-break:break-all;margin-bottom:15px}
    button{background:#00ffcc;border:0;padding:12px 24px;border-radius:10px;font-weight:bold;cursor:pointer;color:#000;width:100%;font-size:16px}
  </style>
</head>
<body>
  <div class="box">
    <div style="font-size:56px">🛡️</div>
    <h1>MÃ NGUỒN ĐƯỢC BẢO VỆ BỞI LÂM MOD</h1>
    <div class="filename">${safeName}</div>
    <p>Hãy copy đoạn script dưới đây và dán vào Executor của bạn để chạy:</p>
    <div class="code-box" id="scriptCode">${loadstringCmd}</div>
    <button type="button" onclick="copyScript()">Sao chép Script</button>
  </div>
  <script>
    function copyScript() {
      const text = document.getElementById("scriptCode").innerText;
      navigator.clipboard.writeText(text).then(function () {
        alert("Đã sao chép Loadstring!");
      });
    }
  </script>
</body>
</html>`;
}

function loginPage(err) {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
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
  </style>
</head>
<body>
  <div class="box">
    <h1>👑 LÂM MOD</h1>
    <p>Đăng nhập owner để quản lý toàn bộ script</p>
    ${err ? `<div class="err">${escapeHtml(err)}</div>` : ""}
    <form method="POST" action="/admin/login">
      <input name="username" placeholder="Tài khoản" autocomplete="username" required>
      <input name="password" type="password" placeholder="Mật khẩu" autocomplete="current-password" required>
      <button type="submit">Đăng nhập</button>
    </form>
  </div>
</body>
</html>`;
}

async function dashboardPage(req) {
  const { data, error } = await supabase.storage.from("scripts").list("", {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    return `<!DOCTYPE html><html lang="vi"><body>Không đọc được danh sách file</body></html>`;
  }

  const baseUrl = getBaseUrl(req);
  const files = (data || []).filter((f) => f.name && !f.name.endsWith(".lamkey"));

  const rows = files
    .map((f) => {
      const name = escapeHtml(f.name);
      const encoded = encodeURIComponent(f.name);
      const rawUrl = `${baseUrl}/raw/${encoded}`;
      const size = (f.metadata && f.metadata.size) || 0;
      return `<div class="row">
        <div>
          <div class="name">${name}</div>
          <div class="meta">${size} bytes</div>
          <div class="link">${escapeHtml(rawUrl)}</div>
        </div>
        <div class="acts">
          <a href="${escapeHtml(rawUrl)}" target="_blank" rel="noopener">Mở raw</a>
          <form method="POST" action="/admin/delete" onsubmit="return confirm('Xóa file này?')">
            <input type="hidden" name="filename" value="${name}">
            <button class="del" type="submit">Xóa</button>
          </form>
        </div>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
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
  </style>
</head>
<body>
  <div class="wrap">
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
  </div>
</body>
</html>`;
}

async function sendScript(req, res, filename) {
  if (!isAllowedScriptName(filename) || filename.endsWith(".lamkey")) {
    return res.status(404).send("Not Found");
  }

  const { data, error } = await supabase.storage.from("scripts").download(filename);
  if (error || !data) return res.status(404).send("File not found");

  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    const rawUrl = `${getBaseUrl(req)}/raw/${encodeURIComponent(filename)}`;
    return res.send(lockPage(filename, rawUrl));
  }

  const text = await data.text();
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.send(text);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, version: "auth-v2" });
});

app.get("/", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LÂM MOD</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100vh;background:#080808;color:#fff;font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center}
    .box{width:90%;max-width:560px;padding:40px;text-align:center;background:#111;border:1px solid #00ffcc44;border-radius:20px}
    h1{color:#00ffcc;margin-bottom:10px}
    p{color:#888}
    a{color:#00ffcc}
  </style>
</head>
<body>
  <div class="box">
    <h1>🔒 LÂM MOD</h1>
    <p>Hệ thống lưu trữ và bảo vệ mã nguồn Lua</p>
    <p style="margin-top:14px"><a href="/admin">Owner đăng nhập</a></p>
  </div>
</body>
</html>`);
});

app.get("/admin", async (req, res) => {
  if (isOwner(req)) {
    return res.send(await dashboardPage(req));
  }
  return res.send(loginPage());
});

app.post("/admin/login", (req, res) => {
  const username = String(req.body.username || "");
  const password = String(req.body.password || "");

  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(403).send(loginPage("Sai tài khoản hoặc mật khẩu"));
  }

  const token = makeToken();
  adminTokens.add(token);
  res.setHeader(
    "Set-Cookie",
    `lam_owner=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
  );
  return res.redirect("/admin");
});

app.get("/admin/logout", (req, res) => {
  const token = parseCookie(req).lam_owner;
  if (token) adminTokens.delete(token);
  res.setHeader("Set-Cookie", "lam_owner=; Path=/; Max-Age=0");
  return res.redirect("/admin");
});

app.post("/admin/delete", requireOwnerPage, async (req, res) => {
  const filename = safeFilename(String(req.body.filename || ""));
  if (filename && isAllowedScriptName(filename)) {
    await supabase.storage.from("scripts").remove([filename, filename + ".lamkey"]);
  }
  return res.redirect("/admin");
});

app.post("/auth/register", async (req, res) => {
  const username = normalizeUsername(req.body.username);
  const password = String(req.body.password || "");

  if (!isValidUsername(username)) {
    return res.status(400).json({ error: "Tên người dùng 3-20 ký tự, chỉ a-z, 0-9 và _" });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "Mật khẩu ít nhất 4 ký tự" });
  }

  const existing = await loadAccount(username);
  if (existing) return res.status(409).json({ error: "Tên đã tồn tại" });

  const salt = crypto.randomBytes(16).toString("hex");
  const account = {
    username,
    salt,
    passHash: hashPassword(password, salt),
    scripts: [],
    repos: [],
    created: new Date().toISOString(),
  };

  try {
    await saveAccount(account);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const token = signUserToken(username);
  return res.json({ success: true, username, token });
});

app.post("/auth/login", async (req, res) => {
  const username = normalizeUsername(req.body.username);
  const password = String(req.body.password || "");
  const account = await loadAccount(username);

  if (!account) {
    return res.status(403).json({ error: "Sai tên hoặc mật khẩu" });
  }

  const passHash = hashPassword(password, account.salt || "");
  if (passHash !== account.passHash) {
    return res.status(403).json({ error: "Sai tên hoặc mật khẩu" });
  }

  const token = signUserToken(username);
  return res.json({
    success: true,
    username,
    token,
    scripts: account.scripts || [],
    repos: account.repos || [],
  });
});

app.get("/auth/me", requireUser, (req, res) => {
  return res.json({ success: true, ...publicUser(req.account) });
});

app.get("/user/data", requireUser, (req, res) => {
  return res.json({ success: true, ...publicUser(req.account) });
});

app.put("/user/data", requireUser, async (req, res) => {
  const scripts = Array.isArray(req.body.scripts) ? req.body.scripts : req.account.scripts;
  const repos = Array.isArray(req.body.repos) ? req.body.repos : req.account.repos;

  req.account.scripts = scripts;
  req.account.repos = repos;
  req.account.updated = new Date().toISOString();

  try {
    await saveAccount(req.account);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  return res.json({ success: true, ...publicUser(req.account) });
});

app.get("/raw/:filename", async (req, res) => {
  return sendScript(req, res, safeFilename(req.params.filename));
});

app.get("/:filename", async (req, res) => {
  return sendScript(req, res, safeFilename(req.params.filename));
});

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Chưa chọn file" });

  const filename = safeFilename(req.file.originalname);
  if (!isAllowedScriptName(filename)) {
    return res.status(400).json({ error: "Chỉ cho phép file chứa .lua hoặc .txt" });
  }

  let fileContent = req.file.buffer.toString("utf8");
  const wantObfuscate = shouldObfuscate(req);
  if (wantObfuscate) fileContent = obfuscateLuaCode(fileContent);

  const { error } = await supabase.storage.from("scripts").upload(
    filename,
    Buffer.from(fileContent, "utf8"),
    { contentType: "text/plain; charset=utf-8", upsert: true }
  );

  if (error) return res.status(500).json({ error: error.message });

  const deleteKey = crypto.randomBytes(16).toString("hex");
  await supabase.storage.from("scripts").upload(
    filename + ".lamkey",
    Buffer.from(deleteKey, "utf8"),
    { contentType: "text/plain", upsert: true }
  );

  const baseUrl = getBaseUrl(req);
  const encodedName = encodeURIComponent(filename);

  return res.json({
    success: true,
    filename,
    obfuscated: wantObfuscate,
    lines: fileContent.split("\n").length,
    size: fileContent.length,
    url: `${baseUrl}/${encodedName}`,
    rawUrl: `${baseUrl}/raw/${encodedName}`,
    deleteKey,
  });
});

app.post("/delete", async (req, res) => {
  const filename = safeFilename(String(req.body.filename || ""));
  const key = String(req.body.key || "");

  if (!filename || !isAllowedScriptName(filename)) {
    return res.status(400).json({ error: "Filename không hợp lệ" });
  }
  if (!key || key.length < 8) {
    return res.status(400).json({ error: "Thiếu deleteKey" });
  }

  const { data: keyData, error: keyErr } = await supabase.storage
    .from("scripts")
    .download(filename + ".lamkey");

  if (keyErr || !keyData) {
    return res.status(403).json({ error: "Không có quyền xóa hoặc file không tồn tại" });
  }

  const realKey = (await keyData.text()).trim();
  if (realKey !== key) {
    return res.status(403).json({ error: "Sai deleteKey" });
  }

  const { error: delErr } = await supabase.storage
    .from("scripts")
    .remove([filename, filename + ".lamkey"]);

  if (delErr) return res.status(500).json({ error: delErr.message });
  return res.json({ success: true, message: "Đã xóa khỏi server" });
});

app.use((_req, res) => {
  res.status(404).send("Not Found");
});

app.listen(PORT, () => {
  console.log(`LÂM MOD running on port ${PORT}`);
});
