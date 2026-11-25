
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

// ========================================
// KONFIGURASI APLIKASI
// ========================================
const PORT = process.env.PORT || 8080;

const SITE_KEY = process.env.CAP_SITE_KEY;
const SECRET_KEY = process.env.CAP_SECRET_KEY;

const CAP_SERVER = (
  process.env.CAP_SERVER_URL || "http://cap-server:3000"
).replace(/\/+$/, "");

const WIDGET_BASE_URL = (
  process.env.CAP_WIDGET_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

const DASHBOARD_DIR = path.join(
  __dirname,
  "custom-cap-dashboard"
);

// ========================================
// MIDDLEWARE
// ========================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ========================================
// DASHBOARD CAPTCHA
// ========================================

// Sajikan file CSS, JavaScript, gambar, dan aset dashboard.
app.use(
  "/dashboard",
  express.static(DASHBOARD_DIR)
);

// Halaman dashboard
app.get("/dashboard", (req, res) => {
  const dashboardPath = path.join(
    DASHBOARD_DIR,
    "index.html"
  );

  if (!fs.existsSync(dashboardPath)) {
    return res.status(404).send(
      "File dashboard tidak ditemukan. Periksa folder custom-cap-dashboard."
    );
  }

  res.sendFile(dashboardPath);
});

// ========================================
// API STATISTIK DASHBOARD
// ========================================
app.get("/api/stats", (req, res) => {
  res.json({
    challenges: 1420,
    verified: 1380,
    failed: 40,
    avgDuration: "0.8s",
    blockRate: "2.8%",
    botDetected: 15
  });
});

// ========================================
// HALAMAN FORM CAPTCHA
// ========================================
app.get("/", (req, res) => {
  const indexPath = path.join(__dirname, "index.html");

  let page;

  try {
    page = fs.readFileSync(indexPath, "utf8");
  } catch (error) {
    console.error(
      "Gagal membaca index.html:",
      error.message
    );

    return res.status(500).send(
      "Gagal memuat halaman CAPTCHA."
    );
  }

  const apiEndpoint = SITE_KEY
    ? `${WIDGET_BASE_URL}/${SITE_KEY}/`
    : "";

  res
    .type("html")
    .send(
      page.replace(
        /__CAP_API_ENDPOINT__/g,
        apiEndpoint
      )
    );
});

// ========================================
// CEK STATUS APLIKASI
// ========================================
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    application: "CAPTCHA Node.js",
    capServerConfigured: Boolean(CAP_SERVER),
    siteKeyConfigured: Boolean(SITE_KEY),
    secretKeyConfigured: Boolean(SECRET_KEY)
  });
});

// ========================================
// VERIFIKASI CAPTCHA
// ========================================
app.post("/verify", async (req, res) => {
  const token = req.body["cap-token"];
  const email = req.body.email || "";

  // Periksa token CAPTCHA
  if (
    typeof token !== "string" ||
    !token.trim()
  ) {
    return res.status(400).send(
      renderPage(
        "CAPTCHA Belum Diselesaikan",
        "Silakan selesaikan CAPTCHA terlebih dahulu.",
        false
      )
    );
  }

  // Periksa konfigurasi
  if (!SITE_KEY || !SECRET_KEY) {
    console.error(
      "Konfigurasi CAPTCHA tidak lengkap:",
      {
        siteKeyConfigured: Boolean(SITE_KEY),
        secretKeyConfigured: Boolean(SECRET_KEY)
      }
    );

    return res.status(500).send(
      renderPage(
        "Konfigurasi Belum Lengkap",
        "Site Key atau Secret Key belum dikonfigurasi pada server."
      )
    );
  }

  const verifyUrl =
    `${CAP_SERVER}/${SITE_KEY}/siteverify`;

  try {
    console.log("Memulai verifikasi CAPTCHA.");
    console.log("Endpoint:", verifyUrl);

    // Jangan mencatat token atau Secret Key ke log.
    const response = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        secret: SECRET_KEY,
        response: token
      }),
      signal: AbortSignal.timeout(10000)
    });

    const responseText = await response.text();

    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      console.error(
        "Respons Cap Server bukan JSON. HTTP:",
        response.status
      );

      return res.status(502).send(
        renderPage(
          "Respons Server Tidak Valid",
          "Cap Server mengembalikan respons yang tidak dapat dibaca."
        )
      );
    }

    console.log(
      "Status HTTP verifikasi Cap:",
      response.status
    );

    if (!response.ok) {
      console.error("Verifikasi ditolak:", {
        status: response.status,
        error: result.error ||
          "Tidak ada keterangan error"
      });

      if (
        response.status >= 400 &&
        response.status < 500
      ) {
        return res.status(400).send(
          renderPage(
            "CAPTCHA Gagal",
            "Token tidak valid, sudah kedaluwarsa, atau verifikasi ditolak. Silakan coba lagi."
          )
        );
      }

      return res.status(502).send(
        renderPage(
          "Server CAPTCHA Mengalami Masalah",
          `Cap Server mengembalikan HTTP ${response.status}. Periksa konfigurasi dan log Cap Server.`
        )
      );
    }

    if (result.success === true) {
      console.log(
        "Verifikasi CAPTCHA berhasil."
      );

      return res.status(200).send(
        renderPage(
          "CAPTCHA Berhasil!",
          `Verifikasi berhasil untuk ${email || "pengguna"}.`,
          true
        )
      );
    }

    console.warn(
      "Token CAPTCHA tidak valid atau ditolak."
    );

    return res.status(400).send(
      renderPage(
        "CAPTCHA Gagal",
        "Token tidak valid, sudah kedaluwarsa, atau verifikasi ditolak."
      )
    );

  } catch (error) {
    console.error(
      "Kesalahan saat menghubungi Cap Server:",
      error.name,
      error.message
    );

    return res.status(502).send(
      renderPage(
        "Gagal Menghubungi Server CAPTCHA",
        "Periksa apakah Cap Server berjalan dan dapat diakses dari aplikasi."
      )
    );
  }
});

// ========================================
// TEMPLATE HALAMAN HASIL
// ========================================
function renderPage(
  title,
  message,
  success = false
) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  const statusColor = success
    ? "#16803c"
    : "#b42318";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f4f6f8;
      margin: 0;
      padding: 40px 16px;
    }
    main {
      max-width: 520px;
      margin: 40px auto;
      padding: 28px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 18px rgba(0,0,0,.08);
    }
    h1 {
      color: ${statusColor};
    }
    a {
      color: #175cd3;
    }
  </style>
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    <a href="/">Kembali ke Form</a>
  </main>
</body>
</html>`;
}

// ========================================
// ESCAPE HTML
// ========================================
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}

// ========================================
// JALANKAN SERVER
// ========================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Aplikasi CAPTCHA berjalan pada port ${PORT}`
  );

  console.log(
    `Form CAPTCHA: http://localhost:${PORT}/`
  );

  console.log(
    `Dashboard: http://localhost:${PORT}/dashboard`
  );

  console.log(
    `API Statistik: http://localhost:${PORT}/api/stats`
  );

  console.log(`Cap Server: ${CAP_SERVER}`);

  console.log(
    `Cap Widget Base URL: ${WIDGET_BASE_URL}`
  );

  console.log(
    `Site Key tersedia: ${Boolean(SITE_KEY)}`
  );

  console.log(
    `Secret Key tersedia: ${Boolean(SECRET_KEY)}`
  );
});
