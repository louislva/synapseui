import asyncio
from dataclasses import asdict

from fastapi import FastAPI
from synapse.utils.discover import discover

app = FastAPI()


@app.get("/api/devices")
async def get_devices():
    devices = await asyncio.to_thread(discover, timeout_sec=5)
    return {"devices": [asdict(d) for d in devices]}
