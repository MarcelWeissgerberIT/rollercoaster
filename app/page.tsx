"use client";
/* oxlint-disable next/no-img-element, react/react-compiler -- Native transparent sprite images and a mutable external simulation are intentional. */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Volume2,
  VolumeX,
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
  Undo2,
  FlaskConical,
  Settings2,
  Flag,
  Info,
  Move,
  RotateCw,
  MapPin,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  migratePark,
  SCENARIOS,
  RESEARCH,
  startResearch,
  scenarioOf,
  parkValue,
  entryDemand,
  expectedWait,
  isUnlocked,
  type ScenarioId,
  type ResearchId,
  rideDuration,
  buildingBaseCost,
  COASTER_TYPES,
  trackCost,
  type CoasterType,
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
  planPlacement,
  place,
  planConnection,
  connectBuilding,
  recordEdit,
  undoEdits,
  planStationMove,
  planRelocation,
  stationPositions,
  suggestStation,
  adjustBuilding,
  type BuildTool,
  type EditRecord,
} from "@/game/construction";
import {
  isClosedTrack,
  startTrack,
  appendPiece,
  prefabBlueprint,
  closeTrack,
  pieceError,
  PIECES,
  type Piece,
} from "@/game/prefabs";
import { ParkAudio, DEFAULT_AUDIO, AUDIO_KEY, parseAudio, type AudioSettings } from "@/game/audio";
const RideView = lazy(() => import("@/components/ride-view"));
const assetUrl = (name: string) =>
  `${import.meta.env.BASE_URL}assets/${/^(car-(steel|wood|launch)|station-(steel|wood|launch)|ride-)/.test(name) ? "expansion-v4" : "pixel-v2"}/${name}.png`;
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
  const [coasterType, setCoasterType] = useState<CoasterType>("steel");
  const [piece, setPiece] = useState<Piece>("straight");
  const draftHistory = useRef<Point[][]>([]);
  const [ride, setRide] = useState<{ park: Park; building: Building } | null>(null);
  const rideActive = useRef(false);
  const audio = useRef<ParkAudio | null>(null);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(DEFAULT_AUDIO);
  const audioPreferences = useRef(DEFAULT_AUDIO);
  const setSound = (value: AudioSettings) => {
    audioPreferences.current = value;
    setAudioSettings(value);
    audio.current?.setSettings(value);
    if (value.enabled) void audio.current?.unlock();
    try {
      localStorage.setItem(AUDIO_KEY, JSON.stringify(value));
    } catch {}
  };
  const toggleSound = () =>
    setSound({ ...audioPreferences.current, enabled: !audioPreferences.current.enabled });
  useEffect(() => {
    const engine = new ParkAudio();
    audio.current = engine;
    let pref = { ...DEFAULT_AUDIO };
    try {
      pref = parseAudio(localStorage.getItem(AUDIO_KEY));
    } catch {}
    audioPreferences.current = pref;
    setAudioSettings(pref);
    engine.setSettings(pref);
    const unlock = () => {
      void engine.unlock();
    };
    const visibility = () => engine.visibility(document.hidden);
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
      document.removeEventListener("visibilitychange", visibility);
      engine.dispose();
      audio.current = null;
    };
  }, []);
  const [draft, writeDraft] = useState<Point[]>([]);
  const setDraft = (next: Point[]) => {
    writeDraft(next);
    if (park.current)
      park.current.draft = next.length
        ? {
            track: next,
            history: draftHistory.current
              .map((t) => t.length)
              .filter((n) => n < next.length)
              .slice(-128),
            style: next[0]?.style ?? coasterType,
            piece,
            rotation,
          }
        : undefined;
  };
  const restoreDraft = (s: Park) => {
    const d = s.draft;
    writeDraft(d?.track ?? []);
    draftHistory.current = d ? d.history.map((n) => d.track.slice(0, n)) : [];
    if (d) {
      setCoasterType(d.style);
      setPiece(d.piece ?? "straight");
      setRotation(d.rotation);
      setBlueprintMode(false);
    }
  };
  const [blueprintMode, setBlueprintMode] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [autoClear, setAutoClear] = useState(true);
  const [adjust, setAdjust] = useState<{
    id: number;
    mode: "station" | "move";
    point: Point;
    rotation: number;
  } | null>(null);
  const [hoverTile, setHoverTile] = useState<Point | null>(null);
  const history = useRef<EditRecord[][]>([]);
  const stroke = useRef<EditRecord[] | null>(null);
  const [undoCount, setUndoCount] = useState(0);
  const [worldRevision, setWorldRevision] = useState(0);
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
      audio.current?.effect("build");
      setWorldRevision((v) => v + 1);
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
    if (tool === "coaster" && draft.length && !blueprintMode) {
      setDraft(draftHistory.current.pop() ?? []);
      return;
    }
    finishStroke();
    const records = history.current.pop();
    if (!records || !park.current) return;
    undoEdits(park.current, records);
    setWorldRevision((v) => v + 1);
    setUndoCount(history.current.length);
    if (adjust) {
      setAdjust(null);
      setTool("select");
    }
    setSelected(null);
    setCategory((c) => (c === "detail" ? "" : c));
    notify(`${records[0].label} rückgängig gemacht.`);
    sync();
  }, [draft, blueprintMode, finishStroke, notify, sync, adjust, tool]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5500);
    return () => clearTimeout(timer);
  }, [message]);
  const adjustingBuilding = snapshot?.buildings.find((b) => b.id === adjust?.id);
  const adjustmentPlan = useMemo(
    () =>
      adjust && adjustingBuilding && snapshot
        ? adjust.mode === "station"
          ? planStationMove(snapshot, adjustingBuilding, adjust.point, autoClear)
          : planRelocation(snapshot, adjustingBuilding, adjust.point, adjust.rotation, autoClear)
        : null,
    [snapshot, adjust, adjustingBuilding, autoClear],
  );
  useEffect(() => {
    if (tool !== "move" && tool !== "station") setAdjust(null);
  }, [tool]);
  const candidate = useMemo(
    () => (tool === "coaster" && !blueprintMode && draft.length ? appendPiece(draft, piece) : []),
    [tool, blueprintMode, draft, piece],
  );
  const candidateError = useMemo(
    () => (snapshot && candidate.length ? pieceError(snapshot, draft, candidate, autoClear) : null),
    [worldRevision, draft, candidate, autoClear],
  );
  const draftPlan = useMemo(
    () =>
      snapshot && draft.length > 1
        ? planPlacement(snapshot, "coaster", draft[0], draft, autoClear)
        : null,
    [worldRevision, draft, autoClear, snapshot?.cash],
  );
  const previewTrack = useMemo(
    () =>
      adjustmentPlan?.geometry.track ??
      (tool === "coaster" && blueprintMode && hoverTile
        ? prefabBlueprint(hoverTile, rotation, coasterType)
        : tool === "coaster" && !blueprintMode
          ? draft
          : []),
    [tool, blueprintMode, hoverTile, rotation, draft, adjustmentPlan, coasterType],
  );
  const placement = useMemo(
    () =>
      adjustmentPlan ??
      (snapshot &&
      tool !== "select" &&
      tool !== "move" &&
      tool !== "station" &&
      hoverTile &&
      (tool !== "coaster" || blueprintMode)
        ? planPlacement(
            snapshot,
            tool as BuildTool,
            hoverTile,
            tool === "coaster" ? previewTrack : undefined,
            autoClear,
          )
        : null),
    [snapshot, tool, hoverTile, blueprintMode, previewTrack, autoClear, adjustmentPlan],
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
          initial = migratePark(data);
          setMessage("Willkommen zurück. Dein gespeicherter Park ist bereit.");
        }
      }
    } catch {}
    park.current = initial;
    restoreDraft(initial);
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
        notify(
          `Ziel erreicht! ${scenarioOf(park.current).name} ist ein Publikumsliebling. Weitere Szenarien findest du unter Spielstand.`,
        );
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
        if (!document.hidden && assets && !rideActive.current) {
          const income = park.current.income;
          tick(park.current, dt);
          if (
            park.current.income > income &&
            Math.floor(time / 1500) !== Math.floor((time - dt * 1000) / 1500)
          )
            audio.current?.effect("cash");
        }
        audio.current?.park(rideActive.current || park.current.speed > 0);
        if (!rideActive.current)
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
    view.current.candidate =
      candidate.length && !isClosedTrack(draft)
        ? { points: candidate.slice(Math.max(0, draft.length - 1)), error: !!candidateError }
        : undefined;
    view.current.height = height;
    view.current.grid = tool !== "select";
    view.current.adjustment =
      adjust && adjustingBuilding && adjustmentPlan
        ? {
            mode: adjust.mode,
            building: adjustingBuilding,
            geometry: adjustmentPlan.geometry,
            candidates: stationPositions(adjustingBuilding),
          }
        : undefined;
    view.current.connection = adjustmentPlan?.connection?.points;
  }, [
    tool,
    selected,
    previewTrack,
    placement,
    height,
    adjust,
    adjustingBuilding,
    adjustmentPlan,
    candidate,
    candidateError,
    draft.length,
  ]);
  const pickTool = useCallback(
    (t: string, cat?: string) => {
      setTool(t);
      setSelected(null);
      if (cat) setCategory(cat);

      notify(
        t === "select"
          ? "Klicke eine Attraktion an, um ihren Betrieb zu verwalten."
          : t === "erase"
            ? "Klicke auf ein Gebäude oder einen Weg. Gebäude erstatten 40 % des Grundpreises."
            : t === "coaster"
              ? "Wähle einen Bahntyp. R dreht den Schnellbau; unter Bauteile planst du deine eigene Strecke."
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
      if (!s || rideActive.current) return;
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
      if (
        e.key.toLowerCase() === "r" &&
        adjust?.mode === "move" &&
        adjustingBuilding?.kind === "coaster"
      ) {
        e.preventDefault();
        setAdjust((a) => (a ? { ...a, rotation: (a.rotation + 1) % 4 } : a));
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
  }, [save, sync, pickTool, changeZoom, undo, tool, blueprintMode, adjust, adjustingBuilding]);

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
    if (kind === "coaster") {
      built.testing = rideDuration(built);
      built.testDuration = built.testing;
    }
    if (!decorative(kind) && !repeat) {
      setSelected(id);
      setCategory("detail");
      setTool("select");
      if (kind === "coaster" && !blueprintMode) {
        draftHistory.current = [];
        setDraft([]);
      }
    }
    notify(
      decorative(kind)
        ? `${CATALOG[kind].name} gepflanzt.`
        : `${CATALOG[kind].name} gebaut. Prüfe den Zugang und öffne die Attraktion im Baufenster.`,
    );
  };
  const startAdjustment = (mode: "station" | "move", point?: Point) => {
    const b = park.current?.buildings.find((b) => b.id === selected);
    if (!b) return;
    setAdjust({ id: b.id, mode, point: point ?? { x: b.x, y: b.y }, rotation: 0 });
    setTool(mode);
    setHoverTile(null);
    notify(
      mode === "station"
        ? "Grüne Gleisfelder sind geeignete Stationsplätze. Bewegen zeigt die Vorschau, ein Klick versetzt."
        : "Bewege die Bahn zum neuen Platz. R dreht die Achterbahn, ein Klick übernimmt.",
    );
  };
  const cancelAdjustment = () => {
    setAdjust(null);
    setTool("select");
    view.current.connection = undefined;
  };
  const act = (p: Point, repeat = false) => {
    const s = park.current;
    if (!s) return;
    if (adjust && (tool === "station" || tool === "move")) {
      const b = s.buildings.find((b) => b.id === adjust.id);
      if (!b) return;
      edit(adjust.mode === "station" ? "Stationsversatz" : "Versetzen", () => {
        const error = adjustBuilding(s, b, adjust.mode, p, adjust.rotation, autoClear);
        if (error) {
          notify(error);
          return;
        }
        cancelAdjustment();
        setCategory("detail");
        notify(
          access(s, b)
            ? "Position übernommen. Der Weg ist erreichbar – du kannst die Attraktion öffnen."
            : "Position übernommen. Verbinde jetzt den neuen Eingang mit dem Wegenetz.",
        );
      });
      return;
    }
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
          (occupant(s, p.x, p.y) && (!autoClear || !decorative(occupant(s, p.x, p.y)!.kind)))
        ) {
          notify("Die Station braucht freie Wiese.");
          return;
        }
        draftHistory.current = [];
        setDraft(startTrack(p, rotation, coasterType));
        notify("Station gesetzt. Wähle ein Bauteil: Es dockt automatisch am Streckenende an.");
      } else {
        addPiece(piece);
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
          tool === "coaster" ? prefabBlueprint(p, rotation, coasterType) : undefined,
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
  const rememberDraft = (next: Point[]) => {
    draftHistory.current.push(draft);
    setDraft(next);
    const el = canvas.current,
      end = next.at(-1);
    if (el && end) {
      const p = projection(el.clientWidth, el.clientHeight, view.current).project(
          end.x,
          end.y,
          end.z,
        ),
        left = 370,
        right = el.clientWidth - 80,
        top = 80,
        bottom = el.clientHeight - 135;
      view.current.panX += p.x < left ? left - p.x : p.x > right ? right - p.x : 0;
      view.current.panY += p.y < top ? top - p.y : p.y > bottom ? bottom - p.y : 0;
    }
  };
  const addPiece = (part: Piece) => {
    if (!park.current || !draft.length) return;
    if (part === "loop" && !COASTER_TYPES[coasterType].loop) {
      notify("Holzbahnen unterstützen keine Loopings.");
      return;
    }
    const next = appendPiece(draft, part),
      error = pieceError(park.current, draft, next, autoClear);
    if (error) notify(error);
    else rememberDraft(next);
  };
  const autoClose = () => {
    if (!park.current) return;
    const result = closeTrack(park.current, draft, autoClear);
    if (result.error) notify(result.error);
    else if (result.track) rememberDraft(result.track);
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
  const b = snapshot?.buildings.find((b) => b.id === selected);
  const connection =
    b && snapshot && !decorative(b.kind) ? planConnection(snapshot, b, autoClear) : null;
  const reachable = b && snapshot ? access(snapshot, b) : null;
  const directAccess =
    reachable && snapshot?.tiles[reachable.y][reachable.x] === "path" && b && isRide(b.kind);
  const recommendedStation = useMemo(
    () =>
      b?.kind === "coaster" && snapshot && !reachable
        ? suggestStation({ ...snapshot, cash: Number.MAX_SAFE_INTEGER }, b, autoClear)
        : null,
    [b, b?.track, worldRevision, autoClear],
  );
  const readyRides =
    snapshot?.buildings.filter((b) => isRide(b.kind) && b.open && b.tested && access(snapshot, b))
      .length ?? 0;
  const goal = snapshot ? scenarioOf(snapshot) : SCENARIOS.waldhain;
  const catalog = (items: Kind[]) => (
    <div className="catalog">
      {items.map((k) => (
        <button
          key={k}
          className={`asset-card ${tool === k ? "active" : ""}`}
          onClick={() => pickTool(k)}
          disabled={!!snapshot && !isUnlocked(snapshot, k)}
        >
          <img src={assetUrl(CATALOG[k].sprite)} alt="" />
          <strong>{CATALOG[k].name}</strong>
          <span>
            {snapshot && !isUnlocked(snapshot, k) ? "Forschung nötig" : EUR(CATALOG[k].cost)}
          </span>
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
          <button
            className="iconbtn"
            aria-label={audioSettings.enabled ? "Sound ausschalten" : "Sound einschalten"}
            title="Sound · Lautstärke in der Parkverwaltung"
            onClick={toggleSound}
          >
            {audioSettings.enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
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
            if (adjust)
              setAdjust((a) =>
                a && (a.point.x !== p.x || a.point.y !== p.y) ? { ...a, point: p } : a,
              );
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
        {draft.length > 0 && category !== "coaster" && (
          <button
            className="resume-draft secondary"
            onClick={() => {
              setBlueprintMode(false);
              setCoasterType(draft[0].style ?? "steel");
              pickTool("coaster", "coaster");
            }}
          >
            Entwurf fortsetzen · {trackStats(draft).length} m
          </button>
        )}
        <div className="parklabel">
          <div>
            <strong>{snapshot ? scenarioOf(snapshot).name : "Waldhain Park"}</strong>
            <p>
              {snapshot?.mode === "sandbox"
                ? "Freies Spiel"
                : snapshot
                  ? scenarioOf(snapshot).subtitle
                  : "Ein Park für alle"}
            </p>
          </div>
          <span className="status">{snapshot?.open ? "Geöffnet" : "Geschlossen"}</span>
        </div>
        {category && category !== "erase" && category !== "select" && (
          <aside
            className={`panel ${category === "coaster" ? "builder-panel" : ""}`}
            aria-label="Bauauswahl"
          >
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
                }}
              >
                <X />
              </button>
            </div>
            <div className="panelbody">
              {category === "rides" && (
                <>
                  {catalog(["wheel", "carousel", "swing", "drop", "pirate"])}
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
                  <div className="coaster-types" role="group" aria-label="Achterbahntyp">
                    {(Object.keys(COASTER_TYPES) as CoasterType[]).map((type) => (
                      <button
                        key={type}
                        className={coasterType === type ? "active" : ""}
                        disabled={
                          (!blueprintMode && draft.length > 0) ||
                          (!!snapshot && !isUnlocked(snapshot, "coaster", type))
                        }
                        onClick={() => {
                          setCoasterType(type);
                          if (type === "wood" && piece === "loop") setPiece("straight");
                        }}
                      >
                        <img src={assetUrl(`car-${type}-se`)} alt="" />
                        <strong>{COASTER_TYPES[type].name}</strong>
                      </button>
                    ))}
                  </div>

                  <div className="build-modes" role="group" aria-label="Achterbahn-Bauweise">
                    <button
                      className={blueprintMode ? "active" : ""}
                      aria-pressed={blueprintMode}
                      onClick={() => {
                        setBlueprintMode(true);
                      }}
                    >
                      Schnellbau
                    </button>
                    <button
                      className={!blueprintMode ? "active" : ""}
                      aria-pressed={!blueprintMode}
                      onClick={() => {
                        setBlueprintMode(false);
                        if (draft[0]?.style) setCoasterType(draft[0].style);
                      }}
                    >
                      Bauteile
                    </button>
                  </div>
                  {blueprintMode ? (
                    <>
                      <img
                        className="blueprint-art"
                        src={assetUrl(`station-${coasterType}`)}
                        alt=""
                      />
                      <h3 className="blueprint-title">{COASTER_TYPES[coasterType].name}</h3>
                      <p className="small">
                        {coasterType === "launch"
                          ? "Launch-Geraden und ein 20 m hoher Looping."
                          : coasterType === "wood"
                            ? "Weiche Kurven und zwei Hügel auf einem Holztragwerk."
                            : "Ein Rundkurs mit Kettenlift, Abfahrt und weiten Kurven."}{" "}
                        Klicke auf freie Wiese zum Bauen.
                      </p>
                      <div className="draftstats">
                        <span>
                          {trackStats(prefabBlueprint({ x: 0, y: 0 }, 0, coasterType)).length} m
                          Strecke
                        </span>
                        <b>{EUR(trackCost(prefabBlueprint({ x: 0, y: 0 }, 0, coasterType)))}</b>
                      </div>
                      <button
                        className="secondary"
                        style={{ width: "100%" }}
                        onClick={() => setRotation((r) => (r + 1) % 4)}
                      >
                        <RotateCw size={16} /> Vorlage drehen <kbd>R</kbd>
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="small builder-instruction">
                        {draft.length
                          ? "Bauteil wählen → Vorschau prüfen → anfügen."
                          : "Klicke auf freie Wiese, um die Station zu setzen."}
                      </p>
                      {!draft.length && (
                        <button
                          className="secondary"
                          onClick={() => setRotation((r) => (r + 1) % 4)}
                        >
                          <RotateCw size={16} /> Startrichtung drehen ·{" "}
                          {["Südost", "Südwest", "Nordwest", "Nordost"][rotation % 4]}
                        </button>
                      )}
                      <div className="draftstats">
                        <span>
                          {draft.length ? trackStats(draft).length : 0} m ·{" "}
                          {Math.round((draft.at(-1)?.z ?? 0) * 5)} m Höhe
                        </span>
                        <b>{EUR(trackCost(draft))}</b>
                      </div>
                      <div className="prefab-grid">
                        {(Object.entries(PIECES) as [Piece, (typeof PIECES)[Piece]][]).map(
                          ([id, item]) => (
                            <button
                              key={id}
                              className={piece === id ? "active" : ""}
                              disabled={
                                !draft.length || (id === "loop" && !COASTER_TYPES[coasterType].loop)
                              }
                              title={
                                id === "loop" && !COASTER_TYPES[coasterType].loop
                                  ? "Nur Stahl- und Launch-Bahnen"
                                  : item.detail
                              }
                              onClick={() => {
                                setPiece(id);
                                if (park.current?.draft) park.current.draft.piece = id;
                              }}
                            >
                              <span className="piece-glyph">{item.glyph}</span>
                              <strong>{item.name}</strong>
                              <small>{item.detail}</small>
                            </button>
                          ),
                        )}
                      </div>
                      <div
                        className={`candidate-status ${candidateError && !isClosedTrack(draft) ? "invalid" : ""}`}
                        role="status"
                      >
                        {candidateError ??
                          (draft.length
                            ? `${PIECES[piece].name}: Anschluss frei · ${EUR(trackCost(candidate) - trackCost(draft))}`
                            : "Setze die Station auf die Wiese.")}
                      </div>
                      <div className="builder-actions">
                        <div className="builder-row">
                          <button
                            className="primary"
                            disabled={!draft.length || !!candidateError}
                            onClick={() => addPiece(piece)}
                          >
                            <Plus size={16} /> Anfügen
                          </button>
                          <button
                            className="secondary"
                            aria-label="Letztes Bauteil entfernen"
                            title="Letztes Bauteil entfernen · Strg/⌘ Z"
                            disabled={!draft.length}
                            onClick={() => setDraft(draftHistory.current.pop() ?? [])}
                          >
                            <Undo2 size={16} />
                          </button>
                        </div>
                        <button
                          className="secondary"
                          disabled={draft.length < 2}
                          onClick={autoClose}
                        >
                          <Route size={16} /> Zur Station verbinden
                        </button>
                        <button
                          className="primary"
                          disabled={!draftPlan || !!draftPlan.error}
                          title={draftPlan?.error ?? "Strecke bauen"}
                          onClick={coasterBuild}
                        >
                          <Check size={16} /> Strecke bauen ·{" "}
                          {EUR(draftPlan?.cost ?? trackCost(draft))}
                        </button>
                        <div className="builder-options">
                          <label>
                            <input
                              type="checkbox"
                              checked={autoClear}
                              onChange={(e) => setAutoClear(e.target.checked)}
                            />{" "}
                            Deko freiräumen
                          </label>
                          <button
                            className="text-action"
                            disabled={!draft.length}
                            onClick={() => {
                              draftHistory.current = [];
                              setDraft([]);
                            }}
                          >
                            Verwerfen
                          </button>
                        </div>
                      </div>
                      <p className="buildnote">
                        {draftPlan?.error ??
                          "Entwurf gespeichert · Werkzeugwechsel jederzeit möglich."}
                      </p>
                    </>
                  )}
                </>
              )}
              {category === "detail" && b && snapshot && (
                <>
                  {adjust ? (
                    <div className="adjust-panel">
                      <div className="adjust-heading">
                        {adjust.mode === "station" ? <MapPin /> : <Move />}
                        <h3>
                          {adjust.mode === "station" ? "Station versetzen" : "Position anpassen"}
                        </h3>
                      </div>
                      <p className="small">
                        {adjust.mode === "station"
                          ? "Wähle ein grün markiertes Gleisfeld. Die Station braucht einen geraden, ebenen Abschnitt am Boden."
                          : "Bewege die Bahn über den Park. Ihre Station ist der Ankerpunkt. Die bisherige Position bleibt bis zur Bestätigung bestehen."}
                      </p>
                      {adjust.mode === "move" && b.kind === "coaster" && (
                        <button
                          className="secondary"
                          onClick={() =>
                            setAdjust((a) => (a ? { ...a, rotation: (a.rotation + 1) % 4 } : a))
                          }
                        >
                          <RotateCw size={16} /> Um 90° drehen <kbd>R</kbd>
                        </button>
                      )}
                      {adjust.mode === "station" && recommendedStation && (
                        <button
                          className="secondary"
                          onClick={() =>
                            setAdjust((a) => (a ? { ...a, point: recommendedStation } : a))
                          }
                        >
                          <Sparkles size={16} /> Geeigneten Platz vorschlagen
                        </button>
                      )}
                      <div
                        className={`statebadge ${adjustmentPlan?.error || adjustmentPlan?.connection?.error ? "warn" : ""}`}
                      >
                        {adjustmentPlan?.error ??
                          (adjustmentPlan?.connection?.error
                            ? "Hier ist noch kein Anschluss möglich."
                            : adjustmentPlan?.connection?.points.length
                              ? `Anschluss möglich · ${EUR(adjustmentPlan.connection.cost)} zusätzliche Wegkosten`
                              : "Direkt an erreichbarem Weg")}
                      </div>
                      <div className="controlrow">
                        <span>Versetzen</span>
                        <strong>{EUR(adjustmentPlan?.cost ?? 0)}</strong>
                      </div>
                      <p className="small">
                        {adjustmentPlan?.warning ??
                          "Die Strecke bleibt erhalten. Versetzen ist kostenlos."}
                      </p>
                      <button
                        className="primary"
                        disabled={!!adjustmentPlan?.error || !adjustmentPlan?.changed}
                        onClick={() => act(adjust.point)}
                      >
                        <Check size={16} /> Position übernehmen
                      </button>
                      <button className="secondary" onClick={cancelAdjustment}>
                        <X size={16} /> Abbrechen
                      </button>
                      <p className="buildnote">
                        Beim Übernehmen wird der Betrieb gestoppt. Namen, Fahrpreise und Einnahmen
                        bleiben erhalten. Strg/⌘ Z macht den Umbau rückgängig.
                      </p>
                    </div>
                  ) : (
                    <>
                      <img
                        className="detailhero"
                        src={assetUrl(
                          b.kind === "coaster"
                            ? `car-${b.track?.[0]?.style ?? "steel"}-se`
                            : CATALOG[b.kind].sprite,
                        )}
                        alt={b.name}
                      />
                      <div
                        className={`statebadge ${(!reachable && !decorative(b.kind)) || !b.open ? "warn" : ""}`}
                      >
                        {decorative(b.kind)
                          ? "Eine schöne Ecke für deine Besucher."
                          : !reachable
                            ? isRide(b.kind)
                              ? "Ein erreichbarer Weg oder eine Warteschlange fehlt am Eingang."
                              : "Ein erreichbarer Parkweg fehlt."
                            : b.testing
                              ? "Testfahrt läuft …"
                              : !b.tested
                                ? "Bereit für die Testfahrt."
                                : b.open
                                  ? "Geöffnet · Besucher sind willkommen."
                                  : "Geschlossen · Bereit zur Eröffnung."}
                      </div>
                      {b.kind === "coaster" && b.track && (
                        <button
                          className="primary ride-launch"
                          onClick={() => {
                            const copy = structuredClone(park.current!);
                            rideActive.current = true;
                            setRide({
                              park: copy,
                              building: copy.buildings.find((x) => x.id === b.id)!,
                            });
                          }}
                        >
                          <Play size={18} /> 3D-Mitfahren
                        </button>
                      )}
                      <div className="adjust-actions">
                        {b.kind === "coaster" && (
                          <button className="secondary" onClick={() => startAdjustment("station")}>
                            <MapPin size={16} /> Station versetzen
                          </button>
                        )}
                        <button className="secondary" onClick={() => startAdjustment("move")}>
                          <Move size={16} />{" "}
                          {b.kind === "coaster" ? "Bahn verschieben / drehen" : "Gebäude versetzen"}
                        </button>
                      </div>
                      {directAccess && (
                        <p className="direct-access">
                          <Check size={14} /> Direktzugang · 4 Warteplätze. Eine eigene
                          Warteschlange schafft mehr Platz.
                        </p>
                      )}
                      {connection && (!reachable || !b.open) && (
                        <div className="connect-action">
                          <button
                            className="primary"
                            disabled={!!connection.error || (!!b.autoOpen && !!reachable)}
                            onMouseEnter={() => {
                              view.current.connection = connection.points;
                            }}
                            onMouseLeave={() => {
                              view.current.connection = undefined;
                            }}
                            onClick={() =>
                              edit("Anschluss", () => {
                                const live = park.current!.buildings.find(
                                  (item) => item.id === b.id,
                                )!;
                                const error = connectBuilding(park.current!, live, autoClear);
                                view.current.connection = undefined;
                                notify(
                                  error ??
                                    (live.autoOpen
                                      ? "Zugang bereit. Die Bahn öffnet nach der Testfahrt automatisch."
                                      : "Angeschlossen und geöffnet! Die Gäste können kommen."),
                                );
                              })
                            }
                          >
                            <Route size={16} />{" "}
                            {connection.error
                              ? "Anschluss nicht möglich"
                              : b.autoOpen && reachable
                                ? "Öffnet nach der Testfahrt"
                                : reachable
                                  ? b.tested
                                    ? "Jetzt eröffnen"
                                    : "Nach Test automatisch öffnen"
                                  : `Anschließen & öffnen · ${EUR(connection.cost)}`}
                          </button>
                          <p className="small">
                            {connection.error ??
                              (reachable
                                ? "Vorhandener Zugang wird verwendet. Keine Baukosten."
                                : `${connection.points.length} Wegfelder${connection.clearIds.length ? ` · ${connection.clearIds.length} Deko freiräumen` : ""}`)}
                          </p>
                          {connection.error && recommendedStation && (
                            <button
                              className="secondary"
                              onClick={() => startAdjustment("station", recommendedStation)}
                            >
                              <Sparkles size={16} /> Besseren Stationsplatz zeigen
                            </button>
                          )}
                          {connection.error && (
                            <button className="secondary" onClick={() => pickTool("path", "paths")}>
                              <Route size={16} /> Parkweg selbst bauen
                            </button>
                          )}
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
                          {!decorative(b.kind) && (
                            <div className="controlrow">
                              <span>Warteschlange</span>
                              <strong>
                                {b.queue.length} / {isRide(b.kind) ? queueCapacity(snapshot, b) : 6}{" "}
                                · ~{Math.ceil(expectedWait(b))} s
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
                                    changeBuilding((b) => {
                                      b.testing = rideDuration(b);
                                      b.testDuration = b.testing;
                                    });
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
                          {b.open && (
                            <button
                              className="primary"
                              style={{ marginTop: 14 }}
                              disabled={!b.open && (!reachable || !b.tested)}
                              onClick={() => changeBuilding((b) => (b.open = !b.open))}
                            >
                              {b.open ? <Pause size={16} /> : <Play size={16} />}{" "}
                              {b.open ? "Attraktion schließen" : "Jetzt eröffnen"}
                            </button>
                          )}
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
                      <strong>
                        Gast #{g.id} ·{" "}
                        {g.profile === "thrill"
                          ? "Nervenkitzel"
                          : g.profile === "budget"
                            ? "Sparfuchs"
                            : "Familie"}
                      </strong>
                      <small>Budget {EUR(g.wallet ?? 60)}</small>
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
          <h3>{snapshot?.won ? "Ein Publikumsliebling!" : goal.subtitle}</h3>
          <div className="goalrow">
            <span>Besucher begrüßen</span>
            <b>
              {Math.min(goal.arrivals, snapshot?.arrivals ?? 0)} / {goal.arrivals}
            </b>
          </div>
          <div className="progressrail">
            <div
              style={{
                width: Math.min(100, ((snapshot?.arrivals ?? 0) / goal.arrivals) * 100) + "%",
              }}
            />
          </div>
          <div className="goalrow">
            <span>Attraktionen eröffnen</span>
            <b>
              {Math.min(goal.rides, readyRides)} / {goal.rides}
            </b>
          </div>
          <div className="progressrail">
            <div style={{ width: Math.min(100, (readyRides / goal.rides) * 100) + "%" }} />
          </div>
          <div className="goalrow">
            <span>Zufriedenheit</span>
            <b>
              {snapshot?.rating ?? 80} / {goal.rating} %
            </b>
          </div>
          {goal.value > 0 && (
            <div className="goalrow">
              <span>Parkwert</span>
              <b>
                {EUR(snapshot ? parkValue(snapshot) : 0)} / {EUR(goal.value)}
              </b>
            </div>
          )}
          {goal.profit > 0 && (
            <div className="goalrow">
              <span>Betriebsgewinn / Tag</span>
              <b>
                {EUR(snapshot?.operatingProfit ?? 0)} / {EUR(goal.profit)}
              </b>
            </div>
          )}
          {goal.coasters > 0 && (
            <div className="goalrow">
              <span>Achterbahnen geöffnet</span>
              <b>
                {snapshot?.buildings.filter(
                  (b) => b.kind === "coaster" && b.open && b.tested && access(snapshot, b),
                ).length ?? 0}{" "}
                / {goal.coasters}
              </b>
            </div>
          )}
          <button
            className="secondary research-link"
            onClick={() => {
              setTab("research");
              setSettings(true);
            }}
          >
            <FlaskConical size={16} />{" "}
            {snapshot?.research?.active
              ? `Forschung · ${Math.ceil(snapshot.research.remaining)} s`
              : "Forschung & Freischaltungen"}
          </button>
          <div className="reward">
            <Trophy />{" "}
            {snapshot?.won
              ? "Ziel erreicht – baue weiter!"
              : "Erreiche alle Ziele und entdecke weitere Szenarien."}
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
        {tool !== "select" && !(tool === "coaster" && !blueprintMode) && (
          <div className={`build-status ${placement?.error ? "invalid" : ""}`} aria-live="polite">
            <div>
              <strong>
                {placement?.error ??
                  (adjust
                    ? `${adjust.mode === "station" ? "Station versetzen" : "Position anpassen"} · ${EUR(placement?.cost ?? 0)}`
                    : placement
                      ? `${tool === "erase" ? "Abreißen" : tool === "coaster" ? COASTER_TYPES[coasterType].name : (CATALOG[tool as Kind]?.name ?? (tool === "path" ? "Parkweg" : tool === "queue" ? "Warteschlange" : "Wasser"))} · ${EUR(placement.cost)}`
                      : "Bewege den Zeiger auf den Bauplatz")}
              </strong>
              <span>
                {placement?.warning ??
                  (adjust
                    ? adjust.mode === "station"
                      ? "Grünes Gleisfeld wählen · Klick übernimmt · Esc beendet"
                      : "Klick übernimmt · R dreht · Esc beendet"
                    : tool === "coaster" && blueprintMode
                      ? "Klick baut · R dreht · Esc beendet"
                      : ["path", "queue", "water", "erase"].includes(tool)
                        ? "Ziehen baut mehrere Felder · Strg/⌘ Z nimmt den Bauzug zurück"
                        : tool === "coaster"
                          ? "Bauteil im Baufenster wählen · Klick ergänzt · Esc beendet"
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
              Fahrgeschäfte mit „Anschließen & öffnen“ automatisch mit dem Wegenetz. Ein direkt
              angrenzender Parkweg bietet vier Warteplätze.
            </li>
            <li>
              <b>Eröffnen:</b> Nach dem Bauen öffnet sich die Verwaltung direkt. Du kannst den
              Anschluss dort mit einem Klick bauen. Der Park verdient am Eintritt und an echten
              Besuchen.
            </li>
            <li>
              <b>Achterbahn:</b> Im Schnellbau setzt du einen vollständigen Rundkurs; R dreht ihn.
              Für eine eigene Strecke setze eine Station. Baue mit den Pfeilen oder benachbarten
              Geraden, Steigungen, Kurven und Loopings. „Automatisch zur Station“ sucht einen
              passenden Rückweg. Danach bauen, testen und anschließen. Wähle eine fertige Bahn und
              „3D-Mitfahren“ für eine Probefahrt; Sound und Musik stellst du in der Parkverwaltung
              ein.
            </li>
            <li>
              <b>Nachträglich anpassen:</b> Klicke eine Bahn an. „Station versetzen“ bietet grüne,
              ebene Gleisfelder; „Bahn verschieben / drehen“ versetzt die gesamte Anlage. R dreht
              die Vorschau, Strg/⌘ Z nimmt den Umbau zurück.
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
      <Dialog
        open={!!ride}
        onOpenChange={(open) => {
          if (!open) {
            rideActive.current = false;
            setRide(null);
            audio.current?.ride(0, false);
          }
        }}
      >
        <DialogContent className="ride-modal" showCloseButton={false}>
          <DialogTitle className="sr-only">3D-Mitfahrt</DialogTitle>
          <DialogDescription className="sr-only">
            Probefahrt auf deiner gebauten Achterbahn. Der Park pausiert.
          </DialogDescription>
          {ride && (
            <Suspense
              fallback={<div className="ride-loading">Deine 3D-Strecke wird aufgebaut …</div>}
            >
              <RideView
                {...ride}
                audio={audio.current}
                muted={!audioSettings.enabled}
                onMute={toggleSound}
                onClose={() => {
                  rideActive.current = false;
                  setRide(null);
                  audio.current?.ride(0, false);
                }}
              />
            </Suspense>
          )}
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
              <TabsTrigger value="audio">Sound</TabsTrigger>
              <TabsTrigger value="research">Forschung</TabsTrigger>
            </TabsList>
            <TabsContent value="research">
              <p className="small">
                Forschung wird einmal bezahlt und läuft mit der Spielzeit. Im freien Spiel ist alles
                verfügbar.
              </p>
              {(Object.keys(RESEARCH) as ResearchId[]).map((id) => {
                const project = RESEARCH[id],
                  done = snapshot?.mode === "sandbox" || snapshot?.research?.completed.includes(id),
                  active = snapshot?.research?.active === id;
                return (
                  <div className="research-card" key={id}>
                    <div>
                      <h3>{project.name}</h3>
                      <p>{project.description}</p>
                      <small>
                        {EUR(project.cost)} · {project.duration / 90 < 2 ? "1–2" : "2"} Spieltage
                        {project.requires ? " · benötigt Hoch hinaus" : ""}
                      </small>
                    </div>
                    <button
                      className={done ? "secondary" : "primary"}
                      disabled={
                        done ||
                        !!snapshot?.research?.active ||
                        (!!project.requires &&
                          !snapshot?.research?.completed.includes(project.requires)) ||
                        (snapshot?.cash ?? 0) < project.cost
                      }
                      onClick={() => {
                        const error = startResearch(park.current!, id);
                        notify(error ?? `${project.name}: Forschung gestartet.`);
                        sync();
                      }}
                    >
                      {done
                        ? "Freigeschaltet"
                        : active
                          ? `${Math.ceil(snapshot!.research!.remaining)} s verbleiben`
                          : "Erforschen"}
                    </button>
                    {active && (
                      <progress
                        max={project.duration}
                        value={project.duration - (snapshot?.research?.remaining ?? 0)}
                      />
                    )}
                  </div>
                );
              })}
            </TabsContent>
            <TabsContent value="audio">
              <button className="primary" onClick={toggleSound}>
                {audioSettings.enabled ? <Volume2 /> : <VolumeX />}{" "}
                {audioSettings.enabled ? "Sound ausschalten" : "Sound einschalten"}
              </button>
              <p className="small">
                Abwechslungsreiche Parkmusik, Bau- und Kassentöne, Kettenlift, Rollgeräusche,
                Launch, Bremsen und Fahrtwind. Die Musik läuft unabhängig vom Spieltempo.
              </p>
              {(["master", "music", "effects"] as const).map((key) => (
                <div key={key}>
                  <div className="controlrow">
                    <span>
                      {key === "master"
                        ? "Gesamtlautstärke"
                        : key === "music"
                          ? "Parkmusik"
                          : "Effekte & Fahrtwind"}
                    </span>
                    <strong>{Math.round(audioSettings[key] * 100)} %</strong>
                  </div>
                  <Slider
                    aria-label={
                      key === "master"
                        ? "Gesamtlautstärke"
                        : key === "music"
                          ? "Parkmusik"
                          : "Effekte"
                    }
                    min={0}
                    max={100}
                    step={1}
                    value={[audioSettings[key] * 100]}
                    onValueChange={(v) =>
                      setSound({
                        ...audioPreferences.current,
                        [key]: (Array.isArray(v) ? v[0] : v) / 100,
                      })
                    }
                  />
                </div>
              ))}
            </TabsContent>
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
                80 € pro Mitarbeiter und Tag. Ein Mitarbeiter betreut bis zu 25 Gäste.
                Unterbesetzung drückt die Stimmung.
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
                  <span>Parkwert</span>
                  <strong>{EUR(snapshot ? parkValue(snapshot) : 0)}</strong>
                </div>
              </div>
              <p className="small">
                Aktueller Eintritt: etwa {Math.round((snapshot ? entryDemand(snapshot) : 0) * 100)}{" "}
                % der Interessenten kommen. Betriebsgewinn letzter Tag:{" "}
                {EUR(snapshot?.operatingProfit ?? 0)}.
              </p>
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
                      park.current = migratePark(s);
                      restoreDraft(s);
                      setAdjust(null);
                      history.current = [];
                      stroke.current = null;
                      setUndoCount(0);
                      sync();
                      setSettings(false);
                      setSelected(null);
                      setCategory("rides");
                      setTool("select");
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
            {[...Object.keys(SCENARIOS), "sandbox"].map((id) => {
              const scenario = id === "sandbox" ? null : SCENARIOS[id as ScenarioId];
              return (
                <button
                  className="scenario-card secondary"
                  key={id}
                  onClick={() => {
                    park.current = newPark(
                      id === "sandbox" ? "sandbox" : "scenario",
                      id === "sandbox" ? "waldhain" : (id as ScenarioId),
                    );
                    setAdjust(null);
                    history.current = [];
                    stroke.current = null;
                    draftHistory.current = [];
                    setUndoCount(0);
                    setWorldRevision((v) => v + 1);
                    setNewDialog(false);
                    setSelected(null);
                    setCategory("rides");
                    setTool("select");
                    setDraft([]);
                    setCoasterType("steel");
                    announced.current = false;
                    sync();
                    notify(`Willkommen in ${scenario?.name ?? "deinem freien Park"}.`);
                  }}
                >
                  <strong>
                    {scenario?.name ?? "Freies Spiel"} · {EUR(scenario?.cash ?? 100000)}
                  </strong>
                  <span>
                    {scenario?.description ??
                      "Alle Bahntypen und Attraktionen sind sofort freigeschaltet."}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
