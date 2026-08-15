const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

const PORT = process.env.PORT || 10000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =========================
// OBFUSCATE
// =========================
function obfuscateLuaCode(codeText) {
  const encoded = Buffer.from(codeText, "utf-8").toString("base64");
  return `--[[ 
  Protected by LÂM MOD Obfuscator 
]]--
local encodedData = "${encoded}";
-- Code obfuscated successfully`;
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
  min-height: 100vh;
  background: #080808;
  color: #fff;
  font-family: Arial, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
}
.box {
  width: 90%;
  max-width: 560px;
  padding: 40px;
  text-align: center;
  background: #111;
  border: 1px solid #00ffcc44;
  border-radius: 20px;
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
// RAW — luôn trả source (cho executor / game / tool)
// =========================
app.get("/raw/:filename", async (req, res) => {
  const filename = safeFilename(req.params.filename);

  if (!filename.includes(".lua") && !filename.includes(".txt")) {
    return res.status(404).send("Not Found");
  }

  const { data, error } = await supabase.storage
    .from("scripts")
    .download(filename);

  if (error || !data) {
    return res.status(404).send("File not found");
  }

  const accept = req.headers.accept || "";

  // Trình duyệt mở /raw → cũng chỉ thấy khóa (không lộ code)
  // HttpGet / executor / fetch JS (Accept thường là */*) → vẫn lấy được source
  if (accept.includes("text/html")) {
    return res.send(`<!DOCTYPE html>
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
p { color: #888; font-size: 0.9rem; line-height: 1.5; }
</style>
</head>
<body>
<div class="box">
  <div class="lock">🔒</div>
  <h1>CODE ĐƯỢC BẢO VỆ BỞI<br>LÂM MOD</h1>
  <p>Link này dành cho executor / HttpGet.<br>Không thể xem trên trình duyệt.</p>
</div>
</body>
</html>`);
  }

  const text = await data.text();
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(text);
});

// =========================
// PROTECTED VIEW
// - Trình duyệt (Accept: text/html) → chỉ hiện khóa, KHÔNG hiện code
// - Tool / executor / curl → trả source
// =========================
app.get("/:filename", async (req, res) => {
  const filename = safeFilename(req.params.filename);

  if (!filename.includes(".lua") && !filename.includes(".txt")) {
    return res.status(404).send("Not Found");
  }

  const { data, error } = await supabase.storage
    .from("scripts")
    .download(filename);

  if (error || !data) {
    return res.status(404).send("File not found");
  }

  const accept = req.headers.accept || "";

  // === TRÌNH DUYỆT → trang khóa, KHÔNG hiện code ===
  if (accept.includes("text/html")) {
    return res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LÂM MOD - Protected</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  min-height: 100vh;
  background: #080808;
  color: #fff;
  font-family: Arial, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}
.box {
  width: 90%;
  max-width: 520px;
  padding: 40px 28px;
  text-align: center;
  background: #111;
  border: 1px solid #00ffcc44;
  border-radius: 20px;
  box-shadow: 0 0 40px #00ffcc18;
}
.lock { font-size: 56px; margin-bottom: 12px; }
h1 {
  color: #00ffcc;
  font-size: 1.35rem;
  margin-bottom: 10px;
  line-height: 1.35;
}
.filename {
  color: #666;
  font-size: 0.85rem;
  margin-bottom: 18px;
  word-break: break-all;
}
p {
  color: #888;
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
</head>
<body>
<div class="box">
  <div class="lock">🔒</div>
  <h1>CODE ĐƯỢC BẢO VỆ BỞI<br>LÂM MOD</h1>
  <div class="filename">${filename}</div>
  <p>Mã nguồn này được bảo vệ.<br>Không thể xem trực tiếp trên trình duyệt.</p>
</div>
</body>
</html>`);
  }

  // === Không phải trình duyệt (executor, curl, game...) → trả source ===
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
    return res.status(400).json({
      error: "Chỉ cho phép file chứa .lua hoặc .txt"
    });
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

  const baseUrl = getBaseUrl(req);
  const encodedName = encodeURIComponent(filename);

  res.json({
    success: true,
    filename: filename,
    obfuscated: wantObfuscate,
    url: `${baseUrl}/${encodedName}`,
    rawUrl: `${baseUrl}/raw/${encodedName}`
  });
});

app.listen(PORT, () => {
  console.log(`LÂM MOD running on port ${PORT}`);
});
