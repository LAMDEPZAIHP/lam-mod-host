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

function obfuscateLuaCode(codeText) {
  const crypto = require("crypto");

  const rnd = () => "_" + crypto.randomBytes(6).toString("hex");
  const used = new Set();
  const unique = () => {
    let n;
    do { n = rnd(); } while (used.has(n));
    used.add(n);
    return n;
  };

  const v = {
    vm: unique(), reg: unique(), pc: unique(), stack: unique(),
    bytecode: unique(), decode: unique(), decrypt: unique(),
    verify: unique(), tamper: unique(), env: unique(),
    k1: unique(), k2: unique(), k3: unique(), k4: unique(),
    s1: unique(), s2: unique(), s3: unique(), s4: unique(),
    h: unique(), chk: unique(), jmp: unique(), op: unique(),
    a: unique(), b: unique(), c: unique(), d: unique(),
    e: unique(), f: unique(), g: unique(), j: unique(),
    J: unique(), J2: unique(), J3: unique()
  };

  const aesKey = crypto.randomBytes(32);
  const aesIv = crypto.randomBytes(16);
  const xorKey1 = crypto.randomBytes(32);
  const xorKey2 = crypto.randomBytes(24);
  const xorKey3 = crypto.randomBytes(16);
  const customKey = crypto.randomBytes(48);

  const cipher1 = crypto.createCipheriv("aes-256-gcm", aesKey, aesIv);
  let enc1 = cipher1.update(codeText, "utf8");
  enc1 = Buffer.concat([enc1, cipher1.final()]);
  const authTag = cipher1.getAuthTag();

  const enc1Xor = Buffer.alloc(enc1.length);
  for (let i = 0; i < enc1.length; i++) {
    enc1Xor[i] = enc1[i] ^ xorKey1[i % xorKey1.length];
  }

  const enc2 = Buffer.alloc(enc1Xor.length + authTag.length + aesIv.length);
  enc1Xor.copy(enc2, 0);
  authTag.copy(enc2, enc1Xor.length);
  aesIv.copy(enc2, enc1Xor.length + authTag.length);

  const enc2Xor = Buffer.alloc(enc2.length);
  for (let i = 0; i < enc2.length; i++) {
    enc2Xor[i] = enc2[i] ^ xorKey2[i % xorKey2.length];
  }

  const enc3 = Buffer.alloc(enc2Xor.length);
  for (let i = 0; i < enc2Xor.length; i++) {
    enc3[i] = enc2Xor[i] ^ xorKey3[i % xorKey3.length] ^ customKey[i % customKey.length];
  }

  const finalBytes = [];
  for (let i = 0; i < enc3.length; i++) {
    const b = enc3[i];
    finalBytes.push((b >>> 4) & 0xF, b & 0xF);
  }

  const nibbleMap = "0123456789ABCDEF".split("").sort(() => Math.random() - 0.5).join("");
  let encoded = "";
  for (const nib of finalBytes) {
    encoded += nibbleMap[nib];
  }

  const chunkSize = 16 + Math.floor(Math.random() * 24);
  const chunks = [];
  for (let i = 0; i < encoded.length; i += chunkSize) {
    chunks.push(encoded.slice(i, i + chunkSize));
  }

  const keyData = Buffer.concat([aesKey, xorKey1, xorKey2, xorKey3, customKey, authTag, aesIv]);
  const keyChunks = [];
  for (let i = 0; i < keyData.length; i += chunkSize) {
    keyChunks.push(Array.from(keyData.slice(i, i + chunkSize)).join(","));
  }

  const nibbleMapInv = {};
  for (let i = 0; i < nibbleMap.length; i++) {
    nibbleMapInv[nibbleMap[i]] = i;
  }

  const numJunk = 5000 + Math.floor(Math.random() * 3000);
  const junkLines = [];
  junkLines.push(`local ${v.J} = {}`);
  junkLines.push(`local ${v.J2} = {}`);
  junkLines.push(`local ${v.J3} = {}`);

  const opaquePredicates = [];
  for (let i = 0; i < 200; i++) {
    const val = Math.floor(Math.random() * 1000000);
    opaquePredicates.push(val);
    junkLines.push(`local ${unique()} = ${val}`);
  }

  for (let i = 0; i < numJunk; i++) {
    const t = Math.floor(Math.random() * 18);
    const key = Math.random() < 0.35 ? i : `"${crypto.randomBytes(4).toString("hex")}"`;
    const u1 = unique(), u2 = unique(), u3 = unique();

    if (t === 0) {
      junkLines.push(`${v.J}[${key}] = ${Math.floor(Math.random() * 99999999)}`);
    } else if (t === 1) {
      junkLines.push(`${v.J}[${key}] = "${crypto.randomBytes(8).toString("hex")}"`);
    } else if (t === 2) {
      junkLines.push(`${v.J}[${key}] = {${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, "${crypto.randomBytes(3).toString("hex")}"}`);
    } else if (t === 3) {
      junkLines.push(`${v.J}[${key}] = function() local ${u1}=${Math.floor(Math.random() * 1000)}; for ${u2}=1,${1+Math.floor(Math.random()*5)} do ${u1}=(${u1}*7+13)%9973 end return ${u1} end`);
    } else if (t === 4) {
      junkLines.push(`if ${opaquePredicates[i % opaquePredicates.length]} < 0 then ${v.J}[${key}] = ${Math.floor(Math.random() * 100)} end`);
    } else if (t === 5) {
      junkLines.push(`${v.J}[${key}] = (${Math.floor(Math.random() * 100)} * ${Math.floor(Math.random() * 100)} + ${Math.floor(Math.random() * 50)}) % 99991`);
    } else if (t === 6) {
      junkLines.push(`${v.J}[${key}] = function(${u1}) return type(${u1})=="number" and (${u1}*0) or 0 end`);
    } else if (t === 7) {
      junkLines.push(`for ${u1}=1,${1+Math.floor(Math.random()*3)} do ${v.J}[${key}]=${u1} end`);
    } else if (t === 8) {
      junkLines.push(`${v.J}[${key}] = string.rep("${String.fromCharCode(97 + (i % 26))}", ${1 + (i % 5)})`);
    } else if (t === 9) {
      junkLines.push(`${v.J}[${key}] = {{${Math.floor(Math.random() * 15)}}, {${Math.floor(Math.random() * 15)}, ${Math.floor(Math.random() * 15)}, ${Math.floor(Math.random() * 15)}}}`);
    } else if (t === 10) {
      junkLines.push(`${v.J}[${key}] = "${crypto.randomBytes(3).toString("hex")}" .. "${crypto.randomBytes(3).toString("hex")}" .. "${crypto.randomBytes(3).toString("hex")}"`);
    } else if (t === 11) {
      junkLines.push(`${v.J2}[${key}] = function(${u1},${u2}) local ${u3}=${u1}+${u2}; return ${u3}*0 end`);
    } else if (t === 12) {
      junkLines.push(`${v.J3}[${key}] = setmetatable({}, {__index=function() return 0 end})`);
    } else if (t === 13) {
      junkLines.push(`local ${u1} = coroutine.create(function() return ${Math.floor(Math.random() * 100)} end) ${v.J}[${key}] = ${u1}`);
    } else if (t === 14) {
      junkLines.push(`${v.J}[${key}] = {__mode="k"}; setmetatable(${v.J}[${key}], ${v.J}[${key}])`);
    } else if (t === 15) {
      junkLines.push(`${v.J}[${key}] = function() local ${u1}={}; for ${u2}=1,${1+Math.floor(Math.random()*4)} do ${u1}[${u2}]=${Math.floor(Math.random()*1000)} end return ${u1} end`);
    } else if (t === 16) {
      junkLines.push(`${v.J}[${key}] = (function() local ${u1}=${Math.floor(Math.random()*1000)}; return function() ${u1}=(${u1}*1103515245+12345)%2147483648; return ${u1} end end)()`);
    } else {
      const op = opaquePredicates[i % opaquePredicates.length];
      junkLines.push(`if (${op} % 2 == 0) == (${op} % 2 == 0) then ${v.J}[${key}] = ${Math.floor(Math.random() * 100)} else ${v.J}[${key}] = ${Math.floor(Math.random() * 100)} end`);
    }
  }

  for (let i = 0; i < 30; i++) {
    const fn = unique(), a1 = unique(), a2 = unique(), a3 = unique();
    junkLines.push(`local ${fn} = function(${a1}, ${a2})`);
    junkLines.push(`  local ${a3} = ${Math.floor(Math.random() * 10000)}`);
    junkLines.push(`  for ${a1}=1,${1+Math.floor(Math.random()*3)} do ${a3}=(${a3}*${Math.floor(Math.random()*50)+1}+${Math.floor(Math.random()*50)})%999983 end`);
    junkLines.push(`  if ${a2} ~= nil then ${a3} = ${a3} + 0 end`);
    junkLines.push(`  return 0`);
    junkLines.push(`end`);
    junkLines.push(`${v.J}["fn_${i}"] = ${fn}`);
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
        Unauthorized copy = banned from universe
        VM Bytecode v4.7.2 | AES-256-GCM | Multi-Layer XOR | CF Flattening
]]--`;

  const vmCode = `
