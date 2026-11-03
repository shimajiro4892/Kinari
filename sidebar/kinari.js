// kinari — 時計・カレンダーと「作業場所ごと」のセッション一覧を並べたサイドバー。
// ターミナルテーマ Kinari と同じ考え方で配色している。
//   - 明るい背景に暗い文字。文字はすべて背景に対して 4.5:1 以上
//   - 状態は色だけで区別しない。形（● ○ !）と言葉（作業中・入力待ち）も変える
//   - 目立つ朱色は「入力待ち」だけに使う
//
// 使い方: cmux sidebar select kinari
// 見た目を確認したいときは DEMO を true にすると架空のデータで表示する。

const DEMO = false;

const BG = "#eceae3";       // サイドバーの地。端末の背景より一段だけ暗くして境界を作る
const CARD = "#f9f8f4";     // 選択中のワークスペースのカード
const EDGE = "#d5d1c6";     // 罫線（文字には使わない）
const SEL_EDGE = "#85817a"; // 選択中カードの枠
const INK = "#2f2e2b";      // 本文
const DIM = "#696660";      // 補足の文字
const SUN = "#bc3b28";      // 日曜・祝日
const SAT = "#22508f";      // 土曜
const WORK = "#22508f";     // 作業中
const ATTN = "#b84711";     // 入力待ち
const CLEAR = "#00000000";

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

// 祝日。BEGIN〜END の間は ~/.config/cmux/scripts/update-holidays.py が
// 内閣府の CSV から毎月自動で書き換える（手で編集しない）
// HOLIDAYS:BEGIN
const HOLIDAYS = {
  "2025-01-01": "元日", "2025-01-13": "成人の日", "2025-02-11": "建国記念の日",
  "2025-02-23": "天皇誕生日", "2025-02-24": "休日", "2025-03-20": "春分の日",
  "2025-04-29": "昭和の日", "2025-05-03": "憲法記念日", "2025-05-04": "みどりの日",
  "2025-05-05": "こどもの日", "2025-05-06": "休日", "2025-07-21": "海の日",
  "2025-08-11": "山の日", "2025-09-15": "敬老の日", "2025-09-23": "秋分の日",
  "2025-10-13": "スポーツの日", "2025-11-03": "文化の日", "2025-11-23": "勤労感謝の日",
  "2025-11-24": "休日", "2026-01-01": "元日", "2026-01-12": "成人の日",
  "2026-02-11": "建国記念の日", "2026-02-23": "天皇誕生日", "2026-03-20": "春分の日",
  "2026-04-29": "昭和の日", "2026-05-03": "憲法記念日", "2026-05-04": "みどりの日",
  "2026-05-05": "こどもの日", "2026-05-06": "休日", "2026-07-20": "海の日",
  "2026-08-11": "山の日", "2026-09-21": "敬老の日", "2026-09-22": "休日",
  "2026-09-23": "秋分の日", "2026-10-12": "スポーツの日", "2026-11-03": "文化の日",
  "2026-11-23": "勤労感謝の日", "2027-01-01": "元日", "2027-01-11": "成人の日",
  "2027-02-11": "建国記念の日", "2027-02-23": "天皇誕生日", "2027-03-21": "春分の日",
  "2027-03-22": "休日", "2027-04-29": "昭和の日", "2027-05-03": "憲法記念日",
  "2027-05-04": "みどりの日", "2027-05-05": "こどもの日", "2027-07-19": "海の日",
  "2027-08-11": "山の日", "2027-09-20": "敬老の日", "2027-09-23": "秋分の日",
  "2027-10-11": "スポーツの日", "2027-11-03": "文化の日", "2027-11-23": "勤労感謝の日",
};
// HOLIDAYS:END

const epoch = () => data.clock()?.epoch ?? 0;
const now = () => new Date(epoch() * 1000);
const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => y + "-" + pad(m + 1) + "-" + pad(d);

// 日付が変わったときだけ再計算する（時計は毎秒進む）。
// 毎回新しいオブジェクトを返すと依存先が毎秒作り直されるので、日付が同じなら同じものを返す
let todayCache = null;
const today = computed(() => {
  const d = now();
  const key = d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
  if (!todayCache || todayCache.key !== key) {
    todayCache = { key, y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), wd: d.getDay() };
  }
  return todayCache;
});

