"""
Convert siftline.ico to siftline-src.png for macOS builds.
Called by GitHub Actions build-mac job.
Requires: pip install Pillow
"""
from PIL import Image
import os, sys

ico_path = "siftline.ico"
out_path = "siftline-src.png"

if not os.path.exists(ico_path):
    print(f"ERROR: {ico_path} not found", file=sys.stderr)
    sys.exit(1)

img = Image.open(ico_path)
img = img.convert("RGBA")
img = img.resize((1024, 1024), Image.LANCZOS)
img.save(out_path)
print(f"OK: {out_path} created at {img.size}")
