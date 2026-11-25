
"""Chat AI untuk menjawab pertanyaan tentang statistik CAPTCHA Cap."""

import os
import time
from datetime import datetime
from typing import Literal

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import errors, types
from pydantic import BaseModel, Field

import cap

load_dotenv()

router = APIRouter()

# ==========================================
# BAGIAN 1: KONEKSI GOOGLE GEMINI
# ==========================================

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY belum diatur di file .env"
    )

client = genai.Client(api_key=GEMINI_API_KEY)

MODEL = os.environ.get(
    "GEMINI_MODEL",
    "gemini-3.1-flash-lite"
)


# ==========================================
# BAGIAN 2: FUNGSI PENGAMBILAN STATISTIK CAP
# ==========================================

TOOLS = [
    types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="get_stats",
                description=(
                    "Mengambil statistik CAPTCHA asli dari Cap. "
                    "Gunakan period='today' untuk statistik hari ini. "
                    "Untuk tanggal tertentu, gunakan period='today' "
                    "dan isi date dengan format YYYY-MM-DD. "
                    "Untuk periode 7, 28, atau 91 hari, gunakan "
                    "pilihan periode yang tersedia."
                ),
                parameters_json_schema={
                    "type": "object",
                    "properties": {
                        "period": {
                            "type": "string",
                            "enum": cap.PERIODS,
                            "description": (
                                "Periode statistik yang diminta."
                            ),
                        },
                        "date": {
                            "type": "string",
                            "description": (
                                "Tanggal tertentu dengan format "
                                "YYYY-MM-DD. Bersifat opsional."
                            ),
                        },
                    },
                    "required": ["period"],
                },
            )
        ]
    )
]


def get_stats_for_ai(period, date=None):
    """Mengambil dan menyiapkan statistik Cap untuk AI."""

    data = cap.load_stats(period, date)

    if not isinstance(data, dict):
        raise ValueError(
            "Format data statistik dari Cap tidak valid."
        )

    if period == "today":
        chart_data = data.get("chart", [])

        data["chart"] = [
            {
                "jam_wib": datetime.fromtimestamp(
                    item["bucket"],
                    cap.WIB
                ).strftime("%H:%M"),
                "challenges": item.get("challenges", 0),
                "verified": item.get("verified", 0),
                "failed": item.get("failed", 0),
            }
            for item in chart_data
            if item.get("challenges", 0) > 0
        ]

    else:
        data.pop("chart", None)

    return data


# ==========================================
# BAGIAN 3: KONEKSI GEMINI DENGAN RETRY
# ==========================================

def generate_with_retry(contents, system_instruction):
    """Mencoba kembali jika Gemini mengalami gangguan sementara."""

    max_attempts = 4

    for attempt in range(max_attempts):

        waktu_mulai = time.perf_counter()

        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    tools=TOOLS,
                    max_output_tokens=1200,
                    automatic_function_calling=(
                        types.AutomaticFunctionCallingConfig(
                            disable=True
                        )
                    ),
                ),
            )

            durasi = time.perf_counter() - waktu_mulai

            print(
                f"[PERFORMA] Gemini merespons dalam "
                f"{durasi:.2f} detik."
            )

            return response

        except errors.APIError as error:
            status_code = getattr(error, "code", None)

            retryable_codes = (429, 500, 502, 503, 504)

            if status_code not in retryable_codes:
                raise

            if attempt == max_attempts - 1:
                raise

            delay = 2 ** (attempt + 1)

            print(
                f"Gemini mengalami error {status_code}. "
                f"Percobaan {attempt + 1}/{max_attempts}. "
                f"Mencoba kembali dalam {delay} detik."
            )

            time.sleep(delay)


# ==========================================
# BAGIAN 4: INSTRUKSI DAN PROSES AI
# ==========================================

def is_simple_greeting(message):
    """Mendeteksi sapaan sederhana tanpa memanggil Gemini."""

    greetings = {
        "halo",
        "hai",
        "hi",
        "hello",
        "helo",
        "pagi",
        "selamat pagi",
        "selamat siang",
        "selamat sore",
        "selamat malam",
        "assalamualaikum",
        "assalamu'alaikum",
    }

    cleaned = message.lower().strip()
    cleaned = cleaned.rstrip("!.,? ")

    return cleaned in greetings