// ---------- 時計 ----------
function clock() {
  const t = today;
  const holiday = () => HOLIDAYS[ymd(t().y, t().m, t().d)] ?? "";
  return HStack({ spacing: 10, alignment: "bottom" }, [
    Text(() => { const d = now(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); })
      .font(30).weight("light").monospaced().color(INK).lineLimit(1).layoutPriority(2),
    VStack({ spacing: 1, alignment: "leading" }, [
      Text(() => (t().m + 1) + "月" + t().d + "日（" + WEEK[t().wd] + "）")
        .font(13).weight("semibold").color(INK).lineLimit(1),
      Text(() => holiday() || String(t().y) + "年")
        .font(11).color(() => (holiday() ? SUN : DIM)).lineLimit(1),
    ]).paddingBottom(4),
    Spacer({ minLength: 0 }),
  ]);
}

// ---------- カレンダー ----------
const weeks = computed(() => {
  const t = today();
  const first = new Date(t.y, t.m, 1).getDay();
  const days = new Date(t.y, t.m + 1, 0).getDate();
  const rows = Math.ceil((first + days) / 7);
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => {
      const n = r * 7 + c - first + 1;
      return n >= 1 && n <= days ? n : 0;
    }));
});

function dayColor(n, col) {
  const t = today();
  if (HOLIDAYS[ymd(t.y, t.m, n)] || col === 0) return SUN;
  if (col === 6) return SAT;
  return n < t.d ? DIM : INK;   // 過ぎた日は一段弱く
}

function dayCell(r, c) {
  const n = () => weeks()[r]?.[c] ?? 0;
  const isToday = () => n() > 0 && n() === today().d;
  return ZStack({}, [
    Rectangle({ height: 24 }).fill(CLEAR).frame({ maxWidth: "infinity" }),
    // 今日は色ではなく明るさで示す（暗い丸に白抜き）
    Circle({ size: 22 }).fill(() => (isToday() ? INK : CLEAR)),
    Text(() => (n() ? String(n()) : "")).font(12).monospaced()
      .weight(() => (isToday() ? "bold" : "regular"))
      .color(() => (isToday() ? "#ffffff" : dayColor(n(), c))),
  ]).frame({ maxWidth: "infinity" });
}

function calendar() {
  // 行数は月によって 4〜6。最大の 6 行ぶんを用意して、使わない行は空にする
  return VStack({ spacing: 2 }, [
    HStack({ spacing: 0 }, [
      Text(() => today().y + "年 " + (today().m + 1) + "月").font(12).weight("semibold").color(INK),
      Spacer(),
    ]).paddingBottom(2),
    HStack({ spacing: 0 }, WEEK.map((w, i) =>
      Text(w).font(11).weight("semibold").color(i === 0 ? SUN : i === 6 ? SAT : DIM)
        .frame({ maxWidth: "infinity" }))),
    ...Array.from({ length: 6 }, (_, r) =>
      HStack({ spacing: 0 }, Array.from({ length: 7 }, (_, c) => dayCell(r, c)))
        .frame(() => ({ height: r < weeks().length ? 24 : 0 }))
        .opacity(() => (r < weeks().length ? 1 : 0))),
  ]);
}

// ---------- 作業場所とセッション ----------
const STATE = {
  needs_input: { mark: "!", label: "入力待ち", color: ATTN, rank: 0 },
  working: { mark: "●", label: "作業中", color: WORK, rank: 1 },
  idle: { mark: "○", label: "", color: DIM, rank: 2 },
  none: { mark: "○", label: "", color: DIM, rank: 3 },
};

