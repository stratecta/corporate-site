# -*- coding: utf-8 -*-
# 地球儀用の地表画像を生成する（現行ヒーロー写真の「暗い面に青緑の輪郭線」を踏襲）
# 入力：three-globe 2.32.1 の earth-water.png（海陸の区分）と earth-topology.png（標高）
import sys
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
W, H = 2048, 1024

water = Image.open(src + "/earth-water.png").convert("L").resize((W, H), Image.LANCZOS)
topo = Image.open(src + "/earth-topology.png").convert("L").resize((W, H), Image.LANCZOS)

w = np.asarray(water, dtype=np.float32) / 255.0
# 海が白か黒かを画素の多数決で判定（海は地表の約7割）
land = (w < 0.5) if (w > 0.5).mean() > 0.5 else (w > 0.5)
# 内陸の湖は陸として扱う（外洋と主な内海から塗り広げ、届かない水域を陸に戻す）
from PIL import ImageDraw
wm = Image.fromarray(np.where(land, 0, 255).astype(np.uint8), "L").copy()
seeds = [(-179, 0), (-30, 0), (80, -20), (51, 42), (34, 43), (19, 57), (38, 20), (51, 27), (18, 35), (-85, 60), (135, 40), (120, 38), (-90, 25)]
for lng, lat in seeds:
    x = int((lng + 180) / 360 * W) % W
    y = min(H - 1, max(0, int((90 - lat) / 180 * H)))
    if wm.getpixel((x, y)) == 255:
        ImageDraw.floodfill(wm, (x, y), 128)
sea = np.asarray(wm) == 128
land = (~sea).astype(np.float32)
land_s = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32) / 255.0

elev = np.asarray(topo, dtype=np.float32) / 255.0

# 陰影起伏（北西からの光）
gy, gx = np.gradient(elev)
shade = np.clip(0.5 + (-gx - gy) * 9.0, 0.0, 1.0)

# 海岸線：海陸区分の境界を細線と淡い光彩に分ける
def blur(a, r):
    return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255.0

b = blur(land, 0.9)
edge = np.clip(4.0 * b * (1.0 - b), 0.0, 1.0) ** 2.2
glow = np.clip(blur(edge, 4.0) * 2.0, 0.0, 1.0)

# 海：沖は深い紺、岸に近いほど明るい青緑（浅瀬）にする
ocean_deep = np.array([8, 44, 84], dtype=np.float32)
ocean_mid = np.array([12, 74, 118], dtype=np.float32)
ocean_shallow = np.array([30, 136, 160], dtype=np.float32)
near = np.clip(blur(land, 22.0) * 2.4, 0.0, 1.0)[..., None]
coast = np.clip(blur(land, 5.0) * 2.0, 0.0, 1.0)[..., None]
ocean = ocean_deep + (ocean_mid - ocean_deep) * near
ocean = ocean + (ocean_shallow - ocean) * (coast ** 1.6) * 0.75
# 緯度方向にごく弱い明暗をつけて、面が平板にならないようにする
lat = np.linspace(-1.0, 1.0, H, dtype=np.float32)[:, None, None]
ocean = ocean * (1.06 - 0.16 * np.abs(lat))
land_lo = np.array([12, 24, 30], dtype=np.float32)
land_hi = np.array([58, 86, 88], dtype=np.float32)
line = np.array([127, 231, 224], dtype=np.float32)

e = np.clip(elev * 1.6, 0, 1)[..., None]
land_rgb = land_lo + (land_hi - land_lo) * e
land_rgb = land_rgb * (0.72 + 0.56 * shade[..., None])

rgb = ocean + (land_rgb - ocean) * land_s[..., None]
rgb = rgb + line * (glow[..., None] * 0.20)
rgb = rgb + (line - rgb) * (edge[..., None] * 0.9)
rgb = np.clip(rgb, 0, 255).astype(np.uint8)

Image.fromarray(rgb, "RGB").save(out, quality=88, optimize=True, progressive=True)
print("land ratio", round(float(land.mean()), 3), "saved", out)
