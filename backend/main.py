import asyncio
import signal
import subprocess
import sys
from dataclasses import asdict

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import synapse as syn
from synapse.api.status_pb2 import DeviceState
from synapse.utils.discover import discover

_STATE_NAMES = {v: k.removeprefix("k") for k, v in DeviceState.items()}

app = FastAPI()

# Track running simulator processes: id -> subprocess.Popen
_simulators: dict[str, subprocess.Popen] = {}
_next_sim_id = 0


class NodePayload(BaseModel):
    id: str
    type: str
    params: dict


class ConnectionPayload(BaseModel):
    source: str  # source node id
    target: str  # target node id


class ConfigureRequest(BaseModel):
    nodes: list[NodePayload]
    connections: list[ConnectionPayload]


_NODE_FACTORIES = {
    "broadband_source": lambda p: syn.BroadbandSource(
        peripheral_id=0,
        bit_width=int(p.get("bit_depth", 12)),
        sample_rate_hz=int(p.get("sample_rate_hz", 30000)),
        gain=1.0,
    ),
    "spectral_filter": lambda p: syn.SpectralFilter(
        method=str(p.get("filter_type", "butterworth")),
        low_cutoff_hz=float(p.get("low_cutoff_hz", 300)),
        high_cutoff_hz=float(p.get("high_cutoff_hz", 3000)),
    ),
    "spike_detector": lambda p: syn.SpikeDetector(
        threshold=float(p.get("threshold_sigma", 4)),
    ) if hasattr(syn, "SpikeDetector") else None,
}


class SimulatorRequest(BaseModel):
    name: str | None = None
    serial: str | None = None
    rpc_port: int = 647
    discovery_port: int = 6470

    def safe_name(self) -> str | None:
        if self.name is None:
            return None
        return self.name.replace(" ", "-")


def _get_device_status(uri: str) -> str:
    try:
        device = syn.Device(uri)
        info = device.info()
        return _STATE_NAMES.get(info.status.state, "Unknown")
    except Exception:
        return "Unreachable"


@app.get("/api/devices")
async def get_devices():
    devices = await asyncio.to_thread(discover, timeout_sec=1)
    statuses = await asyncio.gather(
        *(asyncio.to_thread(_get_device_status, f"{d.host}:{d.port}") for d in devices)
    )
    result = []
    for d, s in zip(devices, statuses):
        dd = asdict(d)
        dd["uri"] = f"{d.host}:{d.port}"
        dd["status"] = s
        result.append(dd)
    return {"devices": result}


@app.post("/api/devices/configure")
async def configure_device(uri: str, req: ConfigureRequest):
    """Deploy a signal chain config to a device."""
    device = syn.Device(uri)

    config = syn.Config()
    node_map: dict[str, object] = {}

    for n in req.nodes:
        factory = _NODE_FACTORIES.get(n.type)
        if factory is None:
            raise HTTPException(status_code=400, detail=f"Unknown node type: {n.type}")
        node = factory(n.params)
        if node is None:
            raise HTTPException(status_code=400, detail=f"Node type not supported: {n.type}")
        config.add_node(node)
        node_map[n.id] = node

    for c in req.connections:
        src = node_map.get(c.source)
        dst = node_map.get(c.target)
        if src is None or dst is None:
            raise HTTPException(status_code=400, detail="Invalid connection: node not found")
        config.connect(src, dst)

    try:
        await asyncio.to_thread(device.configure, config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Configure failed: {e}")

    return {"status": "ok"}


@app.post("/api/devices/start")
async def start_device(uri: str):
    """Start the signal chain on a device."""
    device = syn.Device(uri)
    try:
        await asyncio.to_thread(device.start)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Start failed: {e}")
    status = await asyncio.to_thread(_get_device_status, uri)
    return {"status": status}


@app.post("/api/devices/stop")
async def stop_device(uri: str):
    """Stop the signal chain on a device."""
    device = syn.Device(uri)
    try:
        await asyncio.to_thread(device.stop)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stop failed: {e}")
    status = await asyncio.to_thread(_get_device_status, uri)
    return {"status": status}


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
