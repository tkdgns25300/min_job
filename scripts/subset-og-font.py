"""
공고별 OG 이미지용 한글 글꼴 만들기 — `src/app/fonts/pretendard-bold-subset.ttf`

왜 필요한가: 공유 미리보기(카카오톡 등)는 우리 서버가 **그린 PNG**를 받아간다. 서버에는 글꼴이 없어
`ImageResponse`(satori)에 글꼴 파일을 넘겨야 하는데, 사이트 글꼴 `PretendardVariable.woff2`는
① woff2라 satori가 못 읽고 ② 한글 전체 11,172자에 2MB가 넘는다. 그래서 굵기 하나(700)로 고정한 뒤
KS X 1001 완성형 2,350자 + ASCII + 문장부호만 남긴다(약 450KB). 굵기 위계는 이미지 쪽에서 크기로 잡는다.

⚠️ 2,350자 밖의 음절("뱡"·"숑" 같은 교회명)은 이미지에서 **빈칸**으로 나온다 — 페이지는 멀쩡하고
   썸네일 글자 하나가 빠질 뿐이다. 실데이터에 그런 글자가 보이면 `--also`로 넘겨 다시 만든다
   (2026-09-05 기준 공고 제목·교회명·시군구에 쓰인 452자는 전부 포함돼 있다).

실행(도구는 프로젝트 의존성이 아니라 로컬 파이썬 환경에):
    python3 -m venv /tmp/fontenv && /tmp/fontenv/bin/pip install fonttools brotli
    /tmp/fontenv/bin/python scripts/subset-og-font.py [--also "뱡숑…"]
"""

import argparse
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SRC = "src/app/fonts/PretendardVariable.woff2"
OUT = "src/app/fonts/pretendard-bold-subset.ttf"
WEIGHT = 700
# 라벨·수치에 쓰는 기호 — 가운뎃점(·) 없으면 "경기 · 성남"의 점이 빈칸이 된다
PUNCTUATION = " ·×–—‘’“”…₩→、。"


def ksx1001_syllables() -> set[str]:
    """KS X 1001 완성형 2,350자 — `iso2022_kr`(엄격 KS X 1001)로 인코딩되는 음절만.
    ⚠️ `euc_kr`은 쓰지 않는다: 파이썬의 euc_kr은 확장(UHC)이라 11,172자를 전부 통과시킨다."""
    out: set[str] = set()
    for cp in range(0xAC00, 0xD7A4):
        ch = chr(cp)
        try:
            ch.encode("iso2022_kr")
            out.add(ch)
        except UnicodeEncodeError:
            pass
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--also", default="", help="추가로 넣을 글자(공고 제목·교회명에서 뽑은 것)")
    args = ap.parse_args()

    base = ksx1001_syllables()
    chars = set(base) | {chr(c) for c in range(0x20, 0x7F)} | set(PUNCTUATION) | set(args.also)
    extra_hangul = sorted(c for c in args.also if "가" <= c <= "힣" and c not in base)

    font = TTFont(SRC)
    static = instancer.instantiateVariableFont(font, {"wght": WEIGHT})
    static.flavor = None  # woff2 → 컨테이너 없는 TTF (satori가 읽는 형식)

    options = subset.Options()
    options.hinting = False
    options.notdef_outline = True
    options.name_IDs = ["*"]
    options.layout_features = ["kern"]
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=sorted(ord(c) for c in chars))
    subsetter.subset(static)
    static.save(OUT)

    print(f"KS X 1001 음절 {len(base)}자 + 추가 한글 {len(extra_hangul)}자 {''.join(extra_hangul)!r}")
    print(f"글리프 {len(static.getGlyphOrder())}개 · {os.path.getsize(OUT) // 1024}KB → {OUT}")


if __name__ == "__main__":
    sys.exit(main())