def ask(messages):
    """Mengirim percakapan ke Gemini dan menjalankan tool get_stats."""

    # Jawab sapaan sederhana tanpa memanggil Gemini.
    pesan_terakhir = messages[-1]["content"]

    if is_simple_greeting(pesan_terakhir):
        return {
            "reply": (
                "Halo! Selamat datang di Cap AI Assistant. "
                "Ada yang bisa saya bantu terkait CAPTCHA, "
                "statistik, atau aktivitas keamanan Cap?"
            ),
            "stats": None,
        }

    # Waktu Indonesia Barat.
    waktu_sekarang = datetime.now(cap.WIB).strftime(
        "%A, %d %B %Y pukul %H:%M WIB"
    )

    system_instruction = f"""
Kamu adalah Cap AI Assistant, asisten analisis statistik CAPTCHA
yang profesional dan terintegrasi dengan dashboard Cap.

Waktu saat ini: {waktu_sekarang}.

IDENTITAS DAN GAYA KOMUNIKASI:
- Gunakan bahasa Indonesia.
- Bersikap profesional, ramah, dan informatif.
- Jawaban mudah dibaca dan tidak bertele-tele.
- Fokus pada aktivitas dan statistik CAPTCHA Cap.

FORMAT JAWABAN:
1. Gunakan judul utama dengan format #.
2. Gunakan subjudul ## untuk membagi pembahasan.
3. Awali laporan statistik dengan ringkasan singkat.
4. Gunakan bullet list untuk rincian statistik.
5. Tebalkan angka dan istilah penting menggunakan **teks tebal**.
6. Tambahkan bagian ## Analisis AI jika relevan.
7. Tambahkan bagian ## Kesimpulan untuk merangkum hasil.
8. Hindari paragraf yang terlalu panjang.

ATURAN PENGAMBILAN DATA:
1. Jika pertanyaan membutuhkan angka statistik, panggil fungsi get_stats.
2. Jangan mengarang atau memperkirakan angka statistik.
3. Semua angka statistik harus berasal dari hasil fungsi get_stats.
4. Pertanyaan tentang hari ini menggunakan period "today".
5. Pertanyaan tentang periode 7, 28, atau 91 hari menggunakan
   pilihan periode yang sesuai.
6. Pertanyaan tentang tanggal tertentu menggunakan period "today"
   dan parameter date berformat YYYY-MM-DD.
7. Jika data tidak tersedia, jelaskan dengan jujur.
8. Jangan membuat angka pengganti jika terjadi kesalahan API.
9. Jika pengguna meminta grafik, gunakan data grafik dari hasil fungsi.
10. Jangan mengaku telah mengambil data jika fungsi gagal.

ATURAN ANALISIS:
- Jelaskan hubungan antara challenges, verified, failed,
  dan rateLimited berdasarkan data yang tersedia.
- Jangan menganggap penyebab kegagalan tanpa bukti.
- Berikan rekomendasi hanya jika relevan dengan data.
- Jika failed dan rateLimited bernilai 0, sampaikan bahwa
  tidak ada kegagalan dan pembatasan yang tercatat.
- Jangan menyimpulkan kondisi keamanan server hanya berdasarkan
  statistik CAPTCHA.

BATASAN:
Jika pertanyaan tidak berkaitan dengan CAPTCHA Cap,
jelaskan bahwa kamu hanya membantu topik tersebut.

Arti data:
- challenges: jumlah tantangan CAPTCHA.
- verified: jumlah CAPTCHA berhasil diverifikasi.
- failed: jumlah CAPTCHA gagal diverifikasi.
- rateLimited: jumlah permintaan yang terkena pembatasan.
"""

    # Mengubah riwayat browser menjadi percakapan Gemini.
    contents = []

    for message in messages:
        role = (
            "user"
            if message["role"] == "user"
            else "model"
        )

        contents.append(
            types.Content(
                role=role,
                parts=[
                    types.Part.from_text(
                        text=message["content"]
                    )
                ],
            )
        )

    # Menyimpan statistik terakhir yang berhasil diambil.
    latest_stats = None

    # Maksimal lima putaran pemanggilan fungsi.
    for _ in range(5):

        response = generate_with_retry(
            contents=contents,
            system_instruction=system_instruction,
        )

        function_calls = response.function_calls

        if not function_calls:
            return {
                "reply": (response.text or "").strip(),
                "stats": latest_stats,
            }

        if not response.candidates:
            raise ValueError(
                "Gemini tidak memberikan kandidat jawaban."
            )

        model_content = response.candidates[0].content

        if model_content is None:
            raise ValueError(
                "Isi respons Gemini tidak tersedia."
            )

        contents.append(model_content)

        function_response_parts = []

        for function_call in function_calls:

            try:
                if function_call.name != "get_stats":
                    raise ValueError(
                        "Fungsi yang diminta tidak dikenal."
                    )

                arguments = dict(
                    function_call.args or {}
                )

                function_result = get_stats_for_ai(
                    **arguments
                )

                latest_stats = function_result

                function_response = {
                    "result": function_result
                }

            except Exception as error:
                print(
                    "Kesalahan saat mengambil statistik Cap: "
                    f"{error}"
                )

                function_response = {
                    "error": str(error)
                }

            function_response_parts.append(
                types.Part.from_function_response(
                    name=function_call.name,
                    response=function_response,
                )
            )

        contents.append(
            types.Content(
                role="user",
                parts=function_response_parts,
            )
        )

    return {
        "reply": (
            "Pertanyaan terlalu kompleks untuk diproses "
            "dalam satu percakapan. Silakan coba dengan "
            "pertanyaan yang lebih sederhana."
        ),
        "stats": latest_stats,
    }


# ==========================================
# BAGIAN 5: VALIDASI PESAN
# ==========================================

class Msg(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(
        min_length=1,
        max_length=8000
    )


class ChatIn(BaseModel):
    messages: list[Msg] = Field(
        min_length=1,
        max_length=40
    )


# ==========================================
# BAGIAN 6: ENDPOINT CHATBOT
# ==========================================

@router.post("/api/chat")
def post_chat(body: ChatIn):

    if body.messages[0].role != "user":
        raise HTTPException(
            status_code=400,
            detail="Pesan pertama harus berasal dari pengguna.",
        )

    if body.messages[-1].role != "user":
        raise HTTPException(
            status_code=400,
            detail="Pesan terakhir harus berasal dari pengguna.",
        )

    messages = [
        message.model_dump()
        for message in body.messages
    ]

    try:
        result = ask(messages)

        reply = (
            result.get("reply")
            or "(tidak ada jawaban)"
        )

    except errors.APIError as error:
        raise HTTPException(
            status_code=502,
            detail=(
                "Gagal menghubungi Google Gemini: "
                f"{error}"
            ),
        )

    except Exception as error:
        print(
            f"Kesalahan pada proses chatbot: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Terjadi kesalahan saat memproses "
                "pertanyaan chatbot."
            ),
        )

    return {
        "reply": reply,
        "stats": result.get("stats"),
    }
