"""Prepare desktop font files from the website's existing Satoshi WOFF2 assets."""
from pathlib import Path
import json
import subprocess
import sys
import types

# FontTools supplies the WOFF2 table transforms. Node's built-in Brotli decoder
# avoids installing a second Python package just to decompress this source font.
try:
    import brotli  # noqa: F401
except ImportError:
    def decompress(data):
        return subprocess.run(
            ["node", "-e", "process.stdout.write(require('node:zlib').brotliDecompressSync(require('node:fs').readFileSync(0)))"],
            input=data, stdout=subprocess.PIPE, check=True,
        ).stdout
    sys.modules["brotli"] = types.SimpleNamespace(decompress=decompress)

from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
destination = root / "design" / "figma" / "fonts"
destination.mkdir(parents=True, exist_ok=True)
fonts = []
for source in sorted((root / "assets" / "fonts").glob("*.woff2")):
    font = TTFont(source)
    font.flavor = None
    style = source.stem.removeprefix("satoshi-").title()
    family = "RYDEPRO Satoshi"
    # These web assets contain placeholder internal names. Use a distinct
    # desktop family so they neither collide with nor replace installed fonts.
    names = {1: family, 2: style, 3: f"RYDEPRO-Satoshi-Web-{style}",
             4: f"{family} {style}", 6: f"RYDEPROSatoshi-{style}",
             16: family, 17: style}
    for record in font["name"].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
    for name_id, value in names.items():
        font["name"].setName(value, name_id, 3, 1, 0x409)
    extension = ".otf" if font.sfntVersion == "OTTO" else ".ttf"
    output = destination / (source.stem + extension)
    font.save(output)
    fonts.append({"file": output.name, "family": font["name"].getDebugName(1), "style": font["name"].getDebugName(2)})
print(json.dumps(fonts, indent=2))
