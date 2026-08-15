const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const app = express();

// Cho phép CORS để test từ file HTML ngoài
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
// HÀM OBFUSCATE MẪU
// =========================
function obfuscateLuaCode(codeText) {
  // Mã hóa base64 và bọc lại để bảo vệ mã nguồn
  const encoded = Buffer.from(codeText, 'utf-8').toString('base64');
  return `--[[ \n  Protected by LÂM MOD Obfuscator \n]]--\nlocal encodedData = "${encoded}";\n-- Code obfuscated successfully`;
}

// =========================
// LÂM MOD HOST (TRANG CHỦ)
// =========================

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LÂM MOD</title>
<style>
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background: #080808;
  color: white;
  font-family: Arial, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
}
.box {
  width: 90%;
  max-width: 600px;
  padding: 40px;
  text-align: center;
  background: #111;
  border: 1px solid #333;
  border-radius: 20px;
}
h1 { margin-bottom: 10px; }
p { color: #999; }
</style>
</head>
<body>
<div class="box">
  <h1>🔒 LÂM MOD</h1>
  <p>Hệ thống lưu trữ và bảo vệ mã nguồn Lua</p>
</div>
</body>
</html>
  `);
});

// =========================
// KIỂM TRA TÊN FILE
// =========================

function safeFilename(name) {
  return name
    .replace(/\\/g, "")
    .replace(/\//g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

// =========================
// RAW FILE & PROTECT
// =========================

app.get("/:filename", async (req, res) => {

  const filename = safeFilename(req.params.filename);

  // Cho phép file chứa .lua hoặc .txt (hỗ trợ cả .lua.txt)
  if (
    !filename.includes(".lua") &&
    !filename.includes(".txt")
  ) {
    return res.status(404).send("Not Found");
  }

  const { data, error } = await supabase.storage
    .from("scripts")
    .download(filename);

  if (error || !data) {
    return res.status(404).send("File not found");
  }

  // Browser thì hiện trang bảo vệ
  const accept = req.headers.accept || "";

  if (accept.includes("text/html")) {

    return res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LÂM MOD - Protected</title>
<style>
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background: #080808;
  color: white;
  font-family: Arial, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
}
.box {
  width: 90%;
  max-width: 650px;
  padding: 40px;
  text-align: center;
  background: #111;
  border: 1px solid #333;
  border-radius: 20px;
}
.lock { font-size: 60px; }
h1 { font-size: 26px; }
p { color: #999; }
</style>
</head>
<body>
<div class="box">
<div class="lock">🔒</div>
<h1>CODE ĐƯỢC BẢO VỆ BỞI LÂM MOD</h1>
<p>Mã nguồn này được lưu trữ bởi Lâm MOD.</p>
</div>
</body>
</html>
    `);
  }

  // Không phải HTML -> trả source text (cho tool/game đọc)
  const text = await data.text();

  res.setHeader(
    "Content-Type",
    "text/plain; charset=utf-8"
  );

  res.send(text);
});

// =========================
// UPLOAD & OBFUSCATE
// =========================

app.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {

    if (!req.file) {
      return res.status(400).json({
        error: "Chưa chọn file"
      });
    }

    const filename = safeFilename(req.file.originalname);

    if (
      !filename.includes(".lua") &&
      !filename.includes(".txt")
    ) {
      return res.status(400).json({
        error: "Chỉ cho phép file chứa .lua hoặc .txt"
      });
    }

    let fileContent = req.file.buffer.toString('utf-8');
    const wantObfuscate = req.body.obfuscate === 'yes' || req.body.obfuscate === 'true';

    // Nếu chọn có obfuscate thì chạy hàm làm rối
    if (wantObfuscate) {
      fileContent = obfuscateLuaCode(fileContent);
    }

    const { error } =
      await supabase.storage
        .from("scripts")
        .upload(
          filename,
          Buffer.from(fileContent, 'utf-8'),
          {
            contentType: "text/plain; charset=utf-8",
            upsert: true
          }
        );

    if (error) {
      return res.status(500).json({
        error: error.message
      });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    res.json({
      success: true,
      filename: filename,
      obfuscated: wantObfuscate,
      url: `${baseUrl}/${encodeURIComponent(filename)}`
    });

  }
);

// =========================
// START SERVER
// =========================

app.listen(PORT, () => {
  console.log(`LÂM MOD running on port ${PORT}`);
});
