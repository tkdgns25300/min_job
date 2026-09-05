#!/usr/bin/env python3
"""민잡 파비콘·앱 아이콘 생성 — `src/app/`의 icon.svg · favicon.ico · apple-icon.png.

프로젝트 의존성이 아니라 **로컬 python 3만으로** 돈다(`subset-og-font.py`와 같은 취지).
로컬에 SVG 래스터라이저(rsvg/inkscape/ImageMagick/Pillow)가 없어서 폴리곤을 직접 찍고
PNG·ICO를 손으로 엮는다 — 마크가 직선 도형뿐이라 그게 더 짧다.

    python3 scripts/make-icons.py

⚠️ **글리프를 폰트로 그리지 않는다** — 파비콘은 만드는 기계의 폰트에 따라 달라지면 안 되고,
   SVG `<text>`는 보는 브라우저에 그 폰트가 있어야 한다. 그래서 M을 폴리곤 좌표로 박아 둔다.
"""

import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "app"

# 브랜드 색 — globals.css의 --brand-900 / --gold와 같은 값(단일 소스는 CSS, 여기는 사본)
BG = (0x15, 0x33, 0x2A)
FG = (0xD3, 0xAD, 0x63)

# 100×100 좌표계의 M 외곽선(시계 방향 한 바퀴). 왼쪽 기둥 17~31 · 오른쪽 기둥 69~83 ·
# 캡 23~79 · V의 바깥 꼭짓점 y=49, 안쪽 끝 y=64.
# ⚠️ **글자를 크게, V를 깊게** 잡은 값이다(운영자 선택 2026-09-05). 여백을 더 준 시안은 120px에서는
#    차분했지만 **16px에서 획이 붙어 뭉갰다** — 파비콘은 가장 작은 크기가 기준이다.
M_OUTLINE = [
    (17, 23), (31, 23), (50, 49), (69, 23), (83, 23), (83, 79),
    (69, 79), (69, 42), (53, 64), (47, 64), (31, 42), (31, 79), (17, 79),
]
TILE_RADIUS = 22  # 둥근 사각 타일의 모서리 반지름(100 기준)


def _inside_polygon(x: float, y: float, poly) -> bool:
    """짝수-홀수 규칙. 경계는 어느 쪽이든 상관없다 — 슈퍼샘플링이 가장자리를 녹인다."""
    inside = False
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            inside = not inside
    return inside


def _inside_round_rect(x: float, y: float, size: float, r: float) -> bool:
    cx = min(max(x, r), size - r)
    cy = min(max(y, r), size - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def render(size: int, ss: int = 6, rounded: bool = True) -> bytes:
    """RGBA 픽셀. `ss`배로 찍어 평균 내는 것이 여기서 유일한 안티에일리어싱이다."""
    scale = 100.0 / size
    px = bytearray(size * size * 4)
    weight = 1.0 / (ss * ss)
    for py in range(size):
        for pxi in range(size):
            cover_bg = 0.0
            cover_fg = 0.0
            for sy in range(ss):
                for sx in range(ss):
                    ux = (pxi + (sx + 0.5) / ss) * scale
                    uy = (py + (sy + 0.5) / ss) * scale
                    if rounded and not _inside_round_rect(ux, uy, 100.0, TILE_RADIUS):
                        continue
                    cover_bg += weight
                    if _inside_polygon(ux, uy, M_OUTLINE):
                        cover_fg += weight
            i = (py * size + pxi) * 4
            if cover_bg <= 0:
                continue
            # 타일 안쪽만 불투명하고, 그 안에서 글자 비율만큼 금색을 섞는다
            t = cover_fg / cover_bg
            for c in range(3):
                px[i + c] = round(BG[c] * (1 - t) + FG[c] * t)
            px[i + 3] = round(255 * cover_bg)
    return bytes(px)


def png(size: int, rgba: bytes) -> bytes:
    rows = b"".join(b"\x00" + rgba[y * size * 4 : (y + 1) * size * 4] for y in range(size))

    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(rows, 9))
        + chunk(b"IEND", b"")
    )


def ico(images) -> bytes:
    """PNG를 그대로 품는 ICO(Vista+). 16·32·48을 한 파일에 넣어 탭·북마크·바탕화면을 덮는다."""
    offset = 6 + 16 * len(images)
    entries, blob = b"", b""
    for size, data in images:
        entries += struct.pack(
            "<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(data), offset
        )
        blob += data
        offset += len(data)
    return struct.pack("<HHH", 0, 1, len(images)) + entries + blob


def svg() -> str:
    path = " ".join(
        ("M" if i == 0 else "L") + f" {x} {y}" for i, (x, y) in enumerate(M_OUTLINE)
    ) + " Z"
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n'
        f'  <rect width="100" height="100" rx="{TILE_RADIUS}" fill="#{BG[0]:02x}{BG[1]:02x}{BG[2]:02x}"/>\n'
        f'  <path d="{path}" fill="#{FG[0]:02x}{FG[1]:02x}{FG[2]:02x}"/>\n'
        "</svg>\n"
    )


def main() -> None:
    (OUT / "icon.svg").write_text(svg(), encoding="utf-8")
    print("icon.svg")

    sizes = [16, 32, 48]
    (OUT / "favicon.ico").write_bytes(ico([(s, png(s, render(s, ss=8))) for s in sizes]))
    print("favicon.ico", sizes)

    # 애플 홈 화면은 모서리를 자기가 깎고 투명도를 싫어한다 — 꽉 찬 사각으로 준다
    (OUT / "apple-icon.png").write_bytes(png(180, render(180, ss=3, rounded=False)))
    print("apple-icon.png 180")


if __name__ == "__main__":
    main()
