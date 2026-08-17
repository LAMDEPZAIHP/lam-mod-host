const express = require("express");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

const PORT = process.env.PORT || 10000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =========================
// OBFUSCATE SIÊU MẠNH + CODE RÁC SIÊU NHIỀU (200 ~ 8000 dòng)
// =========================
function obfuscateLuaCode(codeText) {
  // ========== LỚP MÃ HÓA SIÊU MẠNH (2 lớp XOR + 2 Base64 + 2 Reverse) ==========
  const key1 = crypto.randomBytes(16); // key chính
  const key2 = crypto.randomBytes(12); // key phụ

  let buf = Buffer.from(codeText, "utf-8");

  // XOR lớp 1
  for (let i = 0; i < buf.length; i++) {
    buf[i] ^= key1[i % key1.length];
  }

  // Base64 lần 1
  let stage = buf.toString("base64");

  // Reverse lần 1
  stage = stage.split("").reverse().join("");

  // XOR lớp 2 (trên bytes của chuỗi đã reverse)
  let buf2 = Buffer.from(stage, "utf-8");
  for (let i = 0; i < buf2.length; i++) {
    buf2[i] ^= key2[i % key2.length];
  }

  // Base64 lần 2
  stage = buf2.toString("base64");

  // Reverse lần 2
  stage = stage.split("").reverse().join("");

  // Chia thành nhiều chunk nhỏ + random size
  const chunkSize = 18 + Math.floor(Math.random() * 35);
  const chunks = [];
  for (let i = 0; i < stage.length; i += chunkSize) {
    chunks.push(stage.slice(i, i + chunkSize));
  }

  // ========== TẠO TÊN BIẾN NGẪU NHIÊN ==========
  const rnd = () => "_" + crypto.randomBytes(5).toString("hex");
  const used = new Set();
  const uniqueRnd = () => {
    let n;
    do {
      n = rnd();
    } while (used.has(n));
    used.add(n);
    return n;
  };

  const v = {
    parts: uniqueRnd(),
    key1: uniqueRnd(),
    key2: uniqueRnd(),
    rev: uniqueRnd(),
    b64: uniqueRnd(),
    xor: uniqueRnd(),
    chunk: uniqueRnd(),
    data: uniqueRnd(),
    tmp1: uniqueRnd(),
    tmp2: uniqueRnd(),
    tmp3: uniqueRnd(),
    s: uniqueRnd(),
    load: uniqueRnd(),
    fn: uniqueRnd(),
    err: uniqueRnd(),
    i: uniqueRnd(),
    out: uniqueRnd(),
    kl: uniqueRnd(),
    byte: uniqueRnd(),
    k: uniqueRnd(),
    a: uniqueRnd(),
    b: uniqueRnd(),
    r: uniqueRnd(),
    p: uniqueRnd(),
    abit: uniqueRnd(),
    bbit: uniqueRnd(),
    j1: uniqueRnd(),
    j2: uniqueRnd(),
    j3: uniqueRnd(),
    j4: uniqueRnd(),
    j5: uniqueRnd()
  };

  const key1Lua = Array.from(key1).join(",");
  const key2Lua = Array.from(key2).join(",");
  const partsLua = chunks.map((c) => `"${c}"`).join(",");

  // ========== TẠO SIÊU NHIỀU CODE RÁC (200 ~ 8000 dòng) ==========
  const maxJunkLines = 8000;
  const minJunkLines = 200;
  const numJunk = Math.floor(Math.random() * (maxJunkLines - minJunkLines + 1)) + minJunkLines;

  const junkLines = [];
  const junkNames = [];

  // Tạo sẵn một đống tên biến junk
  for (let i = 0; i < Math.min(numJunk + 80, 12000); i++) {
    junkNames.push(uniqueRnd());
  }

  let nameIdx = 0;
  const nextName = () => junkNames[nameIdx++] || uniqueRnd();

  for (let i = 0; i < numJunk; i++) {
    const t = Math.floor(Math.random() * 12);
    const n1 = nextName();
    const n2 = nextName();
    const n3 = nextName();

    switch (t) {
      case 0:
        junkLines.push(`local ${n1} = ${Math.floor(Math.random() * 999999)}`);
        break;
      case 1:
        junkLines.push(`local ${n1} = "${crypto.randomBytes(4 + Math.floor(Math.random() * 8)).toString("hex")}"`);
        break;
      case 2:
        junkLines.push(
          `local ${n1} = {${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 100)}, "${crypto.randomBytes(3).toString("hex")}"}`
        );
        break;
      case 3:
        junkLines.push(`local ${n1} = function() return ${Math.floor(Math.random() * 5000)} end`);
        break;
      case 4:
        junkLines.push(
          `if false then local ${n1} = ${Math.floor(Math.random() * 1000)} print(${n1}) end`
        );
        break;
      case 5:
        junkLines.push(
          `local ${n1} = (${Math.floor(Math.random() * 50)} * ${Math.floor(Math.random() * 50)} + ${Math.floor(Math.random() * 20)}) % 997`
        );
        break;
      case 6:
        junkLines.push(`local ${n1} = function(${n2}) return ${n2} and ${Math.floor(Math.random() * 10)} or 0 end`);
        junkLines.push(`local ${n3} = ${n1}(${Math.floor(Math.random() * 20)})`);
        break;
      case 7:
        junkLines.push(`local ${n1} = {[${Math.floor(Math.random() * 5)}] = "${crypto.randomBytes(2).toString("hex")}", a = ${Math.floor(Math.random() * 99)}}`);
        break;
      case 8:
        junkLines.push(
          `local ${n1} = string.rep("${String.fromCharCode(97 + Math.floor(Math.random() * 26))}", ${1 + Math.floor(Math.random() * 3)})`
        );
        break;
      case 9:
        junkLines.push(
          `for ${n1} = 1, ${1 + Math.floor(Math.random() * 3)} do local ${n2} = ${n1} * 2 end`
        );
        break;
      case 10:
        junkLines.push(
          `local ${n1} = {{${Math.floor(Math.random() * 10)}}, {${Math.floor(Math.random() * 10)}, ${Math.floor(Math.random() * 10)}}}`
        );
        break;
      default:
        junkLines.push(
          `local ${n1} = "${crypto.randomBytes(3).toString("hex")}" .. "${crypto.randomBytes(2).toString("hex")}"`
        );
        break;
    }
  }

  // Thêm một số junk function lớn hơn
  for (let i = 0; i < 20; i++) {
    const fn = nextName();
    const a = nextName();
    junkLines.push(`local ${fn} = function(${a})`);
    junkLines.push(`  local ${nextName()} = ${Math.floor(Math.random() * 100)}`);
    junkLines.push(`  if ${a} == nil then return ${Math.floor(Math.random() * 50)} end`);
    junkLines.push(`  return type(${a}) == "number" and ${a} * 0 or 0`);
    junkLines.push(`end`);
  }

  const junkCode = junkLines.join("\n");

  // ========== TEMPLATE DECODER + JUNK ==========
  return `--[[
  🔒 LÂM MOD — ULTRA PROTECT v2
  Multi-layer XOR + Base64 + Reverse + ${numJunk} junk lines
  Unauthorized copy = banned from universe
]]--

${junkCode}

local ${v.parts} = {${partsLua}}
local ${v.key1} = {${key1Lua}}
local ${v.key2} = {${key2Lua}}

local function ${v.rev}(s)
  return (s or ""):reverse()
end

local function ${v.b64}(data)
  local b = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  data = string.gsub(data or "", "[^"..b.."=]", "")
  return (data:gsub(".", function(x)
    if x == "=" then return "" end
    local r, f = "", (b:find(x) - 1)
    for i = 6, 1, -1 do
      r = r .. (f % 2^i - f % 2^(i-1) > 0 and "1" or "0")
    end
    return r
  end):gsub("%d%d%d?%d?%d?%d?%d?%d?", function(x)
    if #x ~= 8 then return "" end
    local c = 0
    for i = 1, 8 do
      c = c + (x:sub(i, i) == "1" and 2^(8-i) or 0)
    end
    return string.char(c)
  end))
end

local function ${v.xor}(str, key)
  if not str or not key then return "" end
  local ${v.out} = {}
  local ${v.kl} = #key
  for ${v.i} = 1, #str do
    local ${v.byte} = string.byte(str, ${v.i})
    local ${v.k} = key[((${v.i} - 1) % ${v.kl}) + 1]
    ${v.out}[${v.i}] = string.char(bit32 and bit32.bxor(${v.byte}, ${v.k}) or (function(${v.a}, ${v.b})
      local ${v.r}, ${v.p} = 0, 1
      while ${v.a} > 0 or ${v.b} > 0 do
        local ${v.abit}, ${v.bbit} = ${v.a} % 2, ${v.b} % 2
        if ${v.abit} ~= ${v.bbit} then ${v.r} = ${v.r} + ${v.p} end
        ${v.a}, ${v.b}, ${v.p} = math.floor(${v.a}/2), math.floor(${v.b}/2), ${v.p} * 2
      end
      return ${v.r}
    end)(${v.byte}, ${v.k}))
  end
  return table.concat(${v.out})
end

-- fake junk calls (không ảnh hưởng)
local ${v.j1} = function() return 0 end
local ${v.j2} = {0, 1, 2}
if ${v.j1}() < -1 then print(${v.j2}[1]) end

local ${v.chunk} = table.concat(${v.parts})
local ${v.tmp1} = ${v.rev}(${v.chunk})
local ${v.tmp2} = ${v.b64}(${v.tmp1})
local ${v.tmp3} = ${v.xor}(${v.tmp2}, ${v.key2})
local ${v.data} = ${v.rev}(${v.tmp3})
local ${v.s} = ${v.xor}(${v.b64}(${v.data}), ${v.key1})

local ${v.load} = loadstring or load
local ${v.fn}, ${v.err} = ${v.load}(${v.s})
if not ${v.fn} then
  error("LÂM MOD protect: "..tostring(${v.err}))
end
return ${v.fn}()
`;
}

