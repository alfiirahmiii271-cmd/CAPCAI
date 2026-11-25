(function () {
  "use strict";

  const panel = document.getElementById("captchaAssistantPanel");
  const form = document.getElementById("captchaAssistantForm");
  const input = document.getElementById("captchaAssistantInput");
  const messages = document.getElementById("captchaAssistantMessages");
  const toggle = document.getElementById("captchaAssistantToggle");

  if (!panel || !form || !input || !messages || !toggle) return;

  function addMessage(text, sender) {
    const message = document.createElement("div");
    message.className = "captcha-assistant-message " + sender;
    message.textContent = text;
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
  }

  function getAnswer(question) {
    const q = question.toLowerCase().trim();

    const asksForCode =
      /(?:buatkan|berikan|tuliskan|tulis|bikin|kasih|generate|buat|minta|tampilkan)\s+(?:saya\s+)?(?:kode|coding|program|skrip|script|source code)/i.test(q) ||
      /(?:kode|coding|skrip|script|source code)\s+(?:program|javascript|python|node\.?js|html|css|sql)/i.test(q) ||
      /(?:javascript|python|node\.?js|html|css|sql)\s+(?:code|kode|program|script|skrip)/i.test(q) ||
      /(?:contoh|potongan)\s+(?:kode|script|skrip|program)/i.test(q) ||
      /(?:buat|tulis|bikin)\s+.*(?:fungsi|function|endpoint|api)\b/i.test(q);

    if (asksForCode) {
      return "Maaf, saya tidak menyediakan kode program, skrip, atau potongan source code. Saya tetap bisa membantu menjelaskan konsep CAPTCHA, kemungkinan penyebab error, dan langkah pemeriksaan tanpa kode.";
    }

    if (/^(hai|halo|hello|hi|selamat pagi|selamat siang|selamat sore|selamat malam)\b/i.test(q)) {
      return "Halo! Saya CAPTCHA Assistant. Silakan tanyakan tentang CAPTCHA, verifikasi, aktivitas dashboard, atau arti pesan error.";
    }

    if (/apa itu captcha|pengertian captcha|fungsi captcha|captcha itu apa/.test(q)) {
      return "CAPTCHA adalah mekanisme untuk membantu membedakan pengguna manusia dari aktivitas otomatis. Pada aplikasi kamu, prosesnya melibatkan tantangan CAPTCHA dan pemeriksaan hasil verifikasi oleh server.";
    }

    if (/\b403\b|invalid site key|invalid secret|site key|secret key/.test(q)) {
      return "Error 403 atau pesan Invalid site key or secret biasanya menunjukkan bahwa permintaan verifikasi ditolak. Periksa apakah Site Key dan Secret Key berasal dari konfigurasi yang cocok, endpoint yang digunakan benar, serta konfigurasi server sudah diperbarui. Jangan pernah membagikan Secret Key kepada orang lain.";
    }

    if (/\b500\b|internal server error|server error/.test(q)) {
      return "Error 500 menunjukkan bahwa server mengalami masalah saat memproses permintaan. Periksa log Cap Server pada waktu kejadian, pastikan layanan server dan Valkey berjalan sehat, lalu lihat apakah ada pesan kesalahan yang menjelaskan penyebabnya. Jangan kirimkan Secret Key atau token sensitif saat meminta bantuan.";
    }

    if (/gagal|invalid token|token tidak valid|verifikasi gagal/.test(q)) {
      return "Verifikasi dapat gagal jika token tidak valid, sudah tidak berlaku, telah digunakan, atau permintaan tidak cocok dengan konfigurasi yang diharapkan. Periksa urutan tantangan dan verifikasi, endpoint yang dipakai, serta pesan pada log server.";
    }

    if (/tantangan|challenge|you human|human/.test(q)) {
      return "Tantangan CAPTCHA adalah langkah yang perlu diselesaikan pengguna sebelum hasilnya diverifikasi. Jika tantangan tidak muncul, periksa koneksi browser ke layanan CAPTCHA, alamat widget yang digunakan, dan pesan error pada browser.";
    }

    if (/statistik|jumlah verifikasi|aktivitas|lalu lintas|traffic|berapa banyak/.test(q)) {
      return "Saya bisa membantu menjelaskan arti metrik seperti jumlah tantangan, verifikasi berhasil, dan kegagalan. Namun, saya belum membaca data aktivitas secara langsung. Pastikan angka pada dashboard berasal dari sumber data aktual; angka demo tidak boleh dianggap sebagai statistik produksi.";
    }

    if (/valkey|redis|database|penyimpanan/.test(q)) {
      return "Valkey digunakan sebagai layanan penyimpanan data sementara yang dibutuhkan oleh konfigurasi aplikasi ini. Jika layanan bermasalah, periksa status kesehatannya dan log terkait. Jangan menghapus volume data saat melakukan pemeriksaan.";
    }

    if (/aman|keamanan|bot|serangan/.test(q)) {
      return "CAPTCHA membantu mengurangi aktivitas otomatis, tetapi bukan satu-satunya lapisan keamanan. Pantau pola kegagalan, lindungi Secret Key, batasi akses administratif, dan periksa aturan keamanan sesuai kebutuhan aplikasi.";
    }

    if (/cara memperbaiki|bagaimana|mengapa|kenapa|error|masalah/.test(q)) {
      return "Agar masalahnya bisa diperiksa dengan tepat, sebutkan pesan error yang muncul, kapan masalah terjadi, dan apakah tantangan CAPTCHA berhasil ditampilkan. Kamu juga dapat memeriksa log Cap Server dan aplikasi. Jangan sertakan token, password, atau Secret Key.";
    }

    return "Saya belum memiliki jawaban khusus untuk pertanyaan itu. Saya dapat membantu tentang konsep CAPTCHA, error 403/500, token verifikasi, tantangan CAPTCHA, keamanan, dan arti statistik dashboard. Saya tidak memberikan kode program.";
  }

  function submitQuestion(question) {
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;

    addMessage(cleanQuestion, "user");
    addMessage(getAnswer(cleanQuestion), "bot");
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const question = input.value;
    input.value = "";
    submitQuestion(question);
    input.focus();
  });

  panel.querySelectorAll("[data-question]").forEach(function (button) {
    button.addEventListener("click", function () {
      submitQuestion(button.getAttribute("data-question") || "");
    });
  });

  toggle.addEventListener("click", function () {
    const minimized = panel.classList.toggle("is-minimized");
    toggle.textContent = minimized ? "+" : "−";
    toggle.setAttribute("aria-label", minimized ? "Buka chatbot" : "Minimalkan chatbot");
  });
})();