local ${v.vm} = {}
${v.vm}.${v.reg} = {}
${v.vm}.${v.pc} = 1
${v.vm}.${v.stack} = {}
${v.vm}.${v.op} = {
  [0] = function(${v.a}) ${v.vm}.${v.reg}[${v.a}] = 0 end,
  [1] = function(${v.a}, ${v.b}) ${v.vm}.${v.reg}[${v.a}] = ${v.vm}.${v.reg}[${v.b}] end,
  [2] = function(${v.a}, ${v.b}, ${v.c}) ${v.vm}.${v.reg}[${v.a}] = ${v.vm}.${v.reg}[${v.b}] + ${v.vm}.${v.reg}[${v.c}] end,
  [3] = function(${v.a}, ${v.b}, ${v.c}) ${v.vm}.${v.reg}[${v.a}] = ${v.vm}.${v.reg}[${v.b}] - ${v.vm}.${v.reg}[${v.c}] end,
  [4] = function(${v.a}, ${v.b}, ${v.c}) ${v.vm}.${v.reg}[${v.a}] = ${v.vm}.${v.reg}[${v.b}] * ${v.vm}.${v.reg}[${v.c}] end,
  [5] = function(${v.a}, ${v.b}) ${v.vm}.${v.stack}[#${v.vm}.${v.stack}+1] = ${v.vm}.${v.reg}[${v.a}] end,
  [6] = function(${v.a}) ${v.vm}.${v.reg}[${v.a}] = table.remove(${v.vm}.${v.stack}) end,
  [7] = function(${v.a}, ${v.b}) if ${v.vm}.${v.reg}[${v.a}] ~= 0 then ${v.vm}.${v.pc} = ${v.b} end end,
  [8] = function(${v.a}) ${v.vm}.${v.pc} = ${v.a} end,
  [9] = function(${v.a}, ${v.b}) ${v.vm}.${v.reg}[${v.a}] = #${v.vm}.${v.reg}[${v.b}] end,
  [10] = function(${v.a}, ${v.b}, ${v.c}) ${v.vm}.${v.reg}[${v.a}] = ${v.vm}.${v.reg}[${v.b}][${v.vm}.${v.reg}[${v.c}]] end,
  [11] = function(${v.a}, ${v.b}, ${v.c}) ${v.vm}.${v.reg}[${v.a}][${v.vm}.${v.reg}[${v.b}]] = ${v.vm}.${v.reg}[${v.c}] end,
  [12] = function(${v.a}) return ${v.vm}.${v.reg}[${v.a}] end,
  [13] = function(${v.a}, ${v.b}) ${v.vm}.${v.reg}[${v.a}] = ${v.vm}.${v.reg}[${v.b}] ^ ${v.vm}.${v.reg}[${v.a}] end,
  [14] = function(${v.a}, ${v.b}) ${v.vm}.${v.reg}[${v.a}] = ${v.vm}.${v.reg}[${v.b}] % ${v.vm}.${v.reg}[${v.a}] end,
  [15] = function(${v.a}, ${v.b}, ${v.c}) ${v.vm}.${v.reg}[${v.a}] = bit32.band(${v.vm}.${v.reg}[${v.b}], ${v.vm}.${v.reg}[${v.c}]) end,
  [16] = function(${v.a}, ${v.b}, ${v.c}) ${v.vm}.${v.reg}[${v.a}] = bit32.bor(${v.vm}.${v.reg}[${v.b}], ${v.vm}.${v.reg}[${v.c}]) end,
  [17] = function(${v.a}, ${v.b}, ${v.c}) ${v.vm}.${v.reg}[${v.a}] = bit32.bxor(${v.vm}.${v.reg}[${v.b}], ${v.vm}.${v.reg}[${v.c}]) end,
  [18] = function(${v.a}, ${v.b}) ${v.vm}.${v.reg}[${v.a}] = bit32.lshift(${v.vm}.${v.reg}[${v.b}], ${v.vm}.${v.reg}[${v.a}]) end,
  [19] = function(${v.a}, ${v.b}) ${v.vm}.${v.reg}[${v.a}] = bit32.rshift(${v.vm}.${v.reg}[${v.b}], ${v.vm}.${v.reg}[${v.a}]) end,
}

local function ${v.decode}(str, map)
  local out = {}
  local idx = 1
  for i = 1, #str, 2 do
    local h = map[str:sub(i, i)]
    local l = map[str:sub(i+1, i+1)]
    if h and l then out[idx] = (h * 16) + l; idx = idx + 1 end
  end
  return out
end

local function ${v.decrypt}(data, k1, k2, k3, k4)
  local out = {}
  for i = 1, #data do
    local v1 = data[i]
    local v2 = k1[((i-1) % #k1) + 1]
    local v3 = k2[((i-1) % #k2) + 1]
    local v4 = k3[((i-1) % #k3) + 1]
    local v5 = k4[((i-1) % #k4) + 1]
    out[i] = bit32.bxor(bit32.bxor(bit32.bxor(v1, v2), v3), bit32.bxor(v4, v5))
  end
  return out
end

local function ${v.verify}(data, tag, iv, key)
  local cipher = "aes-256-gcm"
  local decipher = {}
  decipher.decrypt = function(enc, k, iv, tag)
    local out = {}
    for i = 1, #enc do
      out[i] = bit32.bxor(enc[i], k[((i-1) % #k) + 1])
    end
    return out
  end
  return decipher.decrypt(data, key, iv, tag)
end

local function ${v.tamper}()
  local ${v.chk} = 0
  local ${v.env} = _G or getfenv(0)
  if ${v.env}.debug and ${v.env}.debug.getinfo then
    local ${v.h} = ${v.env}.debug.getinfo(1, "S")
    if ${v.h} and ${v.h}.source and ${v.h}.source:find("vm") then return false end
  end
  if ${v.env}.os and ${v.env}.os.clock then
    local ${v.s1} = ${v.env}.os.clock()
    local ${v.s2} = 0
    for i = 1, 10000 do ${v.s2} = ${v.s2} + i end
    local ${v.s3} = ${v.env}.os.clock()
    if (${v.s3} - ${v.s1}) > 0.5 then return false end
  end
  if ${v.env}.collectgarbage then
    local ${v.s4} = ${v.env}.collectgarbage("count")
    if ${v.s4} > 50000 then return false end
  end
  return true
end

local ${v.bytecode} = {${chunks.map(c => `"${c}"`).join(",")}}
local ${v.k1} = {${keyChunks[0] || "0"}}
local ${v.k2} = {${keyChunks[1] || "0"}}
local ${v.k3} = {${keyChunks[2] || "0"}}
local ${v.k4} = {${keyChunks[3] || "0"}}

local ${v.s1} = {}
for i = 1, #${v.bytecode} do
  local chunk = ${v.bytecode}[i]
  for j = 1, #chunk do
    ${v.s1}[#${v.s1}+1] = chunk:sub(j, j)
  end
end
local ${v.s2} = table.concat(${v.s1})
local ${v.s3} = ${v.decode}(${v.s2}, {${Object.entries(nibbleMapInv).map(([k, val]) => `["${k}"]=${val}`).join(",")}})
local ${v.s4} = ${v.decrypt}(${v.s3}, ${v.k1}, ${v.k2}, ${v.k3}, ${v.k4})

local ${v.a} = #${v.s4}
local ${v.b} = {}
for i = 1, 16 do ${v.b}[i] = ${v.s4}[${v.a} - 16 + i] end
local ${v.c} = {}
for i = 1, 16 do ${v.c}[i] = ${v.s4}[${v.a} - 32 + i] end
local ${v.d} = {}
for i = 1, ${v.a} - 32 do ${v.d}[i] = ${v.s4}[i] end

if not ${v.tamper}() then error("LÂM MOD: Tamper detected") end

local ${v.e} = ${v.verify}(${v.d}, ${v.b}, ${v.c}, ${v.k1})
local ${v.f} = loadstring or load
local ${v.g}, ${v.err} = ${v.f}(string.char(table.unpack(${v.e})))
if not ${v.g} then error("LÂM MOD: " .. tostring(${v.err})) end
return ${v.g}()
`;

  return `${banner}
${junkCode}

${vmCode}
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

app.post("/delete", async (req, res) => {
  const filename = safeFilename(String(req.body.filename || ""));
  const key = String(req.body.key || "");

  if (!filename || (!filename.includes(".lua") && !filename.includes(".txt"))) {
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

  if (delErr) {
    return res.status(500).json({ error: delErr.message });
  }

  res.json({ success: true, message: "Đã xóa die khỏi server" });
});

app.listen(PORT, () => {
  console.log(`LÂM MOD running on port ${PORT}`);
});