function sample() {
  const at = epoch();
  const tab = (id, title, state, ago, extra) => ({ id, title, latestAt: at - ago * 60, _s: state, ...extra });
  const ws = (id, title, selected, dir, branch, dirty, tabs) => ({
    id, title, selected, unread: 0,
    tabs: tabs.map((t) => ({ ...t, directory: dir, branch, dirty })),
    agents: tabs.filter((t) => t._s !== "none").map((t) => ({ panelId: t.id, status: t._s })),
  });
  return [
    ws("a", "検査アプリ", true, "~/src/inspection-app", "feature/report-export", true, [
      tab("a1", "帳票の PDF 出力", "working", 0, { focused: true }),
      tab("a2", "単体テストの修正", "needs_input", 4),
      tab("a3", "zsh", "none", 30),
    ]),
    ws("b", "社内ドキュメント", false, "~/docs/handbook", "main", false, [
      tab("b1", "オンボーディング資料の見直し", "idle", 52),
    ]),
    ws("c", "terminal", false, "~", "", false, [tab("c1", "zsh", "none", 180)]),
  ];
}

const workspaces = computed(() => (DEMO ? sample() : (data.workspaces() ?? [])));
const groups = computed(() => (DEMO ? [] : (data.groups() ?? [])));

// stateOf・cleanTitle・focusTab は Pencil Paper for cmux の desk.js から流用・改変した。
//   https://github.com/simonzhang316/cmux-pencil-desk
//   Copyright (c) 2026 simonzhang316 / MIT License（全文はリポジトリの LICENSE を参照）
function stateOf(w, t) {
  const a = (w?.agents ?? []).find((x) => x.panelId === t?.id);
  return STATE[a?.status] ?? STATE.none;
}

