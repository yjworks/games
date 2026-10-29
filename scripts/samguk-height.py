"""
천하삼분 3D 지도용 고도 그림을 만든다.

재료: AWS Open Data 「Terrain Tiles」(terrarium PNG, https://registry.opendata.aws/terrain-tiles/)
      이 지역은 SRTM·GMTED2010·ETOPO1 — 모두 미국 정부 자료로 퍼블릭 도메인이다.
  python3 scripts/samguk-height.py

지도 범위는 src/games/samguk/data/cities.ts 의 project()와 같다(경도 97.5~125.5, 위도 19.5~43.0, 등장방형).
결과: public/samguk/height.png — 8비트 회색. 값 v의 높이 = (v/255)^2 × 5200m, 바다는 0.
필요: pip install pillow numpy
"""
import io
import math
import os
import urllib.request

import numpy as np
from PIL import Image

L0, L1, A0, A1 = 97.5, 125.5, 43.0, 19.5
Z = 6
OUT_W, OUT_H = 700, 600
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'samguk', 'height.png')


def tile_xy(lon, lat):
    n = 2 ** Z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y


x0, y0 = tile_xy(L0, A0)
x1, y1 = tile_xy(L1, A1)
tx0, tx1, ty0, ty1 = int(x0), int(x1), int(y0), int(y1)
mosaic = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256), np.float32)
for ty in range(ty0, ty1 + 1):
    for tx in range(tx0, tx1 + 1):
        url = f'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{Z}/{tx}/{ty}.png'
        data = urllib.request.urlopen(url, timeout=60).read()
        a = np.asarray(Image.open(io.BytesIO(data)).convert('RGB'), np.float32)
        h = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
        mosaic[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = h
        print('tile', tx, ty)

# 등장방형 격자로 다시 뽑는다
lons = L0 + (np.arange(OUT_W) + 0.5) / OUT_W * (L1 - L0)
lats = A0 - (np.arange(OUT_H) + 0.5) / OUT_H * (A0 - A1)
gx = np.array([tile_xy(lo, A0)[0] for lo in lons]) - tx0
gy = np.array([tile_xy(L0, la)[1] for la in lats]) - ty0
px = np.clip(gx * 256, 0, mosaic.shape[1] - 1)
py = np.clip(gy * 256, 0, mosaic.shape[0] - 1)
X, Y = np.meshgrid(px, py)
xi, yi = X.astype(int), Y.astype(int)
fx, fy = X - xi, Y - yi
xi2, yi2 = np.minimum(xi + 1, mosaic.shape[1] - 1), np.minimum(yi + 1, mosaic.shape[0] - 1)
h = (mosaic[yi, xi] * (1 - fx) + mosaic[yi, xi2] * fx) * (1 - fy) + (mosaic[yi2, xi] * (1 - fx) + mosaic[yi2, xi2] * fx) * fy
h = np.clip(h, 0, 5200)
v = np.sqrt(h / 5200) * 255
os.makedirs(os.path.dirname(OUT), exist_ok=True)
Image.fromarray(np.clip(v, 0, 255).astype(np.uint8), 'L').save(OUT, optimize=True)
print('height.png', os.path.getsize(OUT) // 1024, 'KB')