function safeFilename(name) {
  return name
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
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LÂM MOD - Protected</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  min-height: 100vh; background: #080808; color: #fff;
  font-family: Arial, sans-serif; display: flex;
  justify-content: center; align-items: center; padding: 20px;
}
.box {
  width: 90%; max-width: 520px; padding: 40px 28px; text-align: center;
  background: #111; border: 1px solid #00ffcc44; border-radius: 20px;
  box-shadow: 0 0 40px #00ffcc18;
}
.lock { font-size: 56px; margin-bottom: 12px; }
h1 { color: #00ffcc; font-size: 1.35rem; margin-bottom: 10px; line-height: 1.35; }
.filename { color: #666; font-size: 0.85rem; margin-bottom: 18px; word-break: break-all; }
p { color: #888; font-size: 0.9rem; line-height: 1.5; }
</style>
</head>
<body>
<div class="box">
  <div class="lock">🔒</div>
  <h1>CODE ĐƯỢC BẢO VỆ BỞI<br>LÂM MOD</h1>
  <div class="filename">${filename || ""}</div>
  <p>${msg || "Mã nguồn này được bảo vệ.<br>Không thể xem trực tiếp trên trình duyệt."}</p>
</div>
</body>
</html>`;
}

// =========================
// TRANG CHỦ
// =========================
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LÂM MOD</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  min-height: 100vh; background: #080808; color: #fff;
  font-family: Arial, sans-serif; display: flex;
  justify-content: center; align-items: center;
}
.box {
  width: 90%; max-width: 560px; padding: 40px; text-align: center;
  background: #111; border: 1px solid #00ffcc44; border-radius: 20px;
  box-shadow: 0 0 40px #00ffcc15;
}
h1 { color: #00ffcc; margin-bottom: 10px; font-size: 1.8rem; }
p { color: #888; font-size: 0.95rem; }
</style>
</head>
<body>
<div class="box">
  <h1>🔒 LÂM MOD</h1>
  <p>Hệ thống lưu trữ và bảo vệ mã nguồn Lua</p>
</div>
</body>
</html>`);
});

