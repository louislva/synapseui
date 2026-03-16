import asyncio
import signal
import subprocess
import sys
from dataclasses import asdict, dataclass

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import synapse as syn
from synapse.api.status_pb2 import DeviceState
from synapse.utils.discover import discover

_STATE_NAMES = {v: k.removeprefix("k") for k, v in DeviceState.items()}

app = FastAPI()


@dataclass
class SimulatorInfo:
    proc: subprocess.Popen
    name: str
    rpc_port: int
    uri: str  # "127.0.0.1:{rpc_port}"


_simulators: dict[str, SimulatorInfo] = {}
_next_sim_id = 0
_allocated_ports: set[int] = set()
_BASE_RPC_PORT = 647
_DISCOVERY_PORT_OFFSET = 5823  # 6470 - 647


def _next_available_port() -> int:
    port = _BASE_RPC_PORT
    while port in _allocated_ports:
        port += 1
    return port


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


from synapse.api.nodes.signal_config_pb2 import SignalConfig
from synapse.client.nodes.spike_detector import ThresholderConfig

_NODE_FACTORIES = {
    "broadband_source": lambda p: syn.BroadbandSource(
        peripheral_id=0,
        bit_width=int(p.get("bit_depth", 12)),
        sample_rate_hz=int(p.get("sample_rate_hz", 30000)),
        gain=1.0,
        signal=SignalConfig(),
    ),
    "spectral_filter": lambda p: syn.SpectralFilter(
        method=str(p.get("filter_type", "butterworth")),
        low_cutoff_hz=float(p.get("low_cutoff_hz", 300)),
        high_cutoff_hz=float(p.get("high_cutoff_hz", 3000)),
    ),
    "spike_detector": lambda p: syn.SpikeDetector(
        samples_per_spike=48,
        config=ThresholderConfig(
            threshold_uV=int(p.get("threshold_sigma", 4)),
        ),
    ),
}


class SimulatorRequest(BaseModel):
    name: str | None = None
    serial: str | None = None
    rpc_port: int | None = None
    discovery_port: int | None = None

    def safe_name(self, fallback: str) -> str:
        if self.name is None:
            return fallback
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
    sim_by_uri = {
        info.uri: (sim_id, info) for sim_id, info in _simulators.items()
    }
    result = []
    for d, s in zip(devices, statuses):
        dd = asdict(d)
        dd["uri"] = f"{d.host}:{d.port}"
        dd["status"] = s
        sim_match = sim_by_uri.get(dd["uri"])
        if sim_match:
            sim_id, info = sim_match
            dd["simulator"] = {"id": sim_id, "pid": info.proc.pid, "name": info.name}
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
    for sim_id, info in list(_simulators.items()):
        result.append({
            "id": sim_id,
            "pid": info.proc.pid,
            "running": info.proc.poll() is None,
            "name": info.name,
            "uri": info.uri,
            "rpc_port": info.rpc_port,
        })
    return {"simulators": result}


@app.post("/api/simulators")
async def launch_simulator(req: SimulatorRequest):
    """Launch a new simulator subprocess."""
    global _next_sim_id

    sim_id = str(_next_sim_id)
    _next_sim_id += 1

    rpc_port = req.rpc_port if req.rpc_port is not None else _next_available_port()
    discovery_port = req.discovery_port if req.discovery_port is not None else rpc_port + _DISCOVERY_PORT_OFFSET
    name = req.safe_name(f"simulator-{sim_id}")
    uri = f"127.0.0.1:{rpc_port}"

    cmd = [
        sys.executable, "-m", "synapse.simulator",
        "--iface-ip", "127.0.0.1",
        "--rpc-port", str(rpc_port),
        "--discovery-port", str(discovery_port),
        "--name", name,
    ]
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

    _allocated_ports.add(rpc_port)
    _simulators[sim_id] = SimulatorInfo(proc=proc, name=name, rpc_port=rpc_port, uri=uri)
    return {"id": sim_id, "pid": proc.pid, "name": name, "uri": uri, "rpc_port": rpc_port}


@app.delete("/api/simulators/{sim_id}")
async def kill_simulator(sim_id: str):
    """Kill a running simulator by ID."""
    info = _simulators.get(sim_id)
    if info is None:
        raise HTTPException(status_code=404, detail="Simulator not found")

    if info.proc.poll() is None:
        info.proc.send_signal(signal.SIGTERM)
        try:
            info.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            info.proc.kill()

    _allocated_ports.discard(info.rpc_port)
    del _simulators[sim_id]
    return {"id": sim_id, "stopped": True}


@app.on_event("shutdown")
async def cleanup_simulators():
    """Kill all simulators when the server shuts down."""
    for info in _simulators.values():
        if info.proc.poll() is None:
            info.proc.send_signal(signal.SIGTERM)
            try:
                info.proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                info.proc.kill()
    _simulators.clear()
    _allocated_ports.clear()
