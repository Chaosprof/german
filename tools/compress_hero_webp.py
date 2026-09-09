"""Losslessly repack embedded PNG images in a GLB as required EXT_texture_webp.

Usage: python tools/compress_hero_webp.py [source.glb] [output.glb]
       python tools/compress_hero_webp.py --check [source.glb] [output.glb]
Requires Pillow with WebP support. Defaults to Berlin hero v12 -> v13.
Verification runs before the output is replaced: every decoded RGBA pixel,
every non-image bufferView byte, and all unrelated glTF JSON must match.
The shipped v13 was encoded with Pillow 12.3.0 / libwebp 1.6.0, lossless,
quality=100, method=6, exact=True. Encoder versions may change compressed bytes;
--check verifies decoded equivalence independently of encoder version.
"""
from __future__ import annotations

import argparse
import base64
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import re
import struct
import tempfile

from PIL import Image, features


JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
EXTENSION = "EXT_texture_webp"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def parse_glb(blob: bytes) -> tuple[dict, bytes]:
    require(len(blob) >= 20, "Truncated GLB")
    magic, version, length = struct.unpack_from("<III", blob)
    require(magic == 0x46546C67 and version == 2, "Expected a glTF 2.0 binary")
    require(length == len(blob), "GLB length does not match header")
    chunks = []
    cursor = 12
    while cursor < len(blob):
        require(cursor + 8 <= len(blob), "Truncated chunk header")
        size, kind = struct.unpack_from("<II", blob, cursor)
        require(size % 4 == 0 and cursor + 8 + size <= len(blob), "Invalid chunk size")
        chunks.append((kind, blob[cursor + 8:cursor + 8 + size]))
        cursor += 8 + size
    require([kind for kind, _ in chunks] == [JSON_CHUNK, BIN_CHUNK],
            "Expected exactly JSON and BIN chunks; refusing to discard other chunks")
    document = json.loads(chunks[0][1])
    buffers = document.get("buffers", [])
    require(len(buffers) == 1 and "uri" not in buffers[0], "Expected one embedded buffer")
    length = buffers[0]["byteLength"]
    require(0 <= len(chunks[1][1]) - length <= 3, "Invalid BIN buffer padding")
    return document, chunks[1][1][:length]


def pack_glb(document: dict, binary: bytes) -> bytes:
    metadata = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    metadata += b" " * (-len(metadata) % 4)
    padded_binary = binary + b"\0" * (-len(binary) % 4)
    chunks = (struct.pack("<II", len(metadata), JSON_CHUNK) + metadata +
              struct.pack("<II", len(padded_binary), BIN_CHUNK) + padded_binary)
    return struct.pack("<III", 0x46546C67, 2, 12 + len(chunks)) + chunks


def view_bytes(document: dict, binary: bytes, index: int) -> bytes:
    view = document["bufferViews"][index]
    require(view.get("buffer", 0) == 0, "External bufferView is unsupported")
    offset, size = view.get("byteOffset", 0), view["byteLength"]
    require(offset >= 0 and size >= 0 and offset + size <= len(binary), "BufferView out of bounds")
    return binary[offset:offset + size]


def decoded_rgba(payload: bytes) -> tuple[tuple[int, int], bytes]:
    with Image.open(io.BytesIO(payload)) as image:
        require(getattr(image, "n_frames", 1) == 1, "Animated images are unsupported")
        return image.size, image.convert("RGBA").tobytes()


