
"""Ambil data dari Cap. Cuma file ini yang bicara ke Cap."""

import os
from datetime import datetime, time
from zoneinfo import ZoneInfo
import httpx
from dotenv import load_dotenv
load_dotenv()
CAP_URL = os.environ["CAP_URL"].rstrip("/")
SITE_KEY = os.environ["CAP_SITE_KEY"]
HEADERS = {"Authorization": f"Bot {os.environ['CAP_API_KEY']}"}

WIB = ZoneInfo("Asia/Jakarta")

PERIODS = ["today", "last7days", "last28days", "last91days", "alltime"]
KEYS = ("challenges", "verified", "failed", "rateLimited")


def cap_get(period):
    """Satu permintaan GET ke Cap. Hasilnya dict Python."""
    r = httpx.get(
        f"{CAP_URL}/server/keys/{SITE_KEY}",
        params={"chartDuration": period},
        headers=HEADERS,
        timeout=10,
    )
    r.raise_for_status()
    return r.json()


def get_period(period):
    """Statistik apa adanya dari Cap. Hari di Cap dihitung UTC."""
    data = cap_get(period)
    return {
        "stats": {k: data["stats"][k] for k in KEYS},
        "bucket_size": data["chartData"]["bucketSize"],
        "chart": data["chartData"]["data"],
    }


def get_day_wib(day=None):
    """Statistik satu hari menurut WIB."""
    day = day or datetime.now(WIB).date()
    start = int(
        datetime.combine(day, time.min, tzinfo=WIB).timestamp()
    )

    buckets = {}

    for period in ("yesterday", "today"):
        chart = cap_get(period)["chartData"]

        if chart["bucketSize"] != 3600:
            raise RuntimeError(
                "Data Cap tidak per jam, hari WIB tidak bisa dihitung"
            )

        for b in chart["data"]:
            buckets[b["bucket"]] = b

    if start < min(buckets, default=start + 1):
        raise ValueError(
            "Data per jam hanya ada untuk kemarin dan hari ini"
        )

    rows = [
        b for t, b in sorted(buckets.items())
        if start <= t < start + 86400
    ]

    return {
        "date": day.isoformat(),
        "stats": {k: sum(b[k] for b in rows) for k in KEYS},
        "bucket_size": 3600,
        "chart": rows,
    }


def load_stats(period="today", date=None): # pengambilan data
    """Dipakai dashboard dan AI. Today berarti hari menurut WIB."""
    if period not in PERIODS:
        raise ValueError(f"period harus salah satu dari {PERIODS}")

    if period == "today":
        day = datetime.strptime(date, "%Y-%m-%d").date() if date else None
        result = get_day_wib(day)
    else:
        result = get_period(period)

    return {"period": period, **result}
