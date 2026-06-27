"""List contents of a Godot 4 .pck file, largest first."""
import struct
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "godot-runner/build/ArtikelRunner.pck"
with open(path, "rb") as f:
    magic = f.read(4)
    assert magic == b"GDPC", magic
    pack_ver, v_major, v_minor, v_patch = struct.unpack("<4I", f.read(16))
    flags = 0
    file_base = 0
    if pack_ver >= 2:
        flags, file_base = struct.unpack("<IQ", f.read(12))
    f.read(16 * 4)  # reserved
    (count,) = struct.unpack("<I", f.read(4))
    entries = []
    for _ in range(count):
        (plen,) = struct.unpack("<I", f.read(4))
        p = f.read(plen).rstrip(b"\x00").decode("utf-8", "replace")
        off, size = struct.unpack("<QQ", f.read(16))
        f.read(16)  # md5
        if pack_ver >= 2:
            f.read(4)  # per-file flags
        entries.append((size, p))
entries.sort(reverse=True)
total = sum(s for s, _ in entries)
print(f"pack v{pack_ver} godot {v_major}.{v_minor}.{v_patch} files={count} total={total/1e6:.1f} MB")
for s, p in entries[:35]:
    print(f"{s/1e6:9.2f} MB  {p}")
