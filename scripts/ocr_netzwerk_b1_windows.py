"""OCR Netzwerk neu B1 glossary pages with the Windows OCR engine.

The B1 PDF stores most glossary body text as image fragments, so PyMuPDF can
extract only headers. This script renders each page, calls Windows.Media.Ocr
for line text, and writes a page-marked JSONL-ish audit file.

Requires: Windows with an OCR language installed, and PyMuPDF in the Python
interpreter used to run this script.
"""
import json
import subprocess
import sys
from pathlib import Path

import fitz  # type: ignore[import-untyped]


ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "sources" / "NWn_B1_Glossar_Englisch.pdf"
OUT = ROOT / "audit" / "nwn_b1_ocr_lines.txt"
IMAGE_DIR = ROOT / "audit" / "nwn_b1_ocr_pages"
SCALE = 3
MAX_LINES = 260


PS_HEADER = r"""
$ErrorActionPreference='SilentlyContinue'
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null=[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
$null=[Windows.Graphics.Imaging.BitmapPixelFormat,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
$null=[Windows.Graphics.Imaging.BitmapAlphaMode,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
$null=[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$as=([System.WindowsRuntimeSystemExtensions].GetMethods()|Where-Object{$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.IsGenericMethodDefinition})[0]
function Await($op,$type){$m=$as.MakeGenericMethod($type);$t=$m.Invoke($null,@($op));$t.Wait();$t.Result}
$engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$file=Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($args[0])) ([Windows.Storage.StorageFile])
$stream=Await ($file.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
$decoder=Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap=Await ($decoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,[Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied)) ([Windows.Graphics.Imaging.SoftwareBitmap])
$result=Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$arr=@($result.Lines)
"""


def powershell_script() -> str:
    lines = [PS_HEADER]
    # Avoid PowerShell loops here. On this WinRT projection, loops after OCR can
    # terminate early. Direct indexed reads work reliably; out-of-range reads are
    # suppressed by ErrorActionPreference.
    for i in range(MAX_LINES):
        lines.append(f"Write-Output ($arr[{i}].Text | ConvertTo-Json -Compress)")
    return "\n".join(lines)


def ocr_image(image_path: Path) -> list[str]:
    script = powershell_script()
    ps_path = OUT.parent / "ocr_one_page.ps1"
    ps_path.write_text(script, encoding="utf-8")
    result = subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(ps_path),
            str(image_path),
        ],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=True,
    )
    out: list[str] = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            value = line
        if isinstance(value, str) and value.strip():
            out.append(value.strip())
    return out


def main() -> None:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(PDF)
    chunks: list[str] = []
    for i, page in enumerate(doc, start=1):
        image_path = IMAGE_DIR / f"page-{i:02d}.png"
        if not image_path.exists():
            pix = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE), alpha=False)
            pix.save(image_path)
        lines = ocr_image(image_path)
        chunks.append(f"=== PAGE {i} ===")
        chunks.extend(lines)
        print(f"Page {i:02d}: {len(lines)} OCR lines", flush=True)

    OUT.write_text("\n".join(chunks) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({len(doc)} pages)")


if __name__ == "__main__":
    if sys.platform != "win32":
        raise SystemExit("This OCR helper uses Windows.Media.Ocr and must run on Windows.")
    main()
