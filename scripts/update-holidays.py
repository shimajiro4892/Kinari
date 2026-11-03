#!/usr/bin/python3
"""kinari サイドバーの祝日表を、内閣府「国民の祝日」CSV から更新する。

- 取得元: https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv（Shift_JIS）
- kinari.js の `// HOLIDAYS:BEGIN` 〜 `// HOLIDAYS:END` の間だけを書き換える
- 去年以降の分だけを入れる。中身が変わらなければ何もしない
- 書き換え後に `cmux sidebar validate` が通らなければ元に戻す。通れば再読み込みする
- launchd（~/Library/LaunchAgents/io.github.shimajiro4892.kinari-holidays.plist）から毎月実行される
"""
import datetime
import os
import re
import shutil
import subprocess
import sys
import urllib.request

URL = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv"
SIDEBAR = os.path.expanduser("~/.config/cmux/sidebars/kinari.js")
CMUX = "/Applications/cmux.app/Contents/Resources/bin/cmux"


def log(msg):
    print(datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), msg, flush=True)


def fetch():
    req = urllib.request.Request(URL, headers={"User-Agent": "kinari-holidays/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("cp932")


def parse(text, since_year):
    out = {}
    for line in text.splitlines()[1:]:
        m = re.match(r"^(\d{4})/(\d{1,2})/(\d{1,2}),(.+)$", line.strip())
        if not m:
            continue
        y, mo, d, name = int(m[1]), int(m[2]), int(m[3]), m[4].strip()
        if y >= since_year:
            out[f"{y:04d}-{mo:02d}-{d:02d}"] = name
    return out


def render(holidays):
    items = [f'"{k}": "{v}"' for k, v in sorted(holidays.items())]
    lines = []
    for i in range(0, len(items), 3):
        lines.append("  " + ", ".join(items[i:i + 3]) + ",")
    return "const HOLIDAYS = {\n" + "\n".join(lines) + "\n};\n"


def main():
    src = open(SIDEBAR, encoding="utf-8").read()
    m = re.search(r"(// HOLIDAYS:BEGIN\n)(.*?)(// HOLIDAYS:END)", src, re.S)
    if not m:
        log("目印 HOLIDAYS:BEGIN/END が見つからないので中止")
        return 1

    holidays = parse(fetch(), datetime.date.today().year - 1)
    if len(holidays) < 10:
        log(f"取得した祝日が {len(holidays)} 件しかないので中止（取得元の形式が変わった可能性）")
        return 1

    block = render(holidays)
    if m[2] == block:
        log(f"変更なし（{min(holidays)}〜{max(holidays)}, {len(holidays)} 件）")
        return 0

    backup = SIDEBAR + ".bak"
    shutil.copy2(SIDEBAR, backup)
    with open(SIDEBAR, "w", encoding="utf-8") as f:
        f.write(src[:m.start(2)] + block + src[m.end(2):])

    v = subprocess.run([CMUX, "sidebar", "validate", "kinari"], capture_output=True, text=True)
    if v.returncode != 0:
        shutil.copy2(backup, SIDEBAR)
        log("検証に失敗したので元に戻した: " + (v.stdout + v.stderr).strip())
        return 1

    r = subprocess.run([CMUX, "sidebar", "reload", "kinari"], capture_output=True, text=True)
    log(f"更新した（{min(holidays)}〜{max(holidays)}, {len(holidays)} 件）"
        + ("" if r.returncode == 0 else " ※再読み込みは失敗（cmux 未起動の可能性。次回起動時に反映）"))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # ネットワーク不通など。ファイルは書き換えていない
        log(f"失敗: {e!r}")
        sys.exit(1)
