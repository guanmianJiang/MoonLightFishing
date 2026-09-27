"""Build compact WOFF2 subsets for the game's authored Chinese interface text.

Requires fonttools and brotli. Pass Noto Sans SC and Noto Serif SC variable TTF
paths as the two arguments. The source fonts are licensed under SIL OFL 1.1.
"""

from pathlib import Path
import sys

from fontTools import subset
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "dist"
OUTPUT = SOURCE / "assets" / "fonts"
OUTPUT.mkdir(parents=True, exist_ok=True)

characters = set("\n \t0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
for path in SOURCE.rglob("*"):
    if "dist" in path.relative_to(SOURCE).parts:
        continue
    if path.suffix not in {".js", ".jsx", ".mjs", ".html", ".css"}:
        continue
    characters.update(path.read_text(encoding="utf-8", errors="ignore"))

for source, name in zip(sys.argv[1:3], ("noto-sans-sc-ui", "noto-serif-sc-ui"), strict=True):
    font = TTFont(source)
    options = subset.Options()
    options.flavor = "woff2"
    options.hinting = False
    options.layout_features = ["*"]
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text="".join(characters))
    subsetter.subset(font)
    font.flavor = "woff2"
    target = OUTPUT / f"{name}.woff2"
    font.save(target)
    print(f"{target.relative_to(ROOT)}: {target.stat().st_size:,} bytes")
