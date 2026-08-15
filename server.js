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
// OBFUSCATE SIÊU CẤP
// =========================
function obfuscateLuaCode(codeText) {
  // 1) XOR với key ngẫu nhiên
  const xorKey = crypto.randomBytes(8);
  const srcBuf = Buffer.from(codeText, "utf-8");
  const xored = Buffer.alloc(srcBuf.length);
  for (let i = 0; i < srcBuf.length; i++) {
    xored[i] = srcBuf[i] ^ xorKey[i % xorKey.length];
  }

  // 2) Base64
  const b64 = xored.toString("base64");

  // 3) Đảo chuỗi + tách thành nhiều chunk
  const reversed = b64.split("").reverse().join("");
  const chunkSize = 40 + Math.floor(Math.random() * 30);
  const chunks = [];
  for (let i = 0; i < reversed.length; i += chunkSize) {
    chunks.push(reversed.slice(i, i + chunkSize));
  }

  // Key XOR dạng số Lua
  const keyLua = Array.from(xorKey).join(",");

  // Tên biến ngẫu nhiên
  const rnd = () => "_" + crypto.randomBytes(4).toString("hex");
  const v = {
    data: rnd(),
    key: rnd(),
    buf: rnd(),
    i: rnd(),
    n: rnd(),
    s: rnd(),
    b64: rnd(),
    rev: rnd(),
    chunk: rnd(),
    parts: rnd(),
    decode: rnd(),
    xor: rnd(),
    load: rnd(),
    fn: rnd(),
    err: rnd(),
    tmp: rnd(),
    junk1: rnd(),
    junk2: rnd(),
    junk3: rnd()
  };

  const partsLua = chunks.map((c) => `"${c}"`).join(",");

  // Junk code nhiễu
  const junk = `
local ${v.junk1} = function() return ${Math.floor(Math.random() * 9999)} end
local ${v.junk2} = {${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 100)}}
local ${v.junk3} = "${crypto.randomBytes(6).toString("hex")}"
if ${v.junk1}() < 0 then print(${v.junk3}) end
`;

  return `--[[
  🔒 LÂM MOD — ULTRA PROTECT
  Unauthorized copy = banned from universe
]]--
${junk}
local ${v.parts} = {${partsLua}}
local ${v.key} = {${keyLua}}
local function ${v.rev}(s)
  return s:reverse()
end
local function ${v.b64}(data)
  local b = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  data = string.gsub(data, "[^"..b.."=]", "")
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
  local out = {}
  local kl = #key
  for ${v.i} = 1, #str do
    local byte = string.byte(str, ${v.i})
    local k = key[((${v.i} - 1) % kl) + 1]
    out[${v.i}] = string.char(bit32 and bit32.bxor(byte, k) or (function(a,b)
      local r, p = 0, 1
      while a > 0 or b > 0 do
        local abit, bbit = a % 2, b % 2
        if abit ~= bbit then r = r + p end
        a, b, p = math.floor(a/2), math.floor(b/2), p * 2
      end
      return r
    end)(byte, k))
  end
  return table.concat(out)
end
local ${v.chunk} = table.concat(${v.parts})
local ${v.data} = ${v.b64}(${v.rev}(${v.chunk}))
local ${v.s} = ${v.xor}(${v.data}, ${v.key})
local ${v.load} = loadstring or load
local ${v.fn}, ${v.err} = ${v.load}(${v.s})
if not ${v.fn} then error("LÂM MOD protect: "..tostring(${v.err})) end
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
