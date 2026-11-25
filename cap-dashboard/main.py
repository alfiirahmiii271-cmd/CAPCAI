
"""Server: /api/stats, /api/chat, dan halaman web."""

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

import cap
import chat

app = FastAPI()


@app.get("/api/stats")
def api_stats(period: str = "today"):
    try:
        return cap.load_stats(period)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    except httpx.HTTPError:
        raise HTTPException(
            503,
            "Cap tidak bisa dihubungi. Cek CAP_URL dan CAP_API_KEY di .env"
        )


# Menghubungkan endpoint chatbot Gemini
app.include_router(chat.router)


# Harus paling bawah agar halaman web tetap bisa diakses
app.mount("/", StaticFiles(directory="static", html=True), name="static")
