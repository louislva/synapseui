import asyncio
import json
import logging
import signal
import subprocess
import sys
from dataclasses import asdict, dataclass

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from coolname import generate_slug
import synapse as syn
from synapse.api.datatype_pb2 import BroadbandFrame
from synapse.api.status_pb2 import DeviceState
from synapse.client.taps import Tap
from synapse.utils.discover import discover

_STATE_NAMES = {v: k.removeprefix("k") for k, v in DeviceState.items()}

logger = logging.getLogger(__name__)

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


def _make_broadband_source(p: dict):
    num_channels = int(p.get("num_channels", 8))
    channels = [
        syn.Channel(id=ch, electrode_id=ch * 2, reference_id=ch * 2 + 1)
        for ch in range(num_channels)
    ]
    return syn.BroadbandSource(
        peripheral_id=0,
        bit_width=int(p.get("bit_depth", 12)),
        sample_rate_hz=int(p.get("sample_rate_hz", 30000)),
        gain=1.0,
        signal=syn.SignalConfig(
            electrode=syn.ElectrodeConfig(
                channels=channels,
                low_cutoff_hz=300.0,
                high_cutoff_hz=6000.0,
            )
        ),
    )


def _make_spike_source(p: dict):
    num_channels = int(p.get("num_channels", 8))
    channels = [
        syn.Channel(id=ch, electrode_id=ch * 2, reference_id=ch * 2 + 1)
        for ch in range(num_channels)
    ]
    return syn.SpikeSource(
        peripheral_id=0,
        sample_rate_hz=int(p.get("sample_rate_hz", 30000)),
        spike_window_ms=float(p.get("spike_window_ms", 20)),
        gain=1.0,
        threshold_uV=float(p.get("threshold_uV", 50)),
        electrodes=syn.ElectrodeConfig(
            channels=channels,
            low_cutoff_hz=300.0,
            high_cutoff_hz=6000.0,
        ),
    )


_NODE_FACTORIES = {
    "broadband_source": _make_broadband_source,
    "spectral_filter": lambda p: syn.SpectralFilter(
        method=str(p.get("filter_type", "butterworth")),
        low_cutoff_hz=float(p.get("low_cutoff_hz", 300)),
        high_cutoff_hz=float(p.get("high_cutoff_hz", 3000)),
    ),
    "spike_source": _make_spike_source,
    "optical_stimulation": lambda p: syn.OpticalStimulation(
        peripheral_id=0,
        pixel_mask=[],
        bit_width=int(p.get("bit_width", 8)),
        frame_rate=int(p.get("frame_rate", 30)),
        gain=float(p.get("gain", 1.0)),
    ),
}


class SimulatorRequest(BaseModel):
    name: str | None = None
    serial: str | None = None
    rpc_port: int | None = None
    discovery_port: int | None = None


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
    name = req.name or generate_slug(3)
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


@app.get("/api/devices/taps")
async def list_taps(uri: str):
    """List available taps on a running device."""
    def _list():
        tap = Tap(uri)
        return tap.list_taps()

    try:
        taps = await asyncio.to_thread(_list)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list taps: {e}")

    # Deduplicate by name (simulator reports same name for multiple nodes)
    seen: set[str] = set()
    unique = []
    for t in taps:
        if t.name not in seen:
            seen.add(t.name)
            unique.append({
                "name": t.name,
                "message_type": t.message_type,
                "endpoint": t.endpoint,
                "tap_type": t.tap_type,
            })

    return {"taps": unique}


def _decode_frame(raw: bytes, message_type: str) -> dict | None:
    if "BroadbandFrame" in message_type:
        frame = BroadbandFrame()
        frame.ParseFromString(raw)
        return {
            "type": "broadband",
            "timestamp_ns": frame.timestamp_ns,
            "sequence_number": frame.sequence_number,
            "sample_rate_hz": frame.sample_rate_hz,
            "num_channels": len(frame.frame_data),
            "frame_data": list(frame.frame_data),
        }
    # Unknown type — send hex-encoded raw bytes
    return {
        "type": "raw",
        "size": len(raw),
        "hex": raw[:64].hex(),
    }


@app.websocket("/api/devices/stream")
async def stream_tap(ws: WebSocket, uri: str, tap_name: str):
    """Stream tap data over WebSocket."""
    import zmq

    await ws.accept()

    # List taps to find the endpoint and message type
    tap_client = Tap(uri)
    taps = await asyncio.to_thread(tap_client.list_taps)
    selected = None
    for t in taps:
        if t.name == tap_name:
            selected = t
            break

    if not selected:
        await ws.send_json({"error": f"Tap '{tap_name}' not found"})
        await ws.close()
        return

    endpoint = selected.endpoint
    message_type = selected.message_type

    # Connect ZMQ directly using the endpoint as reported by the device
    # (don't let Tap.connect() substitute the host)
    zmq_ctx = zmq.Context()
    zmq_sock = zmq_ctx.socket(zmq.SUB)
    zmq_sock.setsockopt(zmq.RCVBUF, 16 * 1024 * 1024)
    zmq_sock.setsockopt(zmq.RCVHWM, 10000)
    zmq_sock.setsockopt(zmq.SUBSCRIBE, b"")
    zmq_sock.setsockopt(zmq.RCVTIMEO, 100)

    try:
        zmq_sock.connect(endpoint)
    except zmq.ZMQError as e:
        await ws.send_json({"error": f"Failed to connect to ZMQ endpoint: {e}"})
        await ws.close()
        zmq_sock.close()
        zmq_ctx.term()
        return

    await ws.send_json({"status": "connected", "tap_name": tap_name, "message_type": message_type})

    stop_event = asyncio.Event()

    def _read_batch() -> list[bytes]:
        """Read up to N messages from ZMQ without blocking the event loop."""
        msgs = []
        for _ in range(500):
            try:
                msgs.append(zmq_sock.recv(zmq.DONTWAIT))
            except zmq.Again:
                break
        return msgs

    async def _read_loop():
        batch_interval = 1.0 / 30
        idle_timeout = 5.0  # Close WS if no data for this long
        last_data_time = asyncio.get_event_loop().time()
        while not stop_event.is_set():
            raw_msgs = await asyncio.to_thread(_read_batch)
            if raw_msgs:
                last_data_time = asyncio.get_event_loop().time()
                frames = []
                for raw in raw_msgs:
                    decoded = _decode_frame(raw, message_type)
                    if decoded:
                        frames.append(decoded)
                if frames:
                    try:
                        await ws.send_text(json.dumps({"frames": frames}))
                    except Exception:
                        logger.debug("WebSocket send failed, closing stream", exc_info=True)
                        break
            else:
                if asyncio.get_event_loop().time() - last_data_time > idle_timeout:
                    stop_event.set()
                    await ws.close()
                    return
                await asyncio.sleep(batch_interval)

    async def _recv_loop():
        try:
            while not stop_event.is_set():
                await ws.receive_text()
        except Exception:
            logger.debug("WebSocket receive loop ended", exc_info=True)
        finally:
            stop_event.set()

    try:
        await asyncio.gather(_read_loop(), _recv_loop())
    finally:
        zmq_sock.close()
        zmq_ctx.term()


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
