import asyncio
import signal
import subprocess
import sys
from dataclasses import asdict

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from synapse.utils.discover import discover

app = FastAPI()

# Track running simulator processes: id -> subprocess.Popen
_simulators: dict[str, subprocess.Popen] = {}
_next_sim_id = 0


class SimulatorRequest(BaseModel):
    name: str | None = None
    serial: str | None = None
    rpc_port: int = 647
    discovery_port: int = 6470

    def safe_name(self) -> str | None:
        if self.name is None:
            return None
        return self.name.replace(" ", "-")


@app.get("/api/devices")
async def get_devices():
    devices = await asyncio.to_thread(discover, timeout_sec=5)
    return {"devices": [asdict(d) for d in devices]}


@app.get("/api/simulators")
async def list_simulators():
    """List all tracked simulators and their status."""
    result = []
    for sim_id, proc in list(_simulators.items()):
        result.append({
            "id": sim_id,
            "pid": proc.pid,
            "running": proc.poll() is None,
        })
    return {"simulators": result}


@app.post("/api/simulators")
async def launch_simulator(req: SimulatorRequest):
    """Launch a new simulator subprocess."""
    global _next_sim_id

    sim_id = str(_next_sim_id)
    _next_sim_id += 1

    cmd = [
        sys.executable, "-m", "synapse.simulator",
        "--iface-ip", "127.0.0.1",
        "--rpc-port", str(req.rpc_port),
        "--discovery-port", str(req.discovery_port),
    ]
    safe_name = req.safe_name()
    if safe_name:
        cmd += ["--name", safe_name]
    if req.serial:
        cmd += ["--serial", req.serial]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    _simulators[sim_id] = proc
    return {"id": sim_id, "pid": proc.pid}


@app.delete("/api/simulators/{sim_id}")
async def kill_simulator(sim_id: str):
    """Kill a running simulator by ID."""
    proc = _simulators.get(sim_id)
    if proc is None:
        raise HTTPException(status_code=404, detail="Simulator not found")

    if proc.poll() is None:
        proc.send_signal(signal.SIGTERM)
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

    del _simulators[sim_id]
    return {"id": sim_id, "stopped": True}


@app.on_event("shutdown")
async def cleanup_simulators():
    """Kill all simulators when the server shuts down."""
    for proc in _simulators.values():
        if proc.poll() is None:
            proc.send_signal(signal.SIGTERM)
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
    _simulators.clear()
