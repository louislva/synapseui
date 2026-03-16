"""
Synapse Streaming Demo — Minimum Prototype & Explainer
=======================================================

This script walks through the full lifecycle of connecting to a Synapse device
(or simulator), configuring a signal processing pipeline, and streaming live
neural data to your terminal.

Architecture recap:
    - The Synapse device (or simulator) runs a gRPC server for control (configure,
      start, stop, query) and ZMQ PUB sockets for high-throughput data streaming.
    - The client SDK (`synapse`) talks gRPC to set up the device, then discovers
      ZMQ endpoints ("taps") via a gRPC query, and subscribes to them directly.
    - Data flows through a node graph ON the device. Nodes are connected in a
      pipeline: source → filter → ... → output. Each node processes data and
      passes it downstream via async queues.

The pipeline we build here:

    BroadbandSource (generates 30kHz, 12-bit samples across 8 channels)
         |
         v
    SpectralFilter (bandpass 300-3000Hz, Butterworth order 4)
         |
         v
    ZMQ PUB socket (tap: "broadband_source_sim")
         |
         v  <-- network boundary (ZMQ over TCP) -->
    This script (ZMQ SUB) → parse BroadbandFrame protobuf → print to terminal

Usage:
    1. Start the simulator in one terminal:
       uv run synapse-sim --iface-ip 127.0.0.1 --name DemoDevice --serial SIM001

    2. Run this script in another:
       uv run python stream_demo.py
"""

import sys
import time

# The `synapse` package re-exports everything from synapse.client:
#   Device, Config, Channel, SignalConfig, ElectrodeConfig,
#   BroadbandSource, SpectralFilter, DiskWriter, etc.
import synapse as syn

# Tap is the ZMQ streaming client — not re-exported from the top level,
# so we import it directly.
from synapse.client.taps import Tap

# BroadbandFrame is the protobuf message type that arrives over ZMQ.
# Each frame = one time-step across all channels.
from synapse.api.datatype_pb2 import BroadbandFrame

# Enum for spectral filter mode (kLowPass, kHighPass, kBandPass, kBandStop).
from synapse.api.nodes.spectral_filter_pb2 import SpectralFilterMethod


# The simulator listens on port 647 (Synapse's default gRPC port).
DEVICE_URI = "127.0.0.1:647"


# =============================================================================
# Step 1: Connect to the device
# =============================================================================
# syn.Device opens a gRPC channel to the device/simulator.
# .info() is a simple RPC that returns the device name, serial, and status.

print(f"Connecting to {DEVICE_URI}...")
device = syn.Device(DEVICE_URI)
info = device.info()
print(f"  Name:   {info.name}")
print(f"  Serial: {info.serial}")
print()


# =============================================================================
# Step 2: Build a configuration (node graph)
# =============================================================================
# A Config describes what the device should do: which nodes to instantiate and
# how to wire them together. This is purely declarative — lightweight config
# objects that serialize to protobuf and get sent over gRPC.

# Channels map logical IDs to physical electrode pairs on the recording array.
# Each channel reads the voltage difference between its electrode and reference.
channels = [
    syn.Channel(
        id=ch,
        electrode_id=ch * 2,        # even pins are signal electrodes
        reference_id=ch * 2 + 1,    # odd pins are references
    )
    for ch in range(8)  # 8 channels — keep it small for terminal readability
]

# BroadbandSource is the data origin. On real hardware this reads from the ADC;
# in the simulator it generates random samples within the bit-width range.
broadband = syn.BroadbandSource(
    peripheral_id=1,           # which hardware peripheral to use
    sample_rate_hz=30000,      # 30 kHz — standard for neural broadband
    bit_width=12,              # 12-bit ADC resolution (0–4095 unsigned)
    gain=20.0,                 # amplifier gain
    signal=syn.SignalConfig(
        electrode=syn.ElectrodeConfig(
            channels=channels,
            low_cutoff_hz=300.0,   # hardware-level analog filter band
            high_cutoff_hz=6000.0,
        )
    ),
)

# SpectralFilter applies a digital Butterworth filter on the device.
# This runs server-side (in the simulator process), so the data that
# reaches us over ZMQ is already filtered.
spectral = syn.SpectralFilter(
    method=SpectralFilterMethod.kBandPass,  # pass frequencies in [low, high]
    low_cutoff_hz=300.0,                    # Hz — reject below this
    high_cutoff_hz=3000.0,                  # Hz — reject above this
)

