"use client";
/* oxlint-disable next/no-img-element, react/react-compiler -- Native transparent sprite images and a mutable external simulation are intentional. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RollerCoaster,
  FerrisWheel,
  Trees,
  Route,
  UtensilsCrossed,
  MousePointer2,
  Eraser,
  Wallet,
  Users,
  Smile,
  Sun,
  Save,
  FolderOpen,
  HelpCircle,
  Plus,
  Minus,
  Maximize,
  Play,
  Pause,
  X,
  Trophy,
  Sparkles,
  Check,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Undo2,
  FlaskConical,
  Settings2,
  Flag,
  Info,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  newPark,
  tick,
  CATALOG,
  access,
  queueCapacity,
  occupant,
  trackStats,
  isRide,
  decorative,
  validSave,
  type Park,
  type Kind,
  type Point,
  type Building,
} from "@/game/simulation";
import { draw, loadSprites, projection, type View } from "@/game/render";
import {
  blueprint,
  planPlacement,
  place,
  planConnection,
  connectBuilding,
  recordEdit,
  undoEdits,
  type BuildTool,
  type EditRecord,
} from "@/game/construction";
const EUR = (n: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
const categories = [
  { id: "select", label: "Auswahl", Icon: MousePointer2 },
  { id: "rides", label: "Attraktionen", Icon: FerrisWheel },
  { id: "coaster", label: "Achterbahn", Icon: RollerCoaster },
  { id: "paths", label: "Wege", Icon: Route },
  { id: "shops", label: "Versorgung", Icon: UtensilsCrossed },
  { id: "nature", label: "Natur", Icon: Trees },
  { id: "erase", label: "Abreißen", Icon: Eraser },
];
const blankView: View = {
  zoom: 1,
  panX: 0,
  panY: 40,
  grid: false,
  hover: null,
  tool: "select",
  selected: null,
  draft: [],
  height: 0,
};
export default function Home() {
  const park = useRef<Park | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ ...blankView });
  const drag = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
    moved: boolean;
    pan: boolean;
    tile: Point;
  } | null>(null);
  const [snapshot, setSnapshot] = useState<Park | null>(null);
  const [category, setCategory] = useState("");
  const [tool, setTool] = useState("select");
  const [selected, setSelected] = useState<number | null>(null);
  const [help, setHelp] = useState(false);
  const [settings, setSettings] = useState(false);
  const [newDialog, setNewDialog] = useState(false);
  const [message, setMessage] = useState(
    "Willkommen im Waldhain. Dein erster Park wartet auf neue Ideen.",
  );
  const [draft, setDraft] = useState<Point[]>([]);
  const [blueprintMode, setBlueprintMode] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [autoClear, setAutoClear] = useState(true);
  const [hoverTile, setHoverTile] = useState<Point | null>(null);
  const history = useRef<EditRecord[][]>([]);
  const stroke = useRef<EditRecord[] | null>(null);
  const [undoCount, setUndoCount] = useState(0);
  const [height, setHeight] = useState(0);
  const [assets, setAssets] = useState(false);
  const [assetError, setAssetError] = useState(false);
  const [saved, setSaved] = useState("");
  const [zoom, setZoom] = useState(100);
  const [tab, setTab] = useState("park");
  const announced = useRef(false);
  const notify = useCallback((m: string) => setMessage(m), []);
  const sync = useCallback(() => {
    if (park.current)
      setSnapshot({
        ...park.current,
        buildings: [...park.current.buildings],
        guests: [...park.current.guests],
      });
  }, []);
  const finishStroke = useCallback(() => {
    if (stroke.current?.length) history.current.push(stroke.current);
    stroke.current = null;
    history.current = history.current.slice(-30);
    setUndoCount(history.current.length);
  }, []);
  const edit = (label: string, fn: () => void) => {
    if (!park.current) return;
    const record = recordEdit(park.current, label, fn);
    if (record) {
      if (stroke.current) stroke.current.push(record);
      else {
        history.current.push([record]);
        history.current = history.current.slice(-30);
      }
      setUndoCount(history.current.length);
    }
    sync();
  };
  const undo = useCallback(() => {
    if (draft.length && !blueprintMode) {
      setDraft(draft.slice(0, -1));
      return;
    }
    finishStroke();
    const records = history.current.pop();
    if (!records || !park.current) return;
    undoEdits(park.current, records);
    setUndoCount(history.current.length);
    setSelected(null);
    setCategory((c) => (c === "detail" ? "" : c));
    notify(`${records[0].label} rückgängig gemacht.`);
    sync();
  }, [draft, blueprintMode, finishStroke, notify, sync]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5500);
    return () => clearTimeout(timer);
  }, [message]);
  const previewTrack = useMemo(
    () =>
      tool === "coaster" && blueprintMode && hoverTile ? blueprint(hoverTile, rotation) : draft,
    [tool, blueprintMode, hoverTile, rotation, draft],
  );
  const placement = useMemo(
    () =>
      snapshot && tool !== "select" && hoverTile && (tool !== "coaster" || blueprintMode)
        ? planPlacement(
            snapshot,
            tool as BuildTool,
            hoverTile,
            tool === "coaster" ? previewTrack : undefined,
            autoClear,
          )
        : null,
    [snapshot, tool, hoverTile, blueprintMode, previewTrack, autoClear],
  );
  const save = useCallback(() => {
    if (!park.current) return;
    try {
      localStorage.setItem("coaster-grove-v1", JSON.stringify(park.current));
      setSaved("Gespeichert");
      notify("Dein Park wurde in diesem Browser gespeichert.");
    } catch {
      notify("Speichern fehlgeschlagen. Der Browserspeicher ist nicht verfügbar.");
    }
  }, [notify]);
  useEffect(() => {
    let initial = newPark();
    try {
      const raw = localStorage.getItem("coaster-grove-v1");
      if (raw) {
        const data = JSON.parse(raw);
        if (validSave(data)) {
          initial = data;
          setMessage("Willkommen zurück. Dein gespeicherter Park ist bereit.");
        }
      }
    } catch {}
    park.current = initial;
    setSnapshot({ ...initial });
    let disposed = false;
    loadSprites(`${import.meta.env.BASE_URL}assets/pixel-v2`)
      .then(() => {
        if (!disposed) setAssets(true);
      })
      .catch(() => {
        if (!disposed) setAssetError(true);
      });
    const interval = setInterval(() => {
      sync();
      if (park.current?.won && !announced.current) {
        announced.current = true;
        notify("Ziel erreicht! Dein Waldhain ist ein Publikumsliebling. Du kannst weiterbauen.");
      }
    }, 400);
    const auto = setInterval(() => {
      try {
        if (park.current) {
          localStorage.setItem("coaster-grove-v1", JSON.stringify(park.current));
          setSaved("Automatisch gespeichert");
        }
      } catch {}
    }, 20000);
    return () => {
      disposed = true;
      clearInterval(interval);
      clearInterval(auto);
    };
  }, [sync, notify]);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let frame = 0,
      last = performance.now();
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const resize = () => {
      const rect = el.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio, 2);
      el.width = rect.width * dpr;
      el.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const obs = new ResizeObserver(resize);
    obs.observe(el);
    resize();
    const loop = (time: number) => {
      const dt = Math.min(0.08, (time - last) / 1000);
      last = time;
      if (park.current) {
        if (!document.hidden && assets) tick(park.current, dt);
        draw(ctx, el.clientWidth, el.clientHeight, park.current, view.current, time);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      obs.disconnect();
    };
  }, [assets]);
  useEffect(() => {
    view.current.tool = tool;
    view.current.selected = selected;
    view.current.draft = previewTrack;
    view.current.preview = placement;
    view.current.height = height;
    view.current.grid = tool !== "select";
  }, [tool, selected, previewTrack, placement, height]);
  const pickTool = useCallback(
    (t: string, cat?: string) => {
      setTool(t);
      setSelected(null);
      if (cat) setCategory(cat);
      if (t !== "coaster") {
        setDraft([]);
        setHeight(0);
      }
      notify(
        t === "select"
          ? "Klicke eine Attraktion an, um ihren Betrieb zu verwalten."
          : t === "erase"
            ? "Klicke auf ein Gebäude oder einen Weg. Gebäude erstatten 40 % des Grundpreises."
            : t === "coaster"
              ? "Waldflug platzieren · R dreht die Vorlage · eigene Strecke im Baufenster."
              : t === "queue"
                ? "Verbinde den Attraktionseingang über eine Warteschlange mit einem Parkweg."
                : t === "path"
                  ? "Klicke oder ziehe, um deinen Park mit Wegen zu verbinden."
                  : CATALOG[t as Kind]
                    ? `${CATALOG[t as Kind].name}: Wähle einen freien Platz im Park.`
                    : "Wähle ein Bauwerk.",
      );
    },
    [notify],
  );
  const changeZoom = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const el = canvas.current;
    if (!el) return;
    const rect = el.getBoundingClientRect(),
      old = view.current.zoom;
    const x = clientX === undefined ? rect.width / 2 : clientX - rect.left;
    const y = clientY === undefined ? rect.height / 2 : clientY - rect.top;
    const origin = projection(rect.width, rect.height, view.current).project(0, 0);
    view.current.zoom = Math.max(0.55, Math.min(2.5, old * factor));
    const ratio = view.current.zoom / old;
    const next = projection(rect.width, rect.height, view.current).project(0, 0);
    view.current.panX += x - (next.x + (x - origin.x) * ratio);
    view.current.panY += y - (next.y + (y - origin.y) * ratio);
    setZoom(Math.round(view.current.zoom * 100));
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input,textarea,[role="slider"],[role="dialog"],[contenteditable]'))
        return;
      const s = park.current;
      if (!s) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (e.code === "Space" && !target.closest("button")) {
        e.preventDefault();
        s.speed = s.speed === 0 ? 1 : 0;
        sync();
      }
      if (e.key === "Escape") {
        pickTool("select");
        setCategory("");
      }
      if (e.key.toLowerCase() === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        save();
      }
      if (e.key.toLowerCase() === "r" && tool === "coaster" && blueprintMode) {
        e.preventDefault();
        setRotation((r) => (r + 1) % 4);
      }
      if (e.key === "+" || e.key === "=") changeZoom(1.15);
      if (e.key === "-") changeZoom(1 / 1.15);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save, sync, pickTool, changeZoom, undo, tool, blueprintMode]);

  const tileAt = (e: { clientX: number; clientY: number }) => {
    const el = canvas.current!;
    const r = el.getBoundingClientRect();
    return projection(r.width, r.height, view.current).unproject(
      e.clientX - r.left,
      e.clientY - r.top,
    );
  };
  const completeBuild = (id: number, kind: Kind, repeat = false) => {
    const built = park.current!.buildings.find((b) => b.id === id)!;
    if (kind === "coaster") built.testing = 8;
    if (!decorative(kind) && !repeat) {
      setSelected(id);
      setCategory("detail");
      setTool("select");
      setDraft([]);
    }
    notify(
      decorative(kind)
        ? `${CATALOG[kind].name} gepflanzt.`
        : `${CATALOG[kind].name} gebaut. Über „Anschließen & öffnen“ kommen die Gäste.`,
    );
  };
  const act = (p: Point, repeat = false) => {
    const s = park.current;
    if (!s) return;
    if (tool === "select") {
      const b = occupant(s, p.x, p.y);
      setSelected(b?.id ?? null);
      if (b) setCategory("detail");
      return;
    }
    if (tool === "coaster" && !blueprintMode) {
      if (!draft.length) {
        if (
          p.x < 0 ||
          p.y < 0 ||
          p.x >= 30 ||
          p.y >= 30 ||
          s.tiles[p.y][p.x] !== "grass" ||
          occupant(s, p.x, p.y)
        ) {
          notify("Die Station braucht freie Wiese.");
          return;
        }
        setDraft([{ ...p, z: 0 }]);
        notify("Station gesetzt. Ergänze benachbarte Felder oder nutze die Richtungspfeile.");
      } else {
        const last = draft.at(-1)!;
        if (Math.abs(last.x - p.x) + Math.abs(last.y - p.y) !== 1) {
          notify("Wähle ein benachbartes Feld.");
          return;
        }
        extend(p.x - last.x, p.y - last.y);
      }
      return;
    }
    edit(
      tool === "erase"
        ? "Abriss"
        : ["path", "queue", "water"].includes(tool)
          ? "Wegebau"
          : (CATALOG[tool as Kind]?.name ?? "Bau"),
      () => {
        const result = place(
          s,
          tool as BuildTool,
          p,
          tool === "coaster" ? blueprint(p, rotation) : undefined,
          autoClear,
        );
        if (result.error) {
          notify(result.error);
          return;
        }
        if (result.id !== undefined) completeBuild(result.id, tool as Kind, repeat);
      },
    );
  };
  const extend = (dx: number, dy: number) => {
    if (!draft.length) return;
    const prev = draft.at(-1)!;
    const p = { x: prev.x + dx, y: prev.y + dy, z: height };
    if (Math.abs(height - (prev.z ?? 0)) > 1) {
      notify("Höchstens eine Höhenstufe pro Abschnitt.");
      return;
    }
    if (p.x < 0 || p.y < 0 || p.x >= 30 || p.y >= 30) {
      notify("Das ist außerhalb des Parks.");
      return;
    }
    setDraft([...draft, p]);
  };
  const coasterBuild = () => {
    const s = park.current;
    if (!s || !draft.length) return;
    edit("Achterbahn", () => {
      const result = place(s, "coaster", draft[0], draft, autoClear);
      if (result.error) {
        notify(result.error);
        return;
      }
      completeBuild(result.id!, "coaster");
    });
  };
  const template = () => {
    if (!draft.length) return;
    setDraft(blueprint(draft[0], rotation));
    setHeight(0);
    notify("Waldflug-Vorlage eingesetzt. Mit „Strecke bauen“ abschließen.");
  };
  const b = snapshot?.buildings.find((b) => b.id === selected);
  const connection =
    b && snapshot && !decorative(b.kind) ? planConnection(snapshot, b, autoClear) : null;
  const reachable = b && snapshot ? access(snapshot, b) : null;
  const readyRides =
    snapshot?.buildings.filter((b) => isRide(b.kind) && b.open && b.tested && access(snapshot, b))
      .length ?? 0;
  const catalog = (items: Kind[]) => (
    <div className="catalog">
      {items.map((k) => (
        <button
          key={k}
          className={`asset-card ${tool === k ? "active" : ""}`}
          onClick={() => pickTool(k)}
        >
          <img src={`${import.meta.env.BASE_URL}assets/pixel-v2/${CATALOG[k].sprite}.png`} alt="" />
          <strong>{CATALOG[k].name}</strong>
          <span>{EUR(CATALOG[k].cost)}</span>
        </button>
      ))}
    </div>
  );
  const changeBuilding = (fn: (b: Building) => void) => {
    const b = park.current?.buildings.find((b) => b.id === selected);
    if (b) {
      fn(b);
      sync();
    }
  };
  return (
    <main className="game">
      <header className="topbar">
        <div className="brand">
          <div className="brandmark">
            <RollerCoaster strokeWidth={1.3} />
          </div>
          <div>
            <h1>
              Coaster Grove<span style={{ color: "#86a16e" }}>.</span>
            </h1>
            <div className="eyebrow">Freizeitpark-Simulation</div>
          </div>
        </div>
        <div className="metrics">
          <div className="metric">
            <Wallet />
            <div>
              <strong>{EUR(snapshot?.cash ?? 16000)}</strong>
              <span>Parkbudget</span>
            </div>
          </div>
          <div className="metric">
            <Users />
            <div>
              <strong>{snapshot?.guests.length ?? 26}</strong>
              <span>Besucher im Park</span>
            </div>
          </div>
          <div className="metric">
            <Smile />
            <div>
              <strong>
                {snapshot?.rating ?? 80}
                <small style={{ fontSize: 12 }}> %</small>
              </strong>
              <span>Zufriedenheit</span>
            </div>
          </div>
          <div className="metric weather">
            <Sun style={{ color: "#cfa056" }} />
            <div>
              <strong>24°</strong>
              <span>Sonniger Parktag</span>
            </div>
          </div>
        </div>
        <div className="topactions">
          <span className="save-label">{saved}</span>
          <button
            className="iconbtn"
            aria-label="Park speichern"
            title="Speichern (⌘/Strg S)"
            onClick={save}
          >
            <Save size={17} />
          </button>
          <button className="iconbtn" aria-label="Parkverwaltung" onClick={() => setSettings(true)}>
            <Settings2 size={17} />
          </button>
          <button className="iconbtn" aria-label="Spielanleitung" onClick={() => setHelp(true)}>
            <HelpCircle size={17} />
          </button>
        </div>
      </header>
      <section className="surface" aria-label="Parkbau und Simulation">
        <canvas
          ref={canvas}
          className={`world ${tool !== "select" ? "building" : ""}`}
          aria-label="Isometrischer Freizeitpark. Wähle unten ein Bauwerk und klicke auf eine freie Fläche."
          onContextMenu={(e) => e.preventDefault()}
          onWheel={(e) => changeZoom(e.deltaY < 0 ? 1.07 : 1 / 1.07, e.clientX, e.clientY)}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              px: view.current.panX,
              py: view.current.panY,
              moved: false,
              pan: e.button === 2 || e.button === 1 || e.altKey || tool === "select",
              tile: tileAt(e),
            };
            if (e.button === 0 && !e.altKey && ["path", "queue", "water", "erase"].includes(tool)) {
              stroke.current = [];
              act(tileAt(e));
            }
          }}
          onPointerMove={(e) => {
            const p = tileAt(e);
            view.current.hover = p;
            setHoverTile((old) => (old?.x === p.x && old?.y === p.y ? old : p));
            const d = drag.current;
            if (d) {
              const dx = e.clientX - d.x,
                dy = e.clientY - d.y;
              if (Math.hypot(dx, dy) > 5) d.moved = true;
              if (d.moved && d.pan) {
                view.current.panX = d.px + dx;
                view.current.panY = d.py + dy;
              } else if (d.moved && ["path", "queue", "water", "erase"].includes(tool)) {
                const last = { ...d.tile };
                while (last.x !== p.x || last.y !== p.y) {
                  if (Math.abs(p.x - last.x) >= Math.abs(p.y - last.y))
                    last.x += Math.sign(p.x - last.x);
                  else last.y += Math.sign(p.y - last.y);
                  act(last);
                }
                d.tile = p;
              }
            }
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            drag.current = null;
            if (
              d &&
              !d.moved &&
              e.button === 0 &&
              !["path", "queue", "water", "erase"].includes(tool)
            )
              act(tileAt(e), e.shiftKey);
            if (d && !d.moved && e.button === 2) {
              pickTool("select");
              setCategory("");
            }
            finishStroke();
          }}
          onPointerCancel={() => {
            drag.current = null;
            finishStroke();
          }}
          onLostPointerCapture={() => {
            drag.current = null;
            finishStroke();
          }}
          onPointerLeave={() => {
            if (!drag.current) {
              view.current.hover = null;
              setHoverTile(null);
            }
          }}
        />
        <div className="parklabel">
          <div>
            <strong>Waldhain Park</strong>
            <p>Waldhain · {snapshot?.mode === "sandbox" ? "Freies Spiel" : "Szenario 01"}</p>
          </div>
          <span className="status">{snapshot?.open ? "Geöffnet" : "Geschlossen"}</span>
        </div>
        {category && category !== "erase" && category !== "select" && (
          <aside className="panel" aria-label="Bauauswahl">
            <div className="panelhead">
              <h2>
                {
                  (
                    {
                      rides: "Einsteigen & staunen",
                      coaster: "Deine Achterbahn",
                      paths: "Neue Verbindungen",
                      shops: "Für kleine Pausen",
                      nature: "Ein bisschen Grün",
                      detail: b?.name,
                      guests: "Stimmen aus dem Park",
                    } as Record<string, string | undefined>
                  )[category]
                }
              </h2>
              <button
                className="iconbtn"
                aria-label="Baufenster schließen"
                onClick={() => {
                  setCategory("");
                  setTool("select");
                  setDraft([]);
                }}
              >
                <X />
              </button>
            </div>
            <div className="panelbody">
              {category === "rides" && (
                <>
                  {catalog(["wheel", "carousel"])}
                  <button
                    className="primary"
                    style={{ marginTop: 12 }}
                    onClick={() => pickTool("coaster", "coaster")}
                  >
                    <RollerCoaster size={18} /> Eigene Achterbahn bauen
                  </button>
                  <div className="hintbox">
                    <Info />
                    <span>
                      Platziere die Attraktion. Danach legt „Anschließen & öffnen“ den Weg für dich
                      an.
                    </span>
                  </div>
                </>
              )}
              {category === "shops" && (
                <>
                  {catalog(["burger", "drink", "toilet"])}
                  <div className="hintbox">
                    <Info />
                    <span>Geschäfte stehen direkt an normalen Parkwegen.</span>
                  </div>
                </>
              )}
              {category === "nature" && (
                <>
                  {catalog(["tree", "pine", "flowers", "bench"])}
                  <button
                    className={`secondary ${tool === "water" ? "active" : ""}`}
                    style={{ width: "100%", marginTop: 12 }}
                    onClick={() => pickTool("water")}
                  >
                    Teich anlegen · 35 € / Feld
                  </button>
                  <div className="hintbox">
                    <Trees />
                    <span>Ein grüner Park verbessert die Stimmung deiner Besucher.</span>
                  </div>
                </>
              )}
              {category === "paths" && (
                <div className="stack">
                  <button
                    className={tool === "path" ? "primary" : "secondary"}
                    onClick={() => pickTool("path")}
                  >
                    <Route /> Parkweg · 12 €
                  </button>
                  <button
                    className={tool === "queue" ? "primary" : "secondary"}
                    onClick={() => pickTool("queue")}
                  >
                    <Users /> Warteschlange · 18 €
                  </button>
                  <p className="small">
                    Klicke oder ziehe über freie Wiese. Verbinde neue Wege mit dem Parkeingang.
                  </p>
                  <div className="empty-note">
                    Eine Warteschlange muss an der Station oder an einer Seite der Attraktion
                    beginnen und einen normalen Weg erreichen. Pro Feld passen vier Gäste hinein.
                  </div>
                </div>
              )}
              {category === "coaster" && (
                <>
                  <div className="build-modes" role="group" aria-label="Achterbahn-Bauweise">
                    <button
                      className={blueprintMode ? "active" : ""}
                      aria-pressed={blueprintMode}
                      onClick={() => {
                        setBlueprintMode(true);
                        setDraft([]);
                      }}
                    >
                      Schnellbau
                    </button>
                    <button
                      className={!blueprintMode ? "active" : ""}
                      aria-pressed={!blueprintMode}
                      onClick={() => {
                        setBlueprintMode(false);
                        setDraft([]);
                      }}
                    >
                      Eigene Strecke
                    </button>
                  </div>
                  {blueprintMode ? (
                    <>
                      <img
                        className="blueprint-art"
                        src={`${import.meta.env.BASE_URL}assets/pixel-v2/station.png`}
                        alt=""
                      />
                      <h3 className="blueprint-title">Waldflug</h3>
                      <p className="small">
                        Ein kompletter Rundkurs mit Lift und Abfahrt. Bewege ihn über den Park und
                        klicke zum Bauen.
                      </p>
                      <div className="draftstats">
                        <span>6 × 4 Felder · 10 m</span>
                        <b>{EUR(4705)}</b>
                      </div>
                      <button
                        className="secondary"
                        style={{ width: "100%" }}
                        onClick={() => setRotation((r) => (r + 1) % 4)}
                      >
                        <Undo2 size={16} /> Vorlage drehen <kbd>R</kbd>
                      </button>
                      <p className="buildnote">
                        Die Testfahrt startet automatisch. Danach genügt ein Klick zum Anschließen
                        und Eröffnen.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="small">
                        {draft.length
                          ? "Ergänze Abschnitte. Der Rundkurs endet am Startpunkt auf Höhe 0."
                          : "Klicke auf freie Wiese, um deine Station zu setzen."}
                      </p>
                      <div className="draftstats">
                        <span>{Math.max(0, draft.length - 1)} Abschnitte</span>
                        <b>{EUR(3600 + draft.length * 65)}</b>
                      </div>
                      <div className="editorlabel">
                        <span>Nächste Gleishöhe</span>
                        <b>{height * 5} m</b>
                      </div>
                      <Slider
                        aria-label="Gleishöhe"
                        min={0}
                        max={5}
                        step={1}
                        value={[height]}
                        onValueChange={(v) => setHeight(Array.isArray(v) ? v[0] : v)}
                      />
                      <div className="directions">
                        <div />
                        <button
                          disabled={!draft.length}
                          aria-label="Gleis nach Nordwesten"
                          onClick={() => extend(-1, 0)}
                        >
                          <ArrowUp />
                        </button>
                        <div />
                        <button
                          disabled={!draft.length}
                          aria-label="Gleis nach Südwesten"
                          onClick={() => extend(0, 1)}
                        >
                          <ArrowLeft />
                        </button>
                        <button
                          disabled={!draft.length}
                          aria-label="Letzten Abschnitt entfernen"
                          onClick={() => setDraft(draft.slice(0, -1))}
                        >
                          <Undo2 />
                        </button>
                        <button
                          disabled={!draft.length}
                          aria-label="Gleis nach Nordosten"
                          onClick={() => extend(0, -1)}
                        >
                          <ArrowRight />
                        </button>
                        <div />
                        <button
                          disabled={!draft.length}
                          aria-label="Gleis nach Südosten"
                          onClick={() => extend(1, 0)}
                        >
                          <ArrowDown />
                        </button>
                      </div>
                      <div className="actionstack">
                        <button className="secondary" disabled={!draft.length} onClick={template}>
                          <Sparkles size={16} /> Waldflug-Vorlage
                        </button>
                        <button
                          className="primary"
                          disabled={draft.length < 9}
                          onClick={coasterBuild}
                        >
                          <Check size={16} /> Strecke bauen
                        </button>
                      </div>
                      <p className="buildnote">
                        Grundpreis 3.600 € + 65 € pro Streckenpunkt. Höhenwechsel: maximal 5 m pro
                        Abschnitt. Bis zum Bauen ist der Entwurf kostenlos.
                      </p>
                    </>
                  )}
                </>
              )}
              {category === "detail" && b && snapshot && (
                <>
                  <img
                    className="detailhero"
                    src={`${import.meta.env.BASE_URL}assets/pixel-v2/${CATALOG[b.kind].sprite}.png`}
                    alt={b.name}
                  />
                  <div
                    className={`statebadge ${(!reachable && !decorative(b.kind)) || !b.open ? "warn" : ""}`}
                  >
                    {decorative(b.kind)
                      ? "Eine schöne Ecke für deine Besucher."
                      : !reachable
                        ? isRide(b.kind)
                          ? "Warteschlange fehlt oder hat keine Verbindung zum Eingang."
                          : "Ein erreichbarer Parkweg fehlt."
                        : b.testing
                          ? "Testfahrt läuft …"
                          : !b.tested
                            ? "Bereit für die Testfahrt."
                            : b.open
                              ? "Geöffnet · Besucher sind willkommen."
                              : "Geschlossen · Bereit zur Eröffnung."}
                  </div>
                  {connection && !reachable && (
                    <div className="connect-action">
                      <button
                        className="primary"
                        disabled={!!connection.error}
                        onMouseEnter={() => {
                          view.current.connection = connection.points;
                        }}
                        onMouseLeave={() => {
                          view.current.connection = undefined;
                        }}
                        onClick={() =>
                          edit("Anschluss", () => {
                            const live = park.current!.buildings.find((item) => item.id === b.id)!;
                            const error = connectBuilding(park.current!, live, autoClear);
                            view.current.connection = undefined;
                            notify(
                              error ??
                                (live.autoOpen
                                  ? "Warteschlange gebaut. Die Bahn öffnet nach der Testfahrt automatisch."
                                  : "Angeschlossen und geöffnet! Die Gäste können kommen."),
                            );
                          })
                        }
                      >
                        <Route size={16} /> Anschließen & öffnen · {EUR(connection.cost)}
                      </button>
                      <p className="small">
                        {connection.error ??
                          `${connection.points.length} Wegfelder${connection.clearIds.length ? ` · ${connection.clearIds.length} Deko freiräumen` : ""}`}
                      </p>
                    </div>
                  )}
                  {!decorative(b.kind) && (
                    <>
                      <div className="detailstats">
                        <div>
                          <span>Gäste bedient</span>
                          <strong>{b.served}</strong>
                        </div>
                        <div>
                          <span>Einnahmen</span>
                          <strong>{EUR(b.revenue)}</strong>
                        </div>
                      </div>
                      <div className="controlrow">
                        <span>Preis pro Besuch</span>
                        <strong>{EUR(b.price)}</strong>
                      </div>
                      <Slider
                        aria-label="Fahrpreis"
                        min={0}
                        max={30}
                        step={1}
                        value={[b.price]}
                        onValueChange={(v) =>
                          changeBuilding((b) => (b.price = Array.isArray(v) ? v[0] : v))
                        }
                      />
                      {isRide(b.kind) && (
                        <div className="controlrow">
                          <span>Warteschlange</span>
                          <strong>
                            {b.queue.length} / {queueCapacity(snapshot, b)}
                          </strong>
                        </div>
                      )}
                      {b.kind === "coaster" && b.track && (
                        <>
                          <div className="divider" />
                          <div className="detailstats">
                            <div>
                              <span>Streckenlänge</span>
                              <strong>{trackStats(b.track).length} m</strong>
                            </div>
                            <div>
                              <span>Höchsttempo</span>
                              <strong>
                                {trackStats(b.track).speed}
                                <small style={{ fontSize: 11 }}> km/h</small>
                              </strong>
                            </div>
                            <div>
                              <span>Fahrspaß</span>
                              <strong>{trackStats(b.track).excitement}</strong>
                            </div>
                            <div>
                              <span>Intensität</span>
                              <strong>{trackStats(b.track).intensity}</strong>
                            </div>
                          </div>
                          {!b.tested && (
                            <button
                              className="secondary"
                              style={{ width: "100%" }}
                              disabled={!!b.testing}
                              onClick={() => {
                                changeBuilding((b) => (b.testing = 8));
                                notify(
                                  "Der Testzug fährt die Strecke ab. Nach der Prüfung kannst du die Bahn eröffnen.",
                                );
                              }}
                            >
                              <FlaskConical size={16} />{" "}
                              {b.testing ? "Testfahrt läuft …" : "Testfahrt starten"}
                            </button>
                          )}
                        </>
                      )}
                      <button
                        className="primary"
                        style={{ marginTop: 14 }}
                        disabled={!b.open && (!reachable || !b.tested)}
                        onClick={() => changeBuilding((b) => (b.open = !b.open))}
                      >
                        {b.open ? <Pause size={16} /> : <Play size={16} />}{" "}
                        {b.open ? "Attraktion schließen" : "Jetzt eröffnen"}
                      </button>
                    </>
                  )}
                  <button
                    className="secondary"
                    style={{ width: "100%", marginTop: 10 }}
                    onClick={() => {
                      edit("Abriss", () => {
                        place(park.current!, "erase", { x: b.x, y: b.y });
                      });
                      setSelected(null);
                      setCategory("rides");
                      notify("Gebäude abgerissen. 40 % des Grundpreises wurden erstattet.");
                      sync();
                    }}
                  >
                    <Eraser size={16} /> Abreißen · +{EUR(CATALOG[b.kind].cost * 0.4)}
                  </button>
                </>
              )}
              {category === "guests" &&
                snapshot?.guests.slice(0, 7).map((g) => (
                  <div key={g.id} className="guestrow">
                    <img
                      alt=""
                      src={`${import.meta.env.BASE_URL}assets/pixel-v2/${g.skin === 1 ? "guest2-se" : g.skin === 0 ? "guest-se-a" : "guest-sw-a"}.png`}
                    />
                    <div>
                      <strong>Gast #{g.id}</strong>
                      <p>{g.thought}</p>
                    </div>
                    <span className="happiness">{Math.round(g.happiness)}%</span>
                  </div>
                ))}
            </div>
          </aside>
        )}
        <aside className={`objective ${tool !== "select" ? "while-building" : ""}`}>
          <div className="eyebrow">
            <Flag /> {snapshot?.mode === "sandbox" ? "Freies Spiel" : "Dein nächstes Ziel"}
          </div>
          <h3>{snapshot?.won ? "Ein Publikumsliebling!" : "Deine erste Parklegende"}</h3>
          <div className="goalrow">
            <span>Besucher begrüßen</span>
            <b>{Math.min(150, snapshot?.arrivals ?? 0)} / 150</b>
          </div>
          <div className="progressrail">
            <div style={{ width: Math.min(100, ((snapshot?.arrivals ?? 0) / 150) * 100) + "%" }} />
          </div>
          <div className="goalrow">
            <span>Attraktionen eröffnen</span>
            <b>{Math.min(4, readyRides)} / 4</b>
          </div>
          <div className="progressrail">
            <div style={{ width: Math.min(100, (readyRides / 4) * 100) + "%" }} />
          </div>
          <div className="goalrow">
            <span>Zufriedenheit</span>
            <b>{snapshot?.rating ?? 80} / 75 %</b>
          </div>
          <div className="reward">
            <Trophy />{" "}
            {snapshot?.won ? "Ziel erreicht – baue weiter!" : "Mache Waldhain zum Lieblingspark."}
          </div>
          <button
            className="secondary"
            style={{ width: "100%", marginTop: 14, fontSize: 12, padding: "8px" }}
            onClick={() => {
              setCategory("guests");
              setTool("select");
            }}
          >
            <Users size={14} /> Besucher beobachten
          </button>
        </aside>
        {tool !== "select" && (
          <div className={`build-status ${placement?.error ? "invalid" : ""}`} aria-live="polite">
            <div>
              <strong>
                {placement?.error ??
                  (placement
                    ? `${tool === "erase" ? "Abreißen" : tool === "coaster" ? "Waldflug" : (CATALOG[tool as Kind]?.name ?? (tool === "path" ? "Parkweg" : tool === "queue" ? "Warteschlange" : "Wasser"))} · ${EUR(placement.cost)}`
                    : "Bewege den Zeiger auf den Bauplatz")}
              </strong>
              <span>
                {placement?.warning ??
                  (tool === "coaster" && blueprintMode
                    ? "Klick baut · R dreht · Esc beendet"
                    : ["path", "queue", "water", "erase"].includes(tool)
                      ? "Ziehen baut mehrere Felder · Strg/⌘ Z nimmt den Bauzug zurück"
                      : "Klick baut · Shift für mehrere · Esc beendet")}
              </span>
            </div>
            <label className="clear-toggle">
              <input
                type="checkbox"
                checked={autoClear}
                onChange={(e) => setAutoClear(e.target.checked)}
              />{" "}
              Deko freiräumen
            </label>
            <button
              className="iconbtn"
              aria-label="Baumodus beenden"
              onClick={() => {
                pickTool("select");
                setCategory("");
              }}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {message && (
          <output
            className={`notification ${tool !== "select" ? "during-build" : ""}`}
            aria-live="polite"
          >
            <Sparkles />
            {message}
            <button
              style={{ border: 0, background: "none", padding: 0, marginLeft: 5 }}
              aria-label="Hinweis schließen"
              onClick={() => setMessage("")}
            >
              <X size={14} />
            </button>
          </output>
        )}
        {!assets && (
          <div className="asset-loading" role="status">
            <RollerCoaster />
            <h2>{assetError ? "Der Park braucht einen neuen Anlauf." : "Dein Park erwacht …"}</h2>
            <p>
              {assetError
                ? "Die Parkgrafiken konnten nicht geladen werden."
                : "Attraktionen, Bäume und Besucher werden geladen."}
            </p>
            {assetError && (
              <button className="primary" onClick={() => window.location.reload()}>
                Erneut laden
              </button>
            )}
          </div>
        )}
        <div className="timebar">
          <div className="day">
            Tag {1 + Math.floor((snapshot?.time ?? 0) / 90)}
            <span>Sommer · Jahr 1</span>
          </div>
          <div className="speeds">
            {[0, 1, 3].map((n) => (
              <button
                key={n}
                aria-label={n === 0 ? "Pause" : `${n}-fache Geschwindigkeit`}
                className={snapshot?.speed === n ? "active" : ""}
                onClick={() => {
                  if (park.current) park.current.speed = n;
                  sync();
                }}
              >
                {n === 0 ? <Pause /> : n === 1 ? <Play /> : "3×"}
              </button>
            ))}
          </div>
        </div>
        <nav className="bottom" aria-label="Bauwerkzeuge">
          {categories.map(({ id, label, Icon }) => (
            <button
              key={id}
              aria-pressed={category === id || (id === "erase" && tool === "erase")}
              className={`tool ${category === id || (id === "erase" && tool === "erase") ? "active" : ""}`}
              aria-label={label}
              onClick={() => {
                if (id === "select" || id === "erase") pickTool(id, id);
                else if (id === "coaster") pickTool("coaster", "coaster");
                else {
                  setCategory(id);
                  setSelected(null);
                  setDraft([]);
                  setTool(id === "paths" ? "path" : "select");
                }
              }}
            >
              <Icon strokeWidth={1.6} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="camerahelp">Rechts ziehen: verschieben · Mausrad: Zoom zum Zeiger</div>
        <button
          className="undo-build secondary"
          disabled={!undoCount && !draft.length}
          onClick={undo}
          title="Bauaktion rückgängig (⌘/Strg Z)"
          aria-label="Bauaktion rückgängig"
        >
          <Undo2 size={17} /> Rückgängig{undoCount > 0 ? ` (${undoCount})` : ""}
        </button>
        <div className="viewporttools">
          <span>{zoom}%</span>
          <button className="iconbtn" aria-label="Herauszoomen" onClick={() => changeZoom(1 / 1.2)}>
            <Minus size={16} />
          </button>
          <button className="iconbtn" aria-label="Hineinzoomen" onClick={() => changeZoom(1.2)}>
            <Plus size={16} />
          </button>
          <button
            className="iconbtn"
            aria-label="Ansicht zentrieren"
            onClick={() => {
              view.current = { ...view.current, zoom: 1, panX: 0, panY: 40 };
              setZoom(100);
            }}
          >
            <Maximize size={16} />
          </button>
        </div>
      </section>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="manual">
          <DialogTitle>Willkommen in Coaster Grove.</DialogTitle>
          <DialogDescription>
            Baue einen Park, in dem sich deine Gäste wohlfühlen.
          </DialogDescription>
          <ol>
            <li>
              <b>Neue Attraktionen:</b> Wähle unten ein Gebäude und klicke auf freie Wiese. Verbinde
              Fahrgeschäfte mit „Anschließen & öffnen“ automatisch mit dem Wegenetz.
            </li>
            <li>
              <b>Eröffnen:</b> Nach dem Bauen öffnet sich die Verwaltung direkt. Du kannst den
              Anschluss dort mit einem Klick bauen. Der Park verdient am Eintritt und an echten
              Besuchen.
            </li>
            <li>
              <b>Achterbahn:</b> Im Schnellbau setzt du einen vollständigen Rundkurs; R dreht ihn.
              Für eine eigene Strecke setze eine Station. Baue mit den Pfeilen oder benachbarten
              Kartenfeldern weiter. Wähle die Höhe vor dem nächsten Abschnitt. Kehre zur Station auf
              Höhe 0 zurück, baue, teste und eröffne die Strecke.
            </li>
            <li>
              <b>Glückliche Gäste:</b> Platziere Burger, Getränke und Toiletten an normalen Wegen.
              Überhöhte Preise schrecken Gäste ab. Personal und Grün helfen der Zufriedenheit.
            </li>
          </ol>
          <p>
            <kbd>⌘/Strg Z</kbd> Bau rückgängig · <kbd>R</kbd> Vorlage drehen · <kbd>Leertaste</kbd>{" "}
            Pause · <kbd>Esc</kbd> Auswahl · <kbd>⌘/Strg S</kbd> Speichern
            <br />
            Karte ziehen: Auswahlwerkzeug oder rechte Maustaste. Mausrad: Zoom. Ein Spieltag dauert
            90 Sekunden.
          </p>
          <footer>
            Originale Spielgrafiken: OpenArt, Projekt „Coaster Grove – Park Assets“. Eigenständiges
            Spiel nach den Bau- und Managementprinzipien von{" "}
            <a
              href="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/285310/manuals/rollercoaster_tycoon.pdf"
              target="_blank"
              rel="noreferrer"
            >
              RollerCoaster Tycoon
            </a>
            . Die Fahrwerte sind vereinfachte Spielwerte.
          </footer>
        </DialogContent>
      </Dialog>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="manual">
          <DialogTitle>Dein Park, deine Regeln.</DialogTitle>
          <DialogDescription>Verwalte den Parkbetrieb und deinen Spielstand.</DialogDescription>
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList className="tabsrow">
              <TabsTrigger value="park">Parkbetrieb</TabsTrigger>
              <TabsTrigger value="save">Spielstand</TabsTrigger>
            </TabsList>
            <TabsContent value="park">
              <div className="controlrow">
                <span>Parkeintritt</span>
                <strong>{EUR(snapshot?.ticket ?? 6)}</strong>
              </div>
              <Slider
                aria-label="Parkeintritt"
                min={0}
                max={30}
                step={1}
                value={[snapshot?.ticket ?? 6]}
                onValueChange={(v) => {
                  park.current!.ticket = Array.isArray(v) ? v[0] : v;
                  sync();
                }}
              />
              <div className="controlrow">
                <span>Parkmitarbeiter</span>
                <strong>{snapshot?.staff ?? 2}</strong>
              </div>
              <Slider
                aria-label="Anzahl Parkmitarbeiter"
                min={0}
                max={8}
                step={1}
                value={[snapshot?.staff ?? 2]}
                onValueChange={(v) => {
                  park.current!.staff = Array.isArray(v) ? v[0] : v;
                  sync();
                }}
              />
              <p className="small">
                45 € pro Mitarbeiter und Tag. Personal verbessert die Stimmung im Park.
              </p>
              <div className="detailstats">
                <div>
                  <span>Einnahmen gesamt</span>
                  <strong>{EUR(snapshot?.income ?? 0)}</strong>
                </div>
                <div>
                  <span>Ausgaben gesamt</span>
                  <strong>{EUR(snapshot?.expenses ?? 0)}</strong>
                </div>
                <div>
                  <span>Gewinn letzter Tag</span>
                  <strong>{EUR(snapshot?.lastProfit ?? 0)}</strong>
                </div>
                <div>
                  <span>Fahrgäste bedient</span>
                  <strong>{snapshot?.buildings.reduce((a, b) => a + b.served, 0) ?? 0}</strong>
                </div>
              </div>
              <button
                className="primary"
                onClick={() => {
                  park.current!.open = !park.current!.open;
                  sync();
                }}
              >
                {snapshot?.open ? "Park für neue Besucher schließen" : "Park öffnen"}
              </button>
            </TabsContent>
            <TabsContent value="save">
              <p className="small">
                Dein Park wird alle 20 Sekunden automatisch in diesem Browser gespeichert.
              </p>
              <div className="stack">
                <button className="primary" onClick={save}>
                  <Save /> Jetzt speichern
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    try {
                      const raw = localStorage.getItem("coaster-grove-v1");
                      if (!raw) throw Error();
                      const s = JSON.parse(raw);
                      if (!validSave(s)) throw Error();
                      park.current = s;
                      history.current = [];
                      stroke.current = null;
                      setUndoCount(0);
                      sync();
                      setSettings(false);
                      setSelected(null);
                      setCategory("rides");
                      setTool("select");
                      setDraft([]);
                      setHeight(0);
                      announced.current = s.won;
                      notify("Gespeicherter Park geladen.");
                    } catch {
                      notify("Kein gültiger Spielstand in diesem Browser gefunden.");
                    }
                  }}
                >
                  <FolderOpen /> Letzten Spielstand laden
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setSettings(false);
                    setNewDialog(true);
                  }}
                >
                  Neuen Park beginnen
                </button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      <Dialog open={newDialog} onOpenChange={setNewDialog}>
        <DialogContent className="manual">
          <DialogTitle>Ein neuer Anfang.</DialogTitle>
          <DialogDescription>
            Dein aktueller Park wird ersetzt. Der neue Park überschreibt beim nächsten Speichern den
            bisherigen Spielstand.
          </DialogDescription>
          <div className="stack">
            {(["scenario", "sandbox"] as const).map((m) => (
              <button
                className={m === "scenario" ? "primary" : "secondary"}
                key={m}
                onClick={() => {
                  park.current = newPark(m);
                  history.current = [];
                  stroke.current = null;
                  setUndoCount(0);
                  setNewDialog(false);
                  setSelected(null);
                  setCategory("rides");
                  setTool("select");
                  setDraft([]);
                  announced.current = false;
                  sync();
                  notify("Willkommen zurück im neuen Waldhain Park.");
                }}
              >
                {m === "scenario" ? "Waldhain-Szenario · 16.000 €" : "Freies Spiel · 100.000 €"}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
