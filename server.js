const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const app = express();

// CORS cho frontend HTML bên ngoài
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

const PORT = process.env.PORT || 10000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =========================
// HÀM OBFUSCATE
// =========================
function obfuscateLuaCode(codeText) {
  const encoded = Buffer.from(codeText, "utf-8").toString("base64");
  return `--[[ 
  Protected by LÂM MOD Obfuscator 
]]--
local encodedData = "${encoded}";
-- Code obfuscated successfully`;
}

// Tên file an toàn
function safeFilename(name) {
  return name
    .replace(/\\/g, "")
    .replace(/\//g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Luôn trả HTTPS (Render/Cloudflare hay bị http)
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
// RAW — luôn trả source text (cho game / tool / loadstring)
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

  const text = await data.text();
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(text);
});

// =========================
// PROTECTED VIEW — trình duyệt hiện menu xanh + hiện code
// Tool/game (không Accept HTML) vẫn nhận raw
// =========================
app.get("/:filename", async (req, res) => {
  const filename = safeFilename(req.params.filename);

  // Chỉ nhận file .lua / .txt
  if (!filename.includes(".lua") && !filename.includes(".txt")) {
    return res.status(404).send("Not Found");
  }

  const { data, error } = await supabase.storage
    .from("scripts")
    .download(filename);

  if (error || !data) {
    return res.status(404).send("File not found");
  }

  const text = await data.text();
  const accept = req.headers.accept || "";

  // Trình duyệt → trang bảo vệ xanh + hiện code
  if (accept.includes("text/html")) {
    const safeCode = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    return res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LÂM MOD — Protected</title>
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
  width: 100%;
  max-width: 720px;
  background: #111;
  border: 1px solid #00ffcc44;
  border-radius: 18px;
  padding: 28px;
  box-shadow: 0 0 40px #00ffcc18;
}
.lock { font-size: 42px; text-align: center; }
h1 {
  text-align: center;
  color: #00ffcc;
  font-size: 1.35rem;
  margin: 8px 0 4px;
}
.sub {
  text-align: center;
  color: #777;
  font-size: 0.85rem;
  margin-bottom: 18px;
}
pre {
  background: #0a0a0a;
  border: 1px solid #222;
  border-radius: 12px;
  padding: 16px;
  overflow-x: auto;
  font-size: 0.82rem;
  line-height: 1.55;
  color: #00ffcc;
  max-height: 55vh;
  white-space: pre-wrap;
  word-break: break-word;
}
.btn {
  margin-top: 14px;
  width: 100%;
  padding: 13px;
  background: #00ffcc;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  color: #000;
  transition: 0.15s;
}
.btn:hover { background: #00e6b8; transform: translateY(-1px); }
.raw-note {
  margin-top: 12px;
  text-align: center;
  font-size: 0.75rem;
  color: #555;
}
</style>
</head>
<body>
<div class="box">
  <div class="lock">🔒</div>
  <h1>CODE ĐƯỢC BẢO VỆ BỞI LÂM MOD</h1>
  <p class="sub">${filename}</p>
  <pre id="code">${safeCode}</pre>
  <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('code').innerText).then(()=>this.textContent='Đã copy!').catch(()=>alert('Copy thủ công nhé'))">
    Copy Code
  </button>
  <p class="raw-note">Protected by LÂM MOD · Dùng link /raw/ để lấy source thuần</p>
</div>
</body>
</html>`);
  }

  // Không phải trình duyệt (game, curl, loadstring...) → trả raw text
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

  // Trả cả 2 link: protected (menu xanh) + raw
  res.json({
    success: true,
    filename: filename,
    obfuscated: wantObfuscate,
    url: `${baseUrl}/${encodedName}`,           // vào = menu xanh + hiện code
    rawUrl: `${baseUrl}/raw/${encodedName}`     // luôn ra source thuần
  });
});

// =========================
// START
// =========================
app.listen(PORT, () => {
  console.log(`LÂM MOD running on port ${PORT}`);
});