# Config.add_node() assigns auto-incrementing IDs to each node.
# Config.connect() records a directed edge (src → dst) in the graph.
# When sent to the device, the server instantiates the runtime node objects
# and wires them with async queues (emit_data → on_data_received).
config = syn.Config()
config.add_node(broadband)
config.add_node(spectral)
config.connect(broadband, spectral)

# .configure() serializes the Config to a DeviceConfiguration protobuf and
# sends it via gRPC. The server tears down any existing pipeline and rebuilds.
print("Configuring device...")
device.configure(config)

# .start() tells the device to begin running all nodes. Source nodes start
# generating data, filters start processing, and ZMQ sockets start publishing.
print("Starting device...")
device.start()
print()


# =============================================================================
# Step 3: Discover available taps
# =============================================================================
# A "tap" is a named ZMQ endpoint that a node exposes for external streaming.
# The client discovers taps by sending a gRPC Query(kListTaps) request.
# The server responds by calling tap_connections() on every running node,
# which returns the dynamically-assigned ZMQ endpoint (random port, bound at
# node start time).

tap = Tap(DEVICE_URI)
taps = tap.list_taps()

print(f"Available taps ({len(taps)}):")
for i, t in enumerate(taps):
    # Each tap has: name, endpoint (tcp://ip:port), message_type, tap_type
    print(f"  [{i}] {t.name}  ({t.message_type})  @ {t.endpoint}")
print()

if not taps:
    print("No taps found! Is the device running?")
    device.stop()
    sys.exit(1)


# =============================================================================
# Step 4: Connect to a tap
# =============================================================================
# We look for a tap whose message_type is "synapse.BroadbandFrame" — that's
# the protobuf type we know how to decode.
#
# tap.connect() does the following under the hood:
#   1. Calls list_taps() to get current endpoints
#   2. Finds the tap by name
#   3. Substitutes the server's internal IP with our device URI's IP
#      (so it works across networks) while keeping the dynamic port
#   4. Creates a ZMQ SUB socket and connects to the endpoint
#   5. Subscribes to all messages (empty filter = receive everything)

selected = None
for t in taps:
    if t.message_type == "synapse.BroadbandFrame":
        selected = t
        break

if not selected:
    print("No BroadbandFrame tap found, using first available.")
    selected = taps[0]

print(f"Connecting to tap: {selected.name}")
if not tap.connect(selected.name):
    print("Failed to connect to tap!")
    device.stop()
    sys.exit(1)

print("Streaming... (Ctrl+C to stop)")
print("-" * 72)
print(f"{'seq':>8}  {'timestamp_ns':>18}  {'rate':>6}  {'ch':>3}  {'samples (first 8)':>40}")
print("-" * 72)


# =============================================================================
# Step 5: Stream and display data
# =============================================================================
# tap.stream() is a generator that yields raw bytes from the ZMQ SUB socket.
# Each message is a serialized BroadbandFrame protobuf containing:
#   - timestamp_ns:      nanosecond timestamp of this sample
#   - sequence_number:   monotonically increasing counter (gaps = dropped frames)
#   - frame_data:        list of int16 sample values, one per channel
#   - sample_rate_hz:    the sample rate (redundant but useful for validation)
#
# On the simulator, frame_data values are random ints in [0, 2^bit_width - 1].
# On real hardware, these would be actual ADC readings from neural electrodes.

frame_count = 0
t_start = time.time()

try:
    for raw in tap.stream(timeout_ms=1000):
        # Deserialize the protobuf from raw bytes
        frame = BroadbandFrame()
        frame.ParseFromString(raw)

        # Show the first 8 sample values (one per channel)
        samples_preview = list(frame.frame_data[:8])
        samples_str = ", ".join(f"{s:>5}" for s in samples_preview)

        print(
            f"{frame.sequence_number:>8}  "
            f"{frame.timestamp_ns:>18}  "
            f"{frame.sample_rate_hz:>6}  "
            f"{len(frame.frame_data):>3}  "
            f"[{samples_str}]"
        )

        frame_count += 1

        # Periodic throughput stats
        if frame_count % 1000 == 0:
            elapsed = time.time() - t_start
            print(f"  --- {frame_count} frames in {elapsed:.1f}s ({frame_count/elapsed:.0f} frames/s) ---")

except KeyboardInterrupt:
    pass

elapsed = time.time() - t_start
print()
print(f"Done. {frame_count} frames in {elapsed:.1f}s ({frame_count/elapsed:.0f} frames/s)")


# =============================================================================
# Step 6: Cleanup
# =============================================================================
# Disconnect the ZMQ socket and stop the device (which stops all nodes and
# closes their ZMQ PUB sockets).

tap.disconnect()
device.stop()
print("Device stopped.")