def compress(source_blob: bytes) -> tuple[bytes, dict]:
    source, binary = parse_glb(source_blob)
    target = copy.deepcopy(source)
    require(features.check("webp"), "Pillow was built without WebP support")
    replacements = {}
    image_indices = set()
    for image_index, image in enumerate(source.get("images", [])):
        if image.get("mimeType") != "image/png":
            continue
        require("bufferView" in image and "uri" not in image, "PNG must be embedded")
        view_index = image["bufferView"]
        png = view_bytes(source, binary, view_index)
        if view_index not in replacements:
            with Image.open(io.BytesIO(png)) as original:
                output = io.BytesIO()
                # exact preserves RGB even where alpha is zero. Decode equality
                # below is authoritative, including encoders with older options.
                original.save(output, format="WEBP", lossless=True, quality=100,
                              method=6, exact=True)
            webp = output.getvalue()
            require(len(webp) < len(png), "Lossless WebP is not smaller than this PNG")
            require(decoded_rgba(png) == decoded_rgba(webp), "WebP changed decoded pixels")
            replacements[view_index] = webp
        target["images"][image_index]["mimeType"] = "image/webp"
        image_indices.add(image_index)
    require(bool(replacements), "No embedded PNG images to convert")

    # Retain every byte outside replaced image ranges, including inter-view
    # padding. Ranges end on four-byte boundaries so all following view offsets
    # stay aligned; no geometry/accessor data is decoded or regenerated.
    ranges = []
    for index, webp in replacements.items():
        view = source["bufferViews"][index]
        start = view.get("byteOffset", 0)
        require(start % 4 == 0, "Image bufferView must start on a four-byte boundary")
        end = min((start + view["byteLength"] + 3) & ~3, len(binary))
        ranges.append((start, end, index, webp))
    ranges.sort()
    for i, (start, end, image_view, _) in enumerate(ranges):
        require(i == 0 or start >= ranges[i - 1][1], "Overlapping image ranges")
        for index, view in enumerate(source["bufferViews"]):
            if index == image_view:
                continue
            offset = view.get("byteOffset", 0)
            require(offset + view["byteLength"] <= start or offset >= end,
                    "Image range overlaps another bufferView")
    parts, shifts, cursor, new_offset = [], [], 0, 0
    for start, end, index, webp in ranges:
        unchanged = binary[cursor:start]
        parts.append(unchanged)
        new_offset += len(unchanged)
        target["bufferViews"][index]["byteOffset"] = new_offset
        target["bufferViews"][index]["byteLength"] = len(webp)
        padded = webp + b"\0" * (-len(webp) % 4)
        parts.append(padded)
        new_offset += len(padded)
        shifts.append((end, len(padded) - (end - start)))
        cursor = end
    parts.append(binary[cursor:])
    target_binary = b"".join(parts)
    for index, view in enumerate(target["bufferViews"]):
        if index in replacements:
            continue
        offset = source["bufferViews"][index].get("byteOffset", 0)
        shift = sum(delta for end, delta in shifts if offset >= end)
        if "byteOffset" in view or shift:
            view["byteOffset"] = offset + shift
    target["buffers"][0]["byteLength"] = len(target_binary)

    converted_textures = 0
    for texture in target.get("textures", []):
        if texture.get("source") in image_indices:
            extensions = texture.setdefault("extensions", {})
            require(EXTENSION not in extensions, "Texture already has a WebP extension")
            extensions[EXTENSION] = {"source": texture.pop("source")}
            converted_textures += 1
    require(converted_textures > 0, "Converted image is not referenced by a texture")
    for key in ("extensionsUsed", "extensionsRequired"):
        extensions = target.setdefault(key, [])
        if EXTENSION not in extensions:
            extensions.append(EXTENSION)

    output_blob = pack_glb(target, target_binary)
    return output_blob, verify(source_blob, output_blob)


