"""
천하삼분 명조 글꼴 조각을 만든다 — 게임 소스에 나오는 글자 + KS X 1001 한글 2,350자 + ASCII만 남긴다.

재료: @fontsource/noto-serif-kr (SIL OFL 1.1)
  npm pack @fontsource/noto-serif-kr@5.3.1 && tar xzf fontsource-noto-serif-kr-5.3.1.tgz
  python3 scripts/samguk-font.py . public/vendor/fonts/noto-serif-kr
(첫 인자는 저장소 뿌리, package/ 폴더가 있는 곳에서 실행)
필요: pip install fonttools brotli
"""
import glob, sys, os
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.merge import Merger
root = sys.argv[1]; out = sys.argv[2]
chars = set()
for f in glob.glob(root + '/src/games/samguk/**/*.ts*', recursive=True):
    chars |= set(open(f, encoding='utf-8').read())
for b1 in range(0xB0, 0xC9):
    for b2 in range(0xA1, 0xFF):
        try: chars.add(bytes([b1, b2]).decode('euc-kr'))
        except Exception: pass
chars |= set(chr(c) for c in range(0x20, 0x7F))
chars |= set('·×–—…「」『』《》〈〉、。，！？：；（）％')
text = ''.join(sorted(c for c in chars if c.isprintable()))
for w in ['500', '800']:
    pieces = sorted(glob.glob(f'package/files/noto-serif-kr-*-{w}-normal.woff2'))
    keep = []
    for p in pieces:
        f = TTFont(p)
        cmap = f.getBestCmap()
        if any(ord(c) in cmap for c in text):
            ttf = p.replace('.woff2', '.ttf').replace('package/files/', 'tmp_')
            f.flavor = None; f.save(ttf); keep.append(ttf)
    print(w, len(pieces), 'pieces ->', len(keep))
    m = Merger().merge(keep)
    m.save(f'merged-{w}.ttf')
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
    font = TTFont(f'merged-{w}.ttf')
    s = subset.Subsetter(opts); s.populate(text=text); s.subset(font)
    font.flavor = 'woff2'
    dst = f'{out}/noto-serif-kr-{w}.woff2'
    font.save(dst)
    print(dst, os.path.getsize(dst) // 1024, 'KB')
    for k in keep: os.remove(k)