// =========================
// RAW — executor / HttpGet
// =========================
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

// =========================
// PROTECTED VIEW
// =========================
app.get("/:filename", async (req, res) => {
  const filename = safeFilename(req.params.filename);
  if (!filename.includes(".lua") && !filename.includes(".txt")) {
    return res.status(404).send("Not Found");
  }

  // Không cho tải file key
  if (filename.endsWith(".lamkey")) {
    return res.status(404).send("Not Found");
  }

  const { data, error } = await supabase.storage.from("scripts").download(filename);
  if (error || !data) return res.status(404).send("File not found");

  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    return res.send(lockPage(filename));
  }

  const text = await data.text();
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(text);
});

// =========================
// UPLOAD + OBFUSCATE
// =========================
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Chưa chọn file" });
  }

  const filename = safeFilename(req.file.originalname);
  if (!filename.includes(".lua") && !filename.includes(".txt")) {
    return res.status(400).json({ error: "Chỉ cho phép file chứa .lua hoặc .txt" });
  }

  let fileContent = req.file.buffer.toString("utf-8");
  const wantObfuscate =
    req.body.obfuscate === "yes" || req.body.obfuscate === "true";

  if (wantObfuscate) {
    fileContent = obfuscateLuaCode(fileContent);
  }

  const { error } = await supabase.storage
    .from("scripts")
    .upload(filename, Buffer.from(fileContent, "utf-8"), {
      contentType: "text/plain; charset=utf-8",
      upsert: true
    });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Tạo deleteKey — chỉ ai có key mới xóa được
  const deleteKey = crypto.randomBytes(16).toString("hex");
  await supabase.storage
    .from("scripts")
    .upload(filename + ".lamkey", Buffer.from(deleteKey, "utf-8"), {
      contentType: "text/plain",
      upsert: true
    });

  const baseUrl = getBaseUrl(req);
  const encodedName = encodeURIComponent(filename);

  res.json({
    success: true,
    filename: filename,
    obfuscated: wantObfuscate,
    url: `${baseUrl}/${encodedName}`,
    rawUrl: `${baseUrl}/raw/${encodedName}`,
    deleteKey: deleteKey
  });
});

// =========================
// XÓA DIE — xóa thật trên server
// =========================
app.post("/delete", async (req, res) => {
  const filename = safeFilename(String(req.body.filename || ""));
  const key = String(req.body.key || "");

  if (!filename || (!filename.includes(".lua") && !filename.includes(".txt"))) {
    return res.status(400).json({ error: "Filename không hợp lệ" });
  }
  if (!key || key.length < 8) {
    return res.status(400).json({ error: "Thiếu deleteKey" });
  }

  // Kiểm tra key
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

  // Xóa file + key
  const { error: delErr } = await supabase.storage
    .from("scripts")
    .remove([filename, filename + ".lamkey"]);

  if (delErr) {
    return res.status(500).json({ error: delErr.message });
  }

  res.json({ success: true, message: "Đã xóa die khỏi server" });
});

app.listen(PORT, () => {
  console.log(`LÂM MOD running on port ${PORT}`);
});