def verify(source_blob: bytes, output_blob: bytes) -> dict:
    """Verify existing files without running the WebP encoder."""
    source, binary = parse_glb(source_blob)
    verified, verified_binary = parse_glb(output_blob)
    image_indices = {i for i, image in enumerate(source.get("images", []))
                     if image.get("mimeType") == "image/png"}
    replacements = {source["images"][i]["bufferView"] for i in image_indices}
    require(bool(replacements), "No source PNG images to verify")
    image_reports, reported_views = [], set()
    converted_textures = sum(texture.get("source") in image_indices
                             for texture in source.get("textures", []))
    require(len(source["bufferViews"]) == len(verified["bufferViews"]), "BufferView count changed")
    require(len(source["images"]) == len(verified["images"]), "Image count changed")
    mutable_keys = {"images", "textures", "bufferViews", "buffers", "extensionsUsed", "extensionsRequired"}
    require({k: v for k, v in source.items() if k not in mutable_keys} ==
            {k: v for k, v in verified.items() if k not in mutable_keys},
            "Non-image scene, animation, accessor or material JSON changed")
    expected = copy.deepcopy(source)
    expected["buffers"][0]["byteLength"] = verified["buffers"][0]["byteLength"]
    nonimage_hash, preserved_views = hashlib.sha256(), 0
    for index, original_view in enumerate(source["bufferViews"]):
        new_view = verified["bufferViews"][index]
        mutable_view_keys = {"byteOffset", "byteLength"} if index in replacements else {"byteOffset"}
        require({k: v for k, v in original_view.items() if k not in mutable_view_keys} ==
                {k: v for k, v in new_view.items() if k not in mutable_view_keys},
                f"BufferView {index} metadata changed")
        expected["bufferViews"][index] = copy.deepcopy(new_view)
        if index not in replacements:
            before = view_bytes(source, binary, index)
            require(before == view_bytes(verified, verified_binary, index),
                    f"Non-image bufferView {index} bytes changed")
            nonimage_hash.update(struct.pack("<II", index, len(before)))
            nonimage_hash.update(before)
            preserved_views += 1
    for image_index in image_indices:
        index = source["images"][image_index]["bufferView"]
        png = view_bytes(source, binary, index)
        webp = view_bytes(verified, verified_binary, index)
        size, pixels = decoded_rgba(png)
        require((size, pixels) == decoded_rgba(webp), "Packed GLB changed decoded image pixels")
        with Image.open(io.BytesIO(webp)) as image:
            require(image.format == "WEBP", "Converted image is not actually WebP")
        expected["images"][image_index]["mimeType"] = "image/webp"
        if index not in reported_views:
            image_reports.append({"bufferView": index, "size": list(size),
                                  "pngBytes": len(png), "webpBytes": len(webp),
                                  "webpSHA256": hashlib.sha256(webp).hexdigest(),
                                  "rgbaSHA256": hashlib.sha256(pixels).hexdigest()})
            reported_views.add(index)
    for texture in expected.get("textures", []):
        if texture.get("source") in image_indices:
            texture.setdefault("extensions", {})[EXTENSION] = {"source": texture.pop("source")}
    for key in ("extensionsUsed", "extensionsRequired"):
        extensions = expected.setdefault(key, [])
        if EXTENSION not in extensions:
            extensions.append(EXTENSION)
    require(expected == verified, "Unexpected glTF metadata edit beyond image offsets/WebP extension")
    require(EXTENSION in verified["extensionsUsed"] and EXTENSION in verified["extensionsRequired"],
            "WebP extension must be used and required without a fallback")
    for texture in verified["textures"]:
        if EXTENSION in texture.get("extensions", {}):
            require("source" not in texture, "WebP-only texture must not claim a core fallback source")
            require(texture["extensions"][EXTENSION]["source"] in image_indices,
                    "WebP extension references the wrong image")
    return {"sourceBytes": len(source_blob), "outputBytes": len(output_blob),
                         "savedBytes": len(source_blob) - len(output_blob),
                         "savedPercent": round((1 - len(output_blob) / len(source_blob)) * 100, 3),
                         "images": image_reports, "convertedTextures": converted_textures,
                         "preservedNonimageBufferViews": preserved_views,
                         "nonimageBufferViewsSHA256": nonimage_hash.hexdigest(),
                         "accessors": len(source.get("accessors", [])),
                         "animations": len(source.get("animations", [])),
                         "outputSHA256": hashlib.sha256(output_blob).hexdigest()}


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", type=Path,
                        default=root / "assets/models/berlin-runner-hero-v12.glb")
    parser.add_argument("output", nargs="?", type=Path,
                        default=root / "assets/models/berlin-runner-hero-v13.glb")
    parser.add_argument("--check", action="store_true",
                        help="Verify existing GLB and .inline.js companion without encoding or writing")
    args = parser.parse_args()
    require(args.source.resolve() != args.output.resolve(), "Never overwrite the source GLB")
    if args.check:
        output = args.output.read_bytes()
        report = verify(args.source.read_bytes(), output)
        inline_path = args.output.with_suffix(".inline.js")
        matches = re.findall(rb"data:model/gltf-binary;base64,([A-Za-z0-9+/=]+)", inline_path.read_bytes())
        require(len(matches) == 1, "Inline companion must contain exactly one GLB data URI")
        require(base64.b64decode(matches[0], validate=True) == output,
                "Inline companion bytes differ from the verified GLB")
        print(json.dumps({"checked": str(args.output), "inlineMatches": True, **report}, indent=2))
        return
    output, report = compress(args.source.read_bytes())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=args.output.parent, suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(output)
        require(temporary.read_bytes() == output, "Written artifact did not match verified bytes")
        os.replace(temporary, args.output)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()
    print(json.dumps({"output": str(args.output), **report}, indent=2))


if __name__ == "__main__":
    main()