// エージェントがタブ名の先頭に付ける記号（✳ ◐ など）を外す（Pencil Paper から流用）
const cleanTitle = (s) => String(s ?? "").replace(/^[^\p{L}\p{N}~(]+/u, "") || "（無題）";
const dirTail = (p) => {
  const s = String(p ?? "").replace(/\/+$/, "");
  if (!s) return "";
  const home = s.replace(/^\/Users\/[^/]+/, "~");
  const parts = home.split("/");
  return parts.length > 2 ? "…/" + parts.slice(-2).join("/") : home;
};
function ago(at) {
  if (!at) return "";
  const s = Math.max(0, epoch() - at);
  if (s < 60) return "今";
  if (s < 3600) return Math.floor(s / 60) + "分前";
  const d = new Date(at * 1000), t = today();
  if (d.getFullYear() === t.y && d.getMonth() === t.m && d.getDate() === t.d) return pad(d.getHours()) + ":" + pad(d.getMinutes());
  return (d.getMonth() + 1) + "/" + d.getDate();
}

function summary(w) {
  const states = (w.tabs ?? []).map((t) => stateOf(w, t));
  const waiting = states.filter((s) => s === STATE.needs_input).length;
  const working = states.filter((s) => s === STATE.working).length;
  return { waiting, working };
}

// クリックした瞬間に選択表示を切り替える。cmux から届くデータは 1 秒に 1 回ほどしか
// 更新されないので、それを待つと遅れて見える。データが追いついたら（または 3 秒で）上書きをやめる
const [selOverride, setSelOverride] = signal(null);
const isSel = (w) => {
  const o = selOverride();
  if (o && epoch() - o.at < 3) return !!w && w.id === o.id;
  return !!w?.selected;
};
computed(() => {
  const o = selOverride();
  if (!o) return;
  const cur = (data.workspaces() ?? []).find((x) => x.selected)?.id;
  if (cur === o.id) setSelOverride(null);
});

function selectWorkspace(w) {
  if (DEMO || !w) return;
  setSelOverride({ id: w.id, at: epoch() });
  cmux("workspace.select", { workspace_id: w.id });
}
// セッションへの移動（Pencil Paper の jump() から流用・改変）
function focusTab(w, t) {
  if (DEMO || !w) return;
  setSelOverride({ id: w.id, at: epoch() });
  cmux("workspace.select", { workspace_id: w.id });
  if (t.surfaceId) cmux("surface.focus", { surface_id: t.surfaceId, workspace_id: w.id });
}

// 名前の変更。カードのダブルクリックか、右クリックの「名前を変更」で入力欄に切り替える。
// Return で確定、Esc で取り消し。空のまま確定すると、cmux が自動で付ける名前に戻す
const [editing, setEditing] = signal(null);   // 入力欄にしているワークスペースの id
// 確定した名前は、cmux のデータが追いつくまで（最長 3 秒）こちらで表示しておく
const [renamed, setRenamed] = signal(null);
const titleOf = (w) => {
  const r = renamed();
  if (r && w && r.id === w.id && epoch() - r.at < 3) return r.title;
  return w?.title ?? "";
};

function renameWorkspace(w, text) {
  setEditing(null);
  if (DEMO || !w) return;
  const title = String(text ?? "").trim();
  if (!title) { resetName(w); return; }
  if (title === w.title) return;
  setRenamed({ id: w.id, title, at: epoch() });
  cmux("workspace.action", { action: "rename", workspace_id: w.id, title });
}
function resetName(w) {
  if (DEMO || !w) return;
  setRenamed(null);
  cmux("workspace.action", { action: "clear_name", workspace_id: w.id });
}

const MAX_TABS = 5;   // これより多いセッションは「ほか n 件」にまとめる

function sessionRow(w, t) {
  const st = () => stateOf(w(), t());
  return HStack({ spacing: 7 }, [
    Text(() => st().mark).font(10).weight("bold").monospaced().color(() => st().color)
      .frame({ width: 10 }),
    Text(() => cleanTitle(t()?.title)).font(12)
      .weight(() => (st() === STATE.needs_input ? "semibold" : "regular"))
      .color(INK).lineLimit(1).truncation("tail")
      .frame({ maxWidth: "infinity", alignment: "leading" }),
    Text(() => st().label || ago(t()?.latestAt)).font(11)
      .weight(() => (st().label ? "semibold" : "regular"))
      .color(() => (st().label ? st().color : DIM)).lineLimit(1).layoutPriority(2),
  ])
    .paddingHorizontal(6).paddingVertical(3)
    .cornerRadius(5)
    .background(() => (t()?.focused && isSel(w()) ? "#2f2e2b12" : null))
    .hoverBackground("#2f2e2b0f")
    .cursor("pointer")
    .onTap(() => focusTab(w(), t()));
}

function badge(w) {
  // 入力待ちは朱の帯に白文字（いちばん目立たせる）。作業中は青の文字だけ
  const s = () => summary(w() ?? {});
  return ZStack({}, [
    Text(() => (s().waiting ? "入力待ち " + s().waiting : "")).font(11).weight("bold").color("#ffffff")
      .paddingHorizontal(() => (s().waiting ? 6 : 0)).paddingVertical(() => (s().waiting ? 1 : 0))
      .background(() => (s().waiting ? ATTN : null)).cornerRadius(4),
    Text(() => (!s().waiting && s().working ? "● 作業中" : "")).font(11).weight("semibold").color(WORK),
  ]).layoutPriority(2);
}

function workspaceCard(w, indent, isEditing) {
  const sel = () => isSel(w());
  const tabs = () => (w()?.tabs ?? []).slice()
    .sort((a, b) => stateOf(w(), a).rank - stateOf(w(), b).rank || (b.latestAt ?? 0) - (a.latestAt ?? 0));
  const shown = () => tabs().slice(0, MAX_TABS);
  const more = () => Math.max(0, tabs().length - MAX_TABS);
  const place = () => {
    const t = (w()?.tabs ?? []).find((x) => x.focused) ?? (w()?.tabs ?? [])[0];
    if (!t) return "";
    const dir = dirTail(t.directory);
    return dir + (t.branch ? "  ⎇ " + t.branch + (t.dirty ? " ●" : "") : "");
  };
  return VStack({ spacing: 0 }, [
    VStack({ spacing: 4 }, [
      // 名前とフォルダの行。名前の変更（ダブルクリック）はここだけで受け付ける
      VStack({ spacing: 4 }, [
        HStack({ spacing: 6 }, [
          isEditing
            ? TextField(() => w()?.title ?? "", {
                placeholder: "ワークスペースの名前",
                onSubmit: (t) => renameWorkspace(w(), t),
                onCancel: () => setEditing(null),
              }).font(14).weight("semibold").frame({ maxWidth: "infinity" })
            : Text(() => titleOf(w())).font(14).weight("semibold").color(INK)
                .lineLimit(1).truncation("tail").frame({ maxWidth: "infinity", alignment: "leading" }),
          badge(w),
        ]),
        Text(place).font(11).monospaced().color(DIM).lineLimit(1).truncation("middle")
          .frame({ maxWidth: "infinity", alignment: "leading" }),
      ])
        .frame({ maxWidth: "infinity" })
        .onTap(() => selectWorkspace(w()))
        .onDoubleTap(() => setEditing(w()?.id ?? null)),
      VStack({ spacing: 1 }, [
        ForEach({ items: shown, key: (t) => t.id }, (t) => sessionRow(w, t)),
        Text(() => (more() ? "ほか " + more() + " 件" : "")).font(11).color(DIM).paddingLeading(23),
      ]),
    ])
      .paddingHorizontal(8).paddingVertical(8)
      .frame({ maxWidth: "infinity" }),
  ])
    .marginLeading(indent ? 12 : 0)
    // 選択中は明るいカードに濃い枠（色ではなく明るさの差で示す。枠は背景に対して 3:1 以上）
    .background(() => (sel() ? CARD : null))
    .borderColor(() => (sel() ? SEL_EDGE : CLEAR)).borderWidth(1.5)
    .cornerRadius(8)
    .hoverBackground(() => (sel() ? CARD : "#ffffff59"))
    .frame({ maxWidth: "infinity" })
    // カードのどこを押しても切り替わる（セッションの行は自分の onTap が優先される）
    .cursor("pointer")
    .onTap(() => selectWorkspace(w()))
    .contextMenu([
      Button("名前を変更", () => setEditing(w()?.id ?? null)),
      Button("自動の名前に戻す", () => resetName(w())),
    ]);
}

// グループがあればグループ見出しの下にまとめ、なければワークスペースを順に並べる
// 名前を変えている間はキーを変えて、そのカードだけを入力欄つきで作り直す
const entries = computed(() => {
  const ws = workspaces();
  const gs = new Map(groups().map((g) => [g.id, g]));
  const ed = editing();
  const card = (w, indent) => ({
    key: "w:" + w.id + (ed === w.id ? ":edit" : ""), kind: "ws", id: w.id, indent, editing: ed === w.id,
  });
  const out = [];
  const seen = new Set();
  for (const w of ws) {
    const g = w.group && gs.get(w.group);
    if (!g) { out.push(card(w, false)); continue; }
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    out.push({ key: "g:" + g.id, kind: "group", id: g.id });
    if (!g.collapsed) {
      for (const m of ws.filter((x) => x.group === g.id)) out.push(card(m, true));
    }
  }
  return out;
});

function groupHeader(id) {
  const g = () => groups().find((x) => x.id === id) ?? { name: "", collapsed: false };
  const count = () => workspaces().filter((w) => w.group === id).length;
  return HStack({ spacing: 6 }, [
    Text(() => (g().collapsed ? "▸" : "▾")).font(11).color(DIM),
    Text(() => g().name).font(12).weight("semibold").color(DIM).lineLimit(1).truncation("tail"),
    Spacer(),
    Text(() => String(count())).font(11).monospaced().color(DIM),
  ])
    .paddingHorizontal(6).paddingTop(4)
    .cursor("pointer")
    .onTap(() => cmux(g().collapsed ? "workspace.group.expand" : "workspace.group.collapse", { group_id: id }));
}

function places() {
  return VStack({ spacing: 6 }, [
    HStack({ spacing: 0 }, [
      Text("ワークスペース").font(12).weight("semibold").color(DIM),
      Spacer(),
      Text(() => String(workspaces().length)).font(11).monospaced().color(DIM),
    ]).paddingHorizontal(6),
    ForEach({ items: entries, key: (e) => e.key }, (e) => {
      const entry = e();
      if (entry.kind === "group") return groupHeader(entry.id);
      const w = () => workspaces().find((x) => x.id === entry.id);
      return workspaceCard(w, entry.indent, entry.editing);
    }),
  ]);
}

sidebar(() =>
  VStack({ spacing: 12 }, [
    clock(),
    calendar(),
    Rectangle({ height: 1 }).fill(EDGE).frame({ maxWidth: "infinity" }),
    places(),
    Spacer(),
    // 左下に cmux のボタンが重なるので、その分の余白
    Rectangle({ height: 36 }).fill(CLEAR),
  ])
    .padding(12)
    .frame({ maxWidth: "infinity", maxHeight: "infinity" })
    .background(BG)
);
