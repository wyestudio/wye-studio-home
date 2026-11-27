"""공유 카드(ImageResponse)용 주아 글꼴 — 카드에 나오는 글자만 남긴 TTF 를 만든다.

next/font 가 받아 둔 주아 woff2 조각(유니코드 범위별로 100개쯤)에서 필요한 글자를 가진 조각만 골라 합친다.
쓰기: python3 build-font.py <.next/dev/static/media 폴더> <나올 ttf 경로>
"""
import sys, glob, os, io
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.merge import Merger

TEXT = (
    "0123456789-+!?.,%/ "
    "우주이스케이프"
    "산타의 어드벤트 캘린더"
    "크리스마스 이벤트 게임"
    "내 랭킹 점수 기록 위 점 라운드"
    "내 기록에 도전해 보세요"
    "게임하고 크리스마스 선물 받아가세요"
)
need = {ord(c) for c in TEXT if c != " "} | {0x20}
media, out = sys.argv[1], sys.argv[2]
parts = []
left = set(need)
for f in sorted(glob.glob(os.path.join(media, "*.woff2"))):
    font = TTFont(f)
    if "Jua" not in (font["name"].getDebugName(1) or ""):
        continue
    have = set(font.getBestCmap()) & left
    if not have:
        continue
    opts = subset.Options(); opts.layout_features = []; opts.name_IDs = [1, 2, 4, 6]; opts.notdef_outline = True
    s = subset.Subsetter(opts); s.populate(unicodes=have); s.subset(font)
    font.flavor = None
    tmp = f"{out}.part{len(parts)}.ttf"; font.save(tmp); parts.append(tmp)
    left -= have
if left:
    sys.exit("글꼴 조각에 없는 글자: " + "".join(chr(c) for c in sorted(left)))
merged = Merger().merge(parts) if len(parts) > 1 else TTFont(parts[0])
merged.save(out)
for p in parts: os.remove(p)
check = TTFont(out)
print(len(parts), "조각 →", out, os.path.getsize(out), "bytes,", len(check.getBestCmap()), "글자, upm", check["head"].unitsPerEm)
