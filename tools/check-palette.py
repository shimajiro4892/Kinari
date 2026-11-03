#!/usr/bin/env python3
"""テーマファイルの配色を検証する。

各色の背景に対するコントラスト比（WCAG 2 の式）と明るさ（CIE L*）、
見分けたい色同士の色差（ΔE76）を、通常の色覚と 1 型・2 型色覚の模擬
（Machado et al. 2009, 重度 1.0）で表示する。

使い方: python3 tools/check-palette.py [theme/Kinari]
"""
import math
import re
import sys


def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def luminance(h):
    r, g, b = map(lin, rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    lo, hi = sorted([luminance(a), luminance(b)])
    return (hi + 0.05) / (lo + 0.05)


def lab(h):
    r, g, b = map(lin, rgb(h))
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    return (116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z)))


SIM = {
    "1型": [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    "2型": [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
}


def simulate(h, m):
    v = list(map(lin, rgb(h)))
    o = [sum(m[i][j] * v[j] for j in range(3)) for i in range(3)]
    enc = lambda c: 255 * (12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055)
    return "#" + "".join("%02x" % round(min(255, max(0, enc(c)))) for c in o)


def delta_e(a, b):
    return math.dist(lab(a), lab(b))


NAMES = {0: "本文", 1: "赤", 2: "緑", 3: "黄土", 4: "青", 5: "紫", 6: "青緑", 7: "発言の背景",
         8: "薄い文字", 9: "朱", 10: "明るい緑", 11: "明るい黄土", 12: "明るい青", 13: "明るい紫",
         14: "明るい青緑", 15: "出力の背景"}
BACKGROUND_SLOTS = {7, 15}  # Claude Code の ANSI モードでは背景として使われる
PAIRS = [(1, 2), (9, 2), (1, 10), (1, 9), (4, 5), (4, 6), (2, 6), (3, 9), (3, 2), (1, 5)]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "theme/Kinari"
    conf, palette = {}, {}
    for line in open(path, encoding="utf-8"):
        m = re.match(r"^\s*palette\s*=\s*(\d+)\s*=\s*(#[0-9a-fA-F]{6})", line)
        if m:
            palette[int(m[1])] = m[2]
            continue
        m = re.match(r"^\s*([a-z-]+)\s*=\s*(#[0-9a-fA-F]{6})", line)
        if m:
            conf[m[1]] = m[2]
    bg, fg = conf["background"], conf["foreground"]

    print(f"背景 {bg}（L*={lab(bg)[0]:.1f}） / 本文 {fg}（L*={lab(fg)[0]:.1f}）: {contrast(fg, bg):.2f}:1\n")
    print("文字として使う色（対背景コントラスト比 / L*）")
    for i in sorted(palette):
        if i in BACKGROUND_SLOTS:
            continue
        c = palette[i]
        mark = "" if contrast(c, bg) >= 4.4 else "  ← 低い"
        print(f"  {i:2d} {NAMES[i]:6s} {c}  {contrast(c, bg):5.2f}:1  L*={lab(c)[0]:4.1f}{mark}")
    print("\n背景として使う色（本文とのコントラスト比）")
    for i in sorted(BACKGROUND_SLOTS & palette.keys()):
        print(f"  {i:2d} {NAMES[i]:6s} {palette[i]}  {contrast(fg, palette[i]):5.2f}:1")
    if "selection-background" in conf:
        s = conf["selection-background"]
        print(f"     選択範囲 {s}  {contrast(fg, s):5.2f}:1")
    print("\n見分けたい色同士の差（ΔE: 通常 / 1型 / 2型、明るさの差 ΔL*）")
    for a, b in PAIRS:
        if a not in palette or b not in palette:
            continue
        A, B = palette[a], palette[b]
        sims = " / ".join(f"{delta_e(simulate(A, m), simulate(B, m)):5.1f}" for m in SIM.values())
        print(f"  {NAMES[a]:5s}-{NAMES[b]:6s} {delta_e(A, B):5.1f} / {sims}   ΔL*={abs(lab(A)[0] - lab(B)[0]):4.1f}")


if __name__ == "__main__":
    main()
