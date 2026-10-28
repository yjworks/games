"""
천하삼분 지도 바탕 그림을 만든다.

재료(모두 퍼블릭 도메인, https://www.naturalearthdata.com/about/terms-of-use/):
  - Natural Earth 10m 「Shaded Relief」  SR_HR.tif        (음영 기복)
  - Natural Earth 50m 「Cross Blended Hypso with Shaded Relief and Water」  HYP_50M_SR_W.tif (고도 색·물)

  curl -O https://naciscdn.org/naturalearth/10m/raster/SR_HR.zip
  curl -O https://naciscdn.org/naturalearth/50m/raster/HYP_50M_SR_W.zip
  unzip SR_HR.zip && unzip HYP_50M_SR_W.zip
  python3 scripts/samguk-terrain.py <tif가 있는 폴더>

결과: public/samguk/terrain.webp (지도 그림), public/samguk/land.png (뭍=흰색 가면, 세력권 칠에 쓴다)
지도 범위는 src/games/samguk/data/cities.ts 의 project()와 같다(경도 97.5~125.5, 위도 19.5~43.0, 등장방형).
필요: pip install pillow numpy scipy
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None
SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'samguk')
L0, L1, A0, A1 = 97.5, 125.5, 43.0, 19.5
W, H = 1680, 1410  # 10m 해상도(1도 = 60px)


def crop(name, ppd):
    im = Image.open(os.path.join(SRC, name))
    box = (int((L0 + 180) * ppd), int((90 - A0) * ppd), int((L1 + 180) * ppd), int((90 - A1) * ppd))
    return im.crop(box)


sr = np.asarray(crop('SR_HR.tif', 60).resize((W, H)), dtype=np.float32) / 255.0
hyp = np.asarray(crop('HYP_50M_SR_W.tif', 30).resize((W, H), Image.BICUBIC), dtype=np.float32)
r, g, b = hyp[..., 0], hyp[..., 1], hyp[..., 2]

# ── 물 가면: 푸른 칸. 가는 강줄기는 지우고(옛 물길은 따로 그린다) 바다·큰 호수만 남긴다
water = (b > r + 14) & (b >= g - 2)
water = ndimage.binary_opening(water, iterations=3)
lab, n = ndimage.label(water)
sizes = ndimage.sum(water, lab, range(1, n + 1))
keep = np.zeros(n + 1, bool)
keep[1:] = sizes > 900
water = keep[lab]
land = ~water

# ── 뭍 색: 고도 색을 먹·황토 팔레트로 옮긴다
t = np.clip((r - g + 18) / 70.0, 0, 1)            # 0 낮은 들 → 1 고원
snow = np.clip((np.minimum(np.minimum(r, g), b) - 175) / 45.0, 0, 1)
low = np.array([136, 154, 98], np.float32)
mid = np.array([196, 170, 118], np.float32)
high = np.array([168, 138, 98], np.float32)
peak = np.array([226, 216, 196], np.float32)
t3 = t[..., None]
# 낮은 들에도 얼룩진 색 차이(누런 들·푸른 들)를 준다
rng0 = np.random.default_rng(3)
patch = np.clip(ndimage.gaussian_filter(rng0.standard_normal((H, W)), 28) * 42 + 0.45, 0, 1)[..., None]
low = low + (np.array([178, 170, 112], np.float32) - low) * patch
col = np.where(t3 < 0.55, low + (mid - low) * (t3 / 0.55), mid + (high - mid) * ((t3 - 0.55) / 0.45))
col = col + (peak - col) * snow[..., None]

# 강을 지운 자리는 둘레 뭍 색으로 채운다
m = land.astype(np.float32)
blur = lambda a, s: ndimage.gaussian_filter(a, s)  # noqa: E731
fill = np.stack([blur(col[..., k] * m, 6) / np.maximum(blur(m, 6), 1e-3) for k in range(3)], -1)
river = land & ((b > r + 10) & (b >= g - 6))
col = np.where(river[..., None], fill, col)

# ── 음영 기복: 평지 값을 1로 맞추고 대비를 키운다. 그늘은 따뜻한 갈색으로
flat = np.median(sr[land])
shade = 1 + (sr / flat - 1) * 1.45
shade = np.clip(shade, 0.35, 1.35)[..., None]
warm = np.where(shade < 1, np.array([1.0, 0.93, 0.84], np.float32), np.array([1.0, 1.0, 0.96], np.float32))
col = col * shade * (1 + (warm - 1) * np.abs(1 - shade))

col = col * np.array([1.02, 1.0, 0.93], np.float32)

# ── 종이 결: 큰 얼룩 + 고운 알갱이
rng = np.random.default_rng(7)
blot = ndimage.gaussian_filter(rng.standard_normal((H, W)), 60) * 9
grain = rng.standard_normal((H, W)) * 3.2
col = col + (blot + grain)[..., None]

# ── 바다: 물가는 옅은 청록, 먼 바다는 짙게. 물결 등고선 세 줄
dist = ndimage.distance_transform_edt(water)
deep = np.clip(dist / 140.0, 0, 1)[..., None]
shallow = np.array([168, 186, 170], np.float32)
deepc = np.array([112, 140, 140], np.float32)
sea = shallow + (deepc - shallow) * deep + (blot * 0.6 + grain * 0.6)[..., None]
for d0, a in ((7, 0.32), (15, 0.22), (26, 0.14)):
    ring = np.exp(-((dist - d0) ** 2) / 1.6)[..., None] * a
    sea = sea * (1 - ring) + np.array([70, 92, 92], np.float32) * ring
col = np.where(water[..., None], sea, col)

# ── 해안선: 먹선과 그 안쪽 밝은 띠
edge = land & ndimage.binary_dilation(water, iterations=1)
edge2 = land & ndimage.binary_dilation(water, iterations=3) & ~edge
col[edge] = col[edge] * 0.25 + np.array([52, 36, 22], np.float32) * 0.75
col[edge2] = col[edge2] * 0.8 + np.array([238, 226, 196], np.float32) * 0.2

# ── 가장자리 어둡게
yy, xx = np.mgrid[0:H, 0:W]
vig = 1 - 0.18 * (((xx / W - 0.5) * 2) ** 4 + ((yy / H - 0.5) * 2) ** 4)
col = col * vig[..., None]

os.makedirs(OUT, exist_ok=True)
img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), 'RGB')
img.save(os.path.join(OUT, 'terrain.webp'), 'WEBP', quality=80, method=6)
mask = Image.fromarray((land * 255).astype(np.uint8), 'L').resize((500, 430), Image.BILINEAR).filter(ImageFilter.GaussianBlur(0.6))
mask.save(os.path.join(OUT, 'land.png'), optimize=True)
print('terrain.webp', os.path.getsize(os.path.join(OUT, 'terrain.webp')) // 1024, 'KB;', 'land.png', os.path.getsize(os.path.join(OUT, 'land.png')) // 1024, 'KB')
