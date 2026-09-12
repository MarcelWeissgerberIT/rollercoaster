import { customScenarioExpired, customScenarioTimeLeft } from "../game/custom-scenario";
import { MaintenancePanel, RideRetailPanel } from "../components/maintenance-panel";
import { CoasterTrainPanel } from "../components/coaster-train-panel";
import { setCoasterTrainProgram } from "../game/coaster-trains";
import TerrainPanel, {
  defaultTerrainSettings,
  type TerrainSettings,
} from "../components/terrain-panel";
import {
  terrainHeight,
  editTerrain,
  terrainPlan,
  deckPlan,
  placeDeck,
  removeDeck,
  type ElevatedPath,
} from "../game/terrain";
import { pickTerrain } from "../game/terrain-render";
import SceneryEditor from "../components/scenery-editor";
import ScenarioEditor from "../components/scenario-editor";
import {
  placeScenery,
  rotateScenery,
  removeScenery,
  type SceneryDraft,
} from "../game/modular-scenery";
import { AttractionAdvisor } from "../components/attraction-advisor";
import { attractionAdvice, applyAttractionAdvice } from "../game/attraction-advisor";
import { SharedAccessControl } from "../components/shared-access-control";
import { setSharedAccess, sharedAccessRoute } from "../game/shared-access";
import { SaveSlots } from "../components/save-slots";
import { ParkCalendar, ParkWeather } from "../components/park-weather";
import { calendarOf, DAY_SECONDS, DAYS_PER_YEAR } from "../game/calendar";
import { supportsBuildingRotation } from "@/game/building-orientation";
import { assignCleanerArea, cleanerAreaInfo, type CleanerArea } from "@/game/cleanliness";
import { AttractionDirectory } from "@/components/attraction-directory";
import { clampZoom, focusBuildingCamera, zoomCameraAt, rotateCameraAt } from "@/game/camera";
import { createFreePark } from "@/game/free-play";
import { hasUnlimitedBudget, canAfford, spendCash } from "@/game/budget";
import { saveParkSwitch, readPreviousPark, PARK_SAVE_KEY } from "@/game/park-storage";
import type { HabitatFeatureId } from "../game/habitat-needs";
import {
  planStationReverse,
  commitStationReverse,
  stationOrientation,
} from "../game/station-direction";
import { suggestExit, applyExitSuggestion, exitHelpAt } from "../game/exit-assist";
import { closestPhotoPoint } from "../game/coaster-photo";
import { makeRidePath } from "../game/ride-path";
import { GATES, gateStyle, changeGate, type GateStyle } from "../game/entrance";
import { ResearchTree } from "../components/research-tree";
import { FinancePanel } from "../components/finance-panel";
import { borrowLoan, repayLoan } from "../game/loans";
import { StaffPanel } from "../components/staff-panel";
import { staffLocation, type StaffRef } from "../game/staff";
import { RideOperationsPanel } from "../components/ride-operations-panel";
import {
  setRideRounds,
  needsOperator,
  hasOperator,
  hireRideCrew,
  dismissRideCrew,
  assignRideCrew,
  setCrewAutomatic,
  setRideStaffingMode,
} from "../game/operations";
import { PATH_STYLES, pathStyleAt, isAmenity, type PathStyle } from "../game/park-life";
import { habitatViewingSpots } from "../game/zoo-access";
("use client");
import { ZooOverview, HabitatPanel } from "../components/zoo-panel";
import {
  isHabitat,
  initZoo,
  zooStats,
  adoptAnimal,
  careHabitat,
  upgradeHabitat,
  addHabitatFeature,
  setZooSpecialists,
  assignZooKeeperToHabitat,
  setHabitatElectric,
  inspectHabitat,
  habitatSafety,
} from "../game/zoo";
import {
  condition,
  broken,
  repairCost,
  repairAttraction,
  maintenanceScore,
} from "../game/maintenance";
import { cleanlinessScore } from "../game/cleanliness";
import { PawPrint } from "lucide-react";
import MarketingPanel from "../components/marketing-panel";
import { startMarketing, cancelMarketing } from "../game/marketing";
import { initCleanliness } from "../game/cleanliness";
import ParkAnalysis from "../components/park-analysis";
import ParkTrafficPanel from "../components/park-traffic-panel";
import TrafficMapLegend from "../components/traffic-map-legend";
import HabitatVisitorPanel from "../components/habitat-visitor-panel";
import {
  habitatViewpointCandidates,
  setHabitatViewpoint,
  clearHabitatViewpoint,
  viewpointStatus,
} from "../game/habitat-viewpoint";
import { parkTraffic, trafficAt, type TrafficMode, type TrafficZone } from "../game/park-traffic";
import { parkInsights, type ParkIssue } from "../game/park-insights";
import RideProfileAssistant from "../components/ride-profile-assistant";
import { commitRideProfile, type RideProfilePlan } from "../game/ride-profiles";
import { invertingPiece } from "../game/track-parts";
import VehicleCustomizer, { CarPreview } from "../components/vehicle-customizer";
import { vehicleFor } from "../game/vehicles";
/* oxlint-disable next/no-img-element, react/react-compiler -- Native transparent sprite images and a mutable external simulation are intentional. */
import ParkMenu, { parkMenuGroup } from "@/components/park-menu";
import {
  podPort,
  podSlots,
  samePod,
  usesPods,
  POD_SIDES,
  type Pod,
  type PodRole,
} from "@/game/pods";
import { TrackPieceCatalog, TrackRangeMap } from "@/components/track-pieces";
import { draftHistoryData, restoreDraftHistory } from "@/game/draft";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Layers,
  Eye,
  Infinity as InfinityIcon,
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
  WandSparkles,
  TrendingUp,
  Megaphone,
  Check,
  Undo2,
  FlaskConical,
  Settings2,
  Flag,
  Info,
  Move,
  RotateCw,
  RotateCcw,
  MapPin,
  Zap,
  OctagonPause,
  LogIn,
  LogOut,
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
  effectivePods,
  ensurePods,
  accessNeighbors,
  exitPath,
  exitNetwork,
  queueCapacity,
  occupant,
  footprint,
  trackStats,
  isRide,
  isAttraction,
  decorative,
  validSave,
  type Park,
  type Kind,
  type Point,
  type Building,
} from "@/game/simulation";
import {
  hitBuildingAt,
  hitAccessPodAt,
  draw,
  loadSprites,
  projection,
  type View,
} from "@/game/render";
import {
  planPlacement,
  place,
  planPod,
  setAccessPod,
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
  suggestPieces,
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
import {
  trackDrivePlan,
  installTrackDrive,
  editableTrack,
  trackSections,
  selectionGroups,
  batchTrackRemovalPlan,
  removeTrackSections,
  type BatchRemovalPlan,
  driveSections,
  trackDriveGroups,
  pickTrackSection,
  beginTrackEdit,
  cancelTrackEdit,
  trackEditWorld,
  trackEditPlan,
  commitTrackEdit,
  trackEditRange,
  resizeTrackEdit,
  fittingTrackCut,
} from "@/game/track-edit";
import TrackFitAssistant, { type FitAssistantHandle } from "@/components/track-fit-assistant";
import { commitTrackFit, type TrackFit } from "@/game/track-fit";
import type { TrackDrive } from "@/game/drive";
import {
  DIFFICULTIES,
  difficultyOf,
  setDifficulty,
  difficultyCost,
  difficultyEuro,
  type Difficulty,
} from "../game/difficulty";
import { VisitorPanel, VisitorAudiencePanel } from "../components/visitor-panel";
import { assetUrl } from "@/game/assets";
import { insideMap, mapWidth, mapHeight, expansionPlan, expandPark } from "@/game/grid";
import {
  isTransport,
  transitPlan,
  createTransitLine,
  repairTransitPlan,
  repairTransit,
  tickTransit,
  transportCapacity,
} from "@/game/transit";
import { designStats, type AttractionDesign } from "@/game/designs";
const RideView = lazy(() => import("@/components/ride-view"));
const BuildView = lazy(() => import("@/components/build-view"));
const Workshop = lazy(() => import("@/components/workshop"));
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
  { id: "zoo", label: "Zoo & Tiere", Icon: PawPrint },
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
  const [showMoods, setShowMoods] = useState(true);
  const [menuOpen, setMenuOpen] = useState(true);
  const [showGoals, setShowGoals] = useState(false);
  const [category, setCategory] = useState("");
  const [tool, setTool] = useState("select");
  const [trafficMode, setTrafficMode] = useState<TrafficMode | null>(null);
  const [trafficPoint, setTrafficPoint] = useState<Point | null>(null);
  const traffic = useMemo(
    () => (snapshot && (category === "analysis" || trafficMode) ? parkTraffic(snapshot) : null),
    [snapshot, category, trafficMode],
  );
  const selectedTraffic =
    traffic && trafficPoint ? (trafficAt(traffic, trafficPoint) ?? null) : null;
  const workshopReturn = useRef(false);
  const [workshop, setWorkshop] = useState(false);
  const [customDesign, setCustomDesign] = useState<AttractionDesign | undefined>();
  const [buildWorld, setBuildWorld] = useState<Park | null>(null);
  const [autoFocus, setAutoFocus] = useState(true);
  const cameraTarget = useRef<{ panX: number; panY: number; zoom: number } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [areaEditor, setAreaEditor] = useState<{
    workerId: number;
    from: Point | null;
    to: Point | null;
    ready: boolean;
  } | null>(null);
  const areaPointer = useRef<Point | null>(null);
  const [ridesView, setRidesView] = useState<"catalog" | "park">("catalog");
  const [focusRequest, setFocusRequest] = useState<{ id: number; serial: number } | null>(null);
  useEffect(() => {
    panelRef.current?.scrollTo(0, 0);
    panelRef.current?.querySelector(".panelbody")?.scrollTo(0, 0);
  }, [category, selected]);
  const [help, setHelp] = useState(false);
  const [settings, setSettings] = useState(false);
  const [newDialog, setNewDialog] = useState(false);
  const [previousPark, setPreviousPark] = useState<Park | null>(null);
  const [message, setMessage] = useState(
    "Willkommen im Waldhain. Dein erster Park wartet auf neue Ideen.",
  );
  const [coasterType, setCoasterType] = useState<CoasterType>("steel");
  const [sectionMode, setSectionMode] = useState<"remove" | "drive" | "profile">("remove");
  const [drive, setDrive] = useState<TrackDrive>({ kind: "boost", speed: 60, strength: 4 });
  const [cut, setCut] = useState<{
    id: number;
    from: number;
    to: number;
    marked?: number[];
    anchor?: number;
  } | null>(null);
  useEffect(() => {
    panelRef.current?.scrollTo(0, 0);
    panelRef.current?.querySelector(".panelbody")?.scrollTo(0, 0);
  }, [!!cut]);
  const [batchPreview, setBatchPreview] = useState<{ key: string; plan: BatchRemovalPlan } | null>(
    null,
  );
  useEffect(() => {
    if (cut && (cut.id !== selected || tool !== "select" || category !== "detail")) {
      setCut(null);
      setBatchPreview(null);
    }
  }, [cut?.id, selected, tool, category]);
  const [profilePreview, setProfilePreview] = useState<RideProfilePlan | null>(null);
  const [fitPreview, setFitPreview] = useState<TrackFit | null>(null);
  const fitAssistant = useRef<FitAssistantHandle>(null);
  useEffect(() => {
    view.current.fitPreview = fitPreview ?? profilePreview ?? undefined;
    if (!fitPreview) return;
    setMenuOpen(false);
    setMessage("");
    const el = canvas.current;
    if (!el || !autoFocus) return;
    const points = [...fitPreview.removed, ...fitPreview.added],
      v = { ...view.current, zoom: Math.max(1.45, Math.min(1.9, view.current.zoom)) },
      project = projection(el.clientWidth, el.clientHeight, v).project;
    const screen = points.map((p) => project(p.x, p.y, p.z));
    const x = (Math.min(...screen.map((p) => p.x)) + Math.max(...screen.map((p) => p.x))) / 2,
      y = (Math.min(...screen.map((p) => p.y)) + Math.max(...screen.map((p) => p.y))) / 2;
    cameraTarget.current = {
      zoom: v.zoom,
      panX: v.panX + (Math.min(340, el.clientWidth * 0.35) + el.clientWidth) / 2 - x,
      panY: v.panY + el.clientHeight * 0.48 - y,
    };
  }, [fitPreview, profilePreview]);
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
            ...draftHistoryData(draftHistory.current, next.length),
            style: next[0]?.style ?? coasterType,
            piece,
            rotation,
          }
        : undefined;
  };
  const restoreDraft = (s: Park) => {
    const d = s.draft;
    writeDraft(d?.track ?? []);
    draftHistory.current = d ? restoreDraftHistory(d) : [];
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
    rotateOnly?: boolean;
  } | null>(null);
  const [podEdit, setPodEdit] = useState<{ id: number; role: PodRole } | null>(null);
  useEffect(() => {
    if (podEdit)
      panelRef.current?.querySelector(".pod-position-picker")?.scrollIntoView({ block: "nearest" });
  }, [podEdit?.id, podEdit?.role]);
  const [hoverInfo, setHoverInfo] = useState<{
    id: number | null;
    tile?: Point;
    pod?: PodRole;
    x: number;
    y: number;
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
  const [saveSlotsOpen, setSaveSlotsOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [cameraAngle, setCameraAngle] = useState(0);
  const [advisorSection, setAdvisorSection] = useState<{ selector: string; serial: number } | null>(
    null,
  );
  const [marketingTarget, setMarketingTarget] = useState<number | undefined>();
  useEffect(() => {
    if (!advisorSection) return;
    const frame = requestAnimationFrame(() => {
      const element = panelRef.current?.querySelector<HTMLElement>(advisorSection.selector);
      element?.scrollIntoView({ block: "start", behavior: "smooth" });
      element?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [advisorSection]);
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
  const areaRectangle = (from: Point, to: Point): CleanerArea => ({
    x1: Math.min(from.x, to.x),
    y1: Math.min(from.y, to.y),
    x2: Math.max(from.x, to.x),
    y2: Math.max(from.y, to.y),
  });
  const draftArea =
    areaEditor?.from && areaEditor.to ? areaRectangle(areaEditor.from, areaEditor.to) : null;
  const areaWorker = snapshot?.cleanliness?.workers.find(
    (worker) => worker.id === areaEditor?.workerId,
  );
  const areaStatus =
    snapshot && areaWorker && draftArea
      ? cleanerAreaInfo(snapshot, { ...areaWorker, area: draftArea })
      : null;
  const areaName =
    snapshot && areaWorker
      ? (staffLocation(snapshot, { kind: "cleaner", id: areaWorker.id })?.name ??
        `Reinigungskraft #${areaWorker.id}`)
      : "Reinigung";
  const leaveAreaEditor = () => {
    setAreaEditor(null);
    areaPointer.current = null;
    setTab("personal");
    setSettings(true);
  };
  const beginCleanerArea = (id: number) => {
    const worker = park.current?.cleanliness?.workers.find((item) => item.id === id);
    if (!worker) return;
    const a = worker.area;
    setAreaEditor({
      workerId: id,
      from: a ? { x: a.x1, y: a.y1 } : null,
      to: a ? { x: a.x2, y: a.y2 } : null,
      ready: !!a,
    });
    areaPointer.current = null;
    cameraTarget.current = null;
    setSettings(false);
    setMenuOpen(false);
    setShowGoals(false);
    setCategory("");
    setSelected(null);
    setTool("select");
    setTrafficMode(null);
    setAdjust(null);
    setPodEdit(null);
    setCut(null);
    notify(
      "Ziehe einen Bereich auf der Karte oder klicke seine zwei Ecken. Erst „Bereich zuweisen“ übernimmt die Auswahl.",
    );
  };
  const clearCleanerArea = (id: number) => {
    if (!park.current) return;
    const error = assignCleanerArea(park.current, id, null);
    sync();
    notify(error ?? "Reinigungskraft wieder automatisch verteilt.");
  };
  useEffect(() => {
    if (!areaEditor || !snapshot) {
      view.current.cleanerAreas = undefined;
      return;
    }
    view.current.cleanerAreas = (snapshot.cleanliness?.workers ?? []).flatMap((worker) => {
      const active = worker.id === areaEditor.workerId,
        a = active && draftArea ? draftArea : worker.area;
      return a
        ? [
            {
              id: worker.id,
              area: a,
              name:
                staffLocation(snapshot, { kind: "cleaner", id: worker.id })?.name ??
                `Team ${worker.id}`,
              selected: active,
              preview: active,
            },
          ]
        : [];
    });
  }, [areaEditor, snapshot]);
  useEffect(() => {
    if (
      areaEditor &&
      (menuOpen ||
        settings ||
        !snapshot?.cleanliness?.workers.some((worker) => worker.id === areaEditor.workerId))
    ) {
      setAreaEditor(null);
      areaPointer.current = null;
    }
  }, [menuOpen, settings, areaEditor, snapshot]);
  const selectAttraction = (id: number) => {
    if (!park.current?.buildings.some((item) => item.id === id)) return;
    setAreaEditor(null);
    setSelected(id);
    setCategory("detail");
    setTool("select");
    setMenuOpen(false);
    setSettings(false);
    setTrafficMode(null);
    setAdjust(null);
    setPodEdit(null);
    setCut(null);
  };
  const focusAttraction = (id: number) => {
    selectAttraction(id);
    setFocusRequest((previous) => ({ id, serial: (previous?.serial ?? 0) + 1 }));
  };
  useEffect(() => {
    if (!focusRequest || !park.current || !canvas.current) return;
    const building = park.current.buildings.find((item) => item.id === focusRequest.id);
    if (!building) return;
    const el = canvas.current,
      rect = el.getBoundingClientRect();
    const usable = { left: 22, top: 78, right: rect.width - 22, bottom: rect.height - 108 };
    const panel = panelRef.current?.getBoundingClientRect();
    if (panel && panel.width && panel.height)
      usable.left = Math.max(usable.left, panel.right - rect.left + 22);
    const objective = el.parentElement?.querySelector<HTMLElement>(".objective");
    if (objective?.getClientRects().length) {
      const goalRect = objective.getBoundingClientRect();
      if (goalRect.left > rect.left + rect.width / 2)
        usable.right = Math.min(usable.right, goalRect.left - rect.left - 22);
    }
    if (usable.right - usable.left < 160) usable.right = rect.width - 16;
    if (usable.bottom - usable.top < 160) {
      usable.top = 16;
      usable.bottom = rect.height - 78;
    }
    const target = focusBuildingCamera(
      park.current,
      building,
      view.current,
      rect.width,
      rect.height,
      usable,
    );
    cameraTarget.current = target;
    setZoom(Math.round(target.zoom * 100));
    setHoverInfo(null);
    notify(`${building.name} im Blick. Mit + oder dem Mausrad kannst du noch näher heran.`);
  }, [focusRequest, notify]);
  const focusMapPoint = (point: Point) => {
    const el = canvas.current;
    if (!el) return;
    const v = view.current;
    const p = projection(el.clientWidth, el.clientHeight, v).project(point.x, point.y);
    cameraTarget.current = {
      zoom: v.zoom,
      panX: v.panX + el.clientWidth * 0.6 - p.x,
      panY: v.panY + el.clientHeight * 0.48 - p.y,
    };
  };
  const locateStaff = (ref: StaffRef) => {
    const s = park.current,
      el = canvas.current;
    if (!s || !el) return;
    const person = staffLocation(s, ref);
    if (!person) {
      notify("Diese Person ist nicht mehr im Park eingesetzt.");
      sync();
      return;
    }
    setSettings(false);
    setMenuOpen(false);
    setCategory("");
    setSelected(null);
    setTool("select");
    setTrafficMode(null);
    const v = view.current,
      targetZoom = Math.max(v.zoom, 1.6),
      p = projection(el.clientWidth, el.clientHeight, { ...v, zoom: targetZoom }).project(
        person.x,
        person.y,
      );
    cameraTarget.current = {
      zoom: targetZoom,
      panX: v.panX + el.clientWidth * 0.5 - p.x,
      panY: v.panY + el.clientHeight * 0.49 - p.y,
    };
    view.current.staffFocus = { ref, until: performance.now() + 12000 };
    setZoom(Math.round(targetZoom * 100));
    notify(`${person.name} · ${person.label}`);
  };
  const inspectTrafficZone = (zone: TrafficZone, focus = true) => {
    setTrafficPoint(zone.point);
    setCategory("analysis");
    setMenuOpen(false);
    setSelected(null);
    if (focus) focusMapPoint(zone.point);
  };
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
      const previous = draftHistory.current.pop();
      if (previous) setDraft(previous);
      else if (park.current?.trackEdit) {
        const id = park.current.trackEdit.buildingId;
        cancelTrackEdit(park.current);
        setDraft([]);
        setBuildWorld(null);
        setTool("select");
        setCategory("detail");
        setSelected(id);
        setWorldRevision((v) => v + 1);
        sync();
        notify("Entfernen rückgängig gemacht. Die ursprüngliche Bahn ist wiederhergestellt.");
      } else setDraft([]);
      return;
    }
    finishStroke();
    const records = history.current.pop();
    if (!records || !park.current) return;
    const error = undoEdits(park.current, records);
    if (error) {
      history.current.push(records);
      notify(error);
      return;
    }
    restoreDraft(park.current);
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
    () =>
      snapshot && candidate.length
        ? pieceError(
            trackEditWorld(snapshot),
            draft,
            candidate,
            autoClear,
            snapshot.trackEdit?.suffix,
          )
        : null,
    [worldRevision, draft, candidate, autoClear],
  );
  const conflictOptions = useMemo(
    () =>
      snapshot && candidateError && !isClosedTrack(draft)
        ? suggestPieces(
            trackEditWorld(snapshot),
            draft,
            piece,
            autoClear,
            snapshot.trackEdit?.suffix,
          )
        : [],
    [worldRevision, candidateError, draft, piece, autoClear],
  );
  useEffect(() => {
    if (tool !== "coaster") setBuildWorld(null);
  }, [tool]);
  const draftPlan = useMemo(
    () =>
      snapshot && draft.length > 1
        ? snapshot.trackEdit
          ? trackEditPlan(snapshot, draft, autoClear)
          : planPlacement(snapshot, "coaster", draft[0], draft, autoClear)
        : null,
    [worldRevision, draft, autoClear, snapshot?.cash],
  );
  const editRange = useMemo(
    () => (snapshot?.trackEdit ? trackEditRange(snapshot) : null),
    [snapshot?.trackEdit, worldRevision],
  );
  const fittingCut = useMemo(
    () =>
      snapshot?.trackEdit && candidateError && draft.length === snapshot.trackEdit.prefix.length
        ? fittingTrackCut(snapshot, piece, autoClear)
        : null,
    [snapshot?.trackEdit, candidateError, draft, piece, autoClear, worldRevision],
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
  const [pathStyle, setPathStyle] = useState<PathStyle>("garden");
  const [terrainSettings, setTerrainSettings] = useState<TerrainSettings>(defaultTerrainSettings);
  const [sceneryDraft, setSceneryDraft] = useState<SceneryDraft>({
    part: "wall",
    theme: "woodland",
    x: 0,
    y: 0,
    z: 0,
    orientation: 0,
  });
  useEffect(() => {
    view.current.terrainSettings = terrainSettings;
  }, [terrainSettings]);

  const placement = useMemo(
    () =>
      adjustmentPlan ??
      (snapshot &&
      tool !== "select" &&
      tool !== "move" &&
      tool !== "station" &&
      tool !== "viewpoint" &&
      tool !== "terrain" &&
      tool !== "scenery" &&
      !tool.startsWith("pod-") &&
      hoverTile &&
      (tool !== "coaster" || blueprintMode)
        ? planPlacement(
            snapshot,
            tool as BuildTool,
            hoverTile,
            tool === "coaster" ? previewTrack : undefined,
            autoClear,
            tool === "custom" ? customDesign : undefined,
            tool === "path" ? pathStyle : undefined,
          )
        : null),
    [
      snapshot,
      tool,
      hoverTile,
      blueprintMode,
      previewTrack,
      autoClear,
      adjustmentPlan,
      customDesign,
      pathStyle,
    ],
  );
  const terrainFeedback =
    tool === "terrain" && snapshot && hoverTile
      ? terrainSettings.mode === "terrain"
        ? terrainPlan(
            snapshot,
            hoverTile,
            terrainSettings.action,
            terrainSettings.size,
            terrainSettings.level,
          )
        : deckPlan(snapshot, {
            x: hoverTile.x,
            y: hoverTile.y,
            z: terrainSettings.level,
            type: terrainSettings.type,
            style: pathStyle,
            ...(terrainSettings.ramp ? { slope: terrainSettings.direction } : {}),
          })
      : null;
  const [exitHelpPoint, setExitHelpPoint] = useState<Point | null>(null);
  useEffect(() => {
    if (tool !== "exit") setExitHelpPoint(null);
    else if (hoverTile) setExitHelpPoint(placement?.error ? hoverTile : null);
  }, [tool, hoverTile, placement?.error]);
  const exitHelp = useMemo(
    () =>
      snapshot && tool === "exit" && exitHelpPoint
        ? exitHelpAt(snapshot, exitHelpPoint, autoClear)
        : null,
    [tool, exitHelpPoint, worldRevision, autoClear, snapshot?.cash],
  );
  const save = useCallback(() => {
    setSaveSlotsOpen(true);
    setSettings(false);
    setMenuOpen(false);
  }, []);
  function switchPark(next: Park) {
    if (!park.current) return false;
    let storage: Storage;
    try {
      storage = localStorage;
    } catch {
      notify("Der Browserspeicher ist nicht verfügbar. Dein aktueller Park bleibt geöffnet.");
      return false;
    }
    const error = saveParkSwitch(storage, park.current, next);
    if (error) {
      notify(error);
      return false;
    }
    setPreviousPark(readPreviousPark(storage));
    park.current = next;
    setAdjust(null);
    setPodEdit(null);
    setHoverInfo(null);
    setHoverTile(null);
    setFocusRequest(null);
    setAreaEditor(null);
    areaPointer.current = null;
    setCut(null);
    setBatchPreview(null);
    setFitPreview(null);
    setProfilePreview(null);
    setRide(null);
    rideActive.current = false;
    audio.current?.ride(0, false);
    setWorkshop(false);
    workshopReturn.current = false;
    setBuildWorld(null);
    setTrafficMode(null);
    history.current = [];
    stroke.current = null;
    draftHistory.current = [];
    setUndoCount(0);
    setWorldRevision((v) => v + 1);
    setNewDialog(false);
    setSettings(false);
    setMenuOpen(false);
    setShowGoals(hasUnlimitedBudget(next));
    setSelected(null);
    setCategory("");
    setTool("select");
    setHeight(0);
    setRotation(0);
    setBlueprintMode(true);
    setCoasterType("steel");
    setPiece("straight");
    cameraTarget.current = null;
    const fitZoom = Math.min(1, 30 / next.tiles.length);
    view.current = { ...blankView, zoom: fitZoom, terrainSettings };
    setCameraAngle(0);
    setZoom(Math.round(fitZoom * 100));
    restoreDraft(next);
    announced.current = next.won;
    sync();
    setSaved("Gespeichert · vorheriger Park gesichert");
    notify(
      hasUnlimitedBudget(next)
        ? "Dein freier Park ist bereit. Baue los – alle Inhalte sind freigeschaltet."
        : `Willkommen in ${scenarioOf(next).name}.`,
    );
    return true;
  }
  useEffect(() => {
    let initial = newPark();
    try {
      const raw = localStorage.getItem(PARK_SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (validSave(data)) {
          initial = migratePark(data);
          setMessage("Willkommen zurück. Dein gespeicherter Park ist bereit.");
        }
      }
    } catch {}
    try {
      setPreviousPark(readPreviousPark(localStorage));
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
          localStorage.setItem(PARK_SAVE_KEY, JSON.stringify(park.current));
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
      cameraTarget.current = null;
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
          if (cameraTarget.current) {
            const goal = cameraTarget.current,
              v = view.current;
            v.panX += (goal.panX - v.panX) * 0.16;
            v.panY += (goal.panY - v.panY) * 0.16;
            v.zoom += (goal.zoom - v.zoom) * 0.16;
            if (
              Math.abs(goal.panX - v.panX) + Math.abs(goal.panY - v.panY) < 0.5 &&
              Math.abs(goal.zoom - v.zoom) < 0.005
            ) {
              Object.assign(v, goal);
              cameraTarget.current = null;
            }
          }
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
    view.current.showMoods = showMoods;
    view.current.issues =
      category === "analysis" && snapshot && !trafficMode
        ? parkInsights(snapshot).issues
        : undefined;
    view.current.traffic =
      trafficMode && traffic
        ? { report: traffic, mode: trafficMode, selected: selectedTraffic?.id ?? null }
        : undefined;
  }, [showMoods, category, snapshot, trafficMode, traffic, selectedTraffic?.id]);
  useEffect(() => {
    if (tool !== "select") setTrafficMode(null);
    const habitat = snapshot?.buildings.find((item) => item.id === selected);
    view.current.viewpointEdit =
      tool === "viewpoint" && snapshot && habitat
        ? habitatViewpointCandidates(snapshot, habitat)
        : undefined;
  }, [tool, selected, snapshot]);
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
      setAreaEditor(null);
      areaPointer.current = null;
      setTool(t);
      setCut(null);
      setBatchPreview(null);
      setPodEdit(null);
      setSelected(null);
      setCategory((current) => cat ?? (current === "detail" ? "" : current));

      notify(
        t === "select"
          ? "Klicke eine Attraktion an, um ihren Betrieb zu verwalten."
          : t === "erase"
            ? "Klicke auf ein Gebäude oder einen Weg. Gebäude erstatten 40 % des Grundpreises."
            : t === "coaster"
              ? "Wähle einen Bahntyp. Unter Fertigteile findest du Looping, Kurven, Hügel und Steigungen."
              : t === "queue"
                ? "Blau = Eingang. Verbinde das Feld vor dem blauen Eingangspod mit einem Parkweg."
                : t === "exit"
                  ? "Rot = Ausgang. Ziehe vom Feld vor dem roten Ausgangspod bis zum beigen Parkweg. Pfeile zeigen die Laufrichtung."
                  : t === "path"
                    ? "Klicke oder ziehe, um deinen Park mit Wegen zu verbinden."
                    : CATALOG[t as Kind]
                      ? `${CATALOG[t as Kind].name}: Wähle einen freien Platz im Park.`
                      : t === "terrain"
                        ? "Forme freie Wiese oder verbinde Wege mit Rampen und Brücken."
                        : t === "scenery"
                          ? "Wähle ein Themenbauteil und setze es auf die Karte."
                          : "Wähle ein Bauwerk.",
      );
    },
    [notify],
  );
  const changeZoom = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const el = canvas.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    cameraTarget.current = null;
    const point = {
      x: clientX === undefined ? rect.width / 2 : clientX - rect.left,
      y: clientY === undefined ? rect.height / 2 : clientY - rect.top,
    };
    Object.assign(
      view.current,
      zoomCameraAt(
        view.current,
        rect.width,
        rect.height,
        clampZoom(view.current.zoom * factor),
        point,
      ),
    );
    setZoom(Math.round(view.current.zoom * 100));
  }, []);
  const rotateCamera = useCallback(
    (step: number) => {
      const el = canvas.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      cameraTarget.current = null;
      drag.current = null;
      finishStroke();
      Object.assign(view.current, rotateCameraAt(view.current, rect.width, rect.height, step));
      view.current.hover = null;
      view.current.hitTargets = [];
      setHoverInfo(null);
      setHoverTile(null);
      setCameraAngle((view.current.cameraTurn ?? 0) * 90);
    },
    [finishStroke],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input,select,textarea,[role="slider"],[role="dialog"],[contenteditable]'))
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
        if (areaEditor) {
          setAreaEditor(null);
          areaPointer.current = null;
          setTab("personal");
          setSettings(true);
          return;
        }
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
        adjustingBuilding &&
        supportsBuildingRotation(adjustingBuilding.kind)
      ) {
        e.preventDefault();
        setAdjust((a) => (a ? { ...a, rotation: (a.rotation + 1) % 4 } : a));
      }
      if (e.key.toLowerCase() === "r" && tool === "coaster" && blueprintMode) {
        e.preventDefault();
        setRotation((r) => (r + 1) % 4);
      }
      if (e.key.toLowerCase() === "f" && tool === "coaster" && !buildWorld) focus2D(draft);
      if (
        !buildWorld &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        ["q", "e"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        rotateCamera(e.key.toLowerCase() === "q" ? -1 : 1);
      }
      if (e.key === "+" || e.key === "=") changeZoom(1.15);
      if (e.key === "-") changeZoom(1 / 1.15);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    save,
    sync,
    pickTool,
    changeZoom,
    rotateCamera,
    undo,
    tool,
    blueprintMode,
    adjust,
    adjustingBuilding,
    draft,
    piece,
    buildWorld,
    areaEditor,
  ]);

  const tileAt = (e: { clientX: number; clientY: number }) => {
    const el = canvas.current!;
    const r = el.getBoundingClientRect();
    const camera = projection(r.width, r.height, view.current),
      x = e.clientX - r.left,
      y = e.clientY - r.top;
    if (tool === "terrain" && terrainSettings.mode === "path")
      return camera.unproject(x, y + terrainSettings.level * 24 * camera.scale);
    if (tool === "scenery") return camera.unproject(x, y + sceneryDraft.z * 24 * camera.scale);
    const fallback = camera.unproject(x, y);
    return park.current
      ? pickTerrain(park.current, x, y, camera.project, camera.tw, camera.th, fallback)
      : fallback;
  };
  const completeBuild = (id: number, kind: Kind, repeat = false) => {
    const built = park.current!.buildings.find((b) => b.id === id)!;
    ensurePods(park.current!, built);
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
    setCut(null);
    setPodEdit(null);
    setAdjust({ id: b.id, mode, point: point ?? { x: b.x, y: b.y }, rotation: 0 });
    setTool(mode);
    setHoverTile(null);
    notify(
      mode === "station"
        ? "Grüne Gleisfelder sind geeignete Stationsplätze. Bewegen zeigt die Vorschau, ein Klick versetzt."
        : supportsBuildingRotation(b.kind)
          ? "Bewege das Objekt zum neuen Platz. R dreht es, ein Klick übernimmt."
          : "Bewege das Objekt zum neuen Platz. Ein Klick übernimmt.",
    );
  };
  const startRotation = () => {
    const building = park.current?.buildings.find((item) => item.id === selected);
    if (!building || !supportsBuildingRotation(building.kind)) return;
    setAreaEditor(null);
    setCut(null);
    setPodEdit(null);
    setMenuOpen(false);
    setAdjust({
      id: building.id,
      mode: "move",
      point: { x: building.x, y: building.y },
      rotation: 1,
      rotateOnly: true,
    });
    setTool("move");
    setHoverTile(null);
    notify("Drehvorschau um 90°. Wähle die Ausrichtung und übernimm sie, wenn der Platz frei ist.");
  };
  const cancelAdjustment = () => {
    setAdjust(null);
    setTool("select");
    view.current.connection = undefined;
  };
  const applyPod = (building: Building, role: PodRole, pod: Pod) =>
    edit("Pod versetzen", () => {
      const live = park.current!.buildings.find((b) => b.id === building.id)!;
      const error = setAccessPod(park.current!, live, role, pod, autoClear);
      notify(
        error ??
          (live.sharedAccess
            ? "Gemeinsamer Pod versetzt. Verbinde ihn mit Eingangswegen; der Anschluss wird in Rot und Blau geteilt."
            : `${role === "entry" ? "Eingangs" : "Ausgangs"}pod versetzt. Verbinde das Feld vor dem Pod mit einem ${role === "entry" ? "blauen Eingangsweg" : "roten Ausgangsweg"}.`),
      );
      if (!error) {
        setPodEdit(null);
        setTool("select");
        setWorldRevision((v) => v + 1);
      }
    });
  const beginPod = (building: Building, role: PodRole) => {
    if (building.sharedAccess) role = "entry";
    setPodEdit({ id: building.id, role });
    setCut(null);
    setAdjust(null);
    setTool(`pod-${role}`);
    setMenuOpen(false);
    notify(
      "Wähle ein markiertes Anschlussfeld am Rand. Der Pod sitzt zwischen Attraktion und Weg.",
    );
  };
  const act = (p: Point, repeat = false, hitId?: number | null, hitPod?: PodRole) => {
    const s = park.current;
    if (!s) return;
    if (tool === "terrain") {
      edit("Gelände und Höhenwege", () => {
        if (terrainSettings.mode === "terrain") {
          const error = editTerrain(
            s,
            p,
            terrainSettings.action,
            terrainSettings.size,
            terrainSettings.level,
          );
          if (error) notify(error);
        } else if (terrainSettings.erase) removeDeck(s, p, terrainSettings.level);
        else {
          const error = placeDeck(s, {
            x: p.x,
            y: p.y,
            z: terrainSettings.level,
            type: terrainSettings.type,
            style: pathStyle,
            ...(terrainSettings.ramp ? { slope: terrainSettings.direction } : {}),
          });
          if (error) notify(error);
        }
      });
      return;
    }
    if (tool === "scenery") {
      edit("Themenbauteil setzen", () => {
        const error = placeScenery(s, { ...sceneryDraft, x: p.x, y: p.y });
        if (error) notify(error);
      });
      return;
    }
    if (tool === "viewpoint") {
      const habitat = s.buildings.find((item) => item.id === selected);
      if (!habitat) return;
      edit("Beobachtungspunkt versetzen", () => {
        const error = setHabitatViewpoint(s, habitat, p);
        notify(
          error ??
            (viewpointStatus(s, habitat).connected
              ? habitat.open
                ? "Beobachtungspunkt gesetzt. Besucher können sich hier sammeln."
                : "Beobachtungspunkt gesetzt. Öffne das Gehege, damit Besucher kommen."
              : "Beobachtungspunkt gesetzt. Verbinde ihn mit einem normalen Parkweg."),
        );
        if (!error) setTool("select");
      });
      return;
    }
    if (podEdit && tool.startsWith("pod-")) {
      const building = s.buildings.find((b) => b.id === podEdit.id);
      if (!building) return;
      const slot = podSlots(CATALOG[building.kind].size).find((slot) => {
        const q = podPort(building, CATALOG[building.kind].size, slot);
        return q.x === p.x && q.y === p.y;
      });
      if (!slot) {
        notify("Klicke auf ein markiertes Anschlussfeld neben der Attraktion.");
        return;
      }
      applyPod(building, podEdit.role, slot);
      return;
    }
    if (hitPod && (tool === "select" || tool === "erase")) {
      const building = s.buildings.find((b) => b.id === hitId);
      if (building) {
        setSelected(building.id);
        setCategory("detail");
        beginPod(building, hitPod);
        return;
      }
    }
    if (tool === "erase") {
      const target = s.buildings.find((b) => b.id === hitId) ?? occupant(s, p.x, p.y);
      if (target) p = footprint(target)[0] ?? p;
    }
    if (adjust && (tool === "station" || tool === "move")) {
      const b = s.buildings.find((b) => b.id === adjust.id);
      if (!b) return;
      edit(adjust.mode === "station" ? "Stationsversatz" : "Versetzen", () => {
        const error = adjustBuilding(
          s,
          b,
          adjust.mode,
          adjust.rotateOnly ? adjust.point : p,
          adjust.rotation,
          autoClear,
        );
        if (error) {
          notify(error);
          return;
        }
        cancelAdjustment();
        setCategory("detail");
        notify(
          adjust.rotateOnly
            ? "Ausrichtung übernommen. Mit Rückgängig kannst du die Drehung zurücknehmen."
            : access(s, b)
              ? "Position übernommen. Der neue Standort ist über den Parkweg erreichbar."
              : "Position übernommen. Verbinde den neuen Standort mit dem Wegenetz.",
        );
      });
      return;
    }
    if (tool === "select") {
      const b = s.buildings.find((b) => b.id === hitId) ?? occupant(s, p.x, p.y);
      setSelected(b?.id ?? null);
      if (b) {
        setCategory("detail");
        setMenuOpen(false);
      } else {
        setCategory((current) => (current === "detail" ? "" : current));
      }
      return;
    }
    if (tool === "coaster" && !blueprintMode) {
      if (!draft.length) {
        if (
          !insideMap(s, p.x, p.y) ||
          s.tiles[p.y][p.x] !== "grass" ||
          (occupant(s, p.x, p.y) &&
            (!autoClear ||
              !decorative(occupant(s, p.x, p.y)!.kind) ||
              occupant(s, p.x, p.y)!.kind === "keeperhut"))
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
        : ["path", "queue", "exit", "water"].includes(tool)
          ? "Wegebau"
          : (CATALOG[tool as Kind]?.name ?? "Bau"),
      () => {
        const result = place(
          s,
          tool as BuildTool,
          p,
          tool === "coaster" ? prefabBlueprint(p, rotation, coasterType) : undefined,
          autoClear,
          tool === "custom" ? customDesign : undefined,
          tool === "path" ? pathStyle : undefined,
        );
        if (result.error) {
          notify(result.error);
          return;
        }
        if (result.id !== undefined) completeBuild(result.id, tool as Kind, repeat);
      },
    );
  };
  const focus2D = (next: Point[]) => {
    const el = canvas.current;
    if (!el || !next.length) return;
    const continuation = appendPiece(next, piece),
      a = next.at(-1)!,
      b = continuation.at(-1) ?? a,
      target = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z ?? 0) + (b.z ?? 0)) / 2 };
    const zoom = Math.max(1.45, Math.min(1.9, view.current.zoom)),
      v = { ...view.current, zoom },
      p = projection(el.clientWidth, el.clientHeight, v).project(target.x, target.y, target.z);
    cameraTarget.current = {
      zoom,
      panX: v.panX + (Math.min(340, el.clientWidth * 0.35) + el.clientWidth) / 2 - p.x,
      panY: v.panY + el.clientHeight * 0.48 - p.y,
    };
    setZoom(Math.round(zoom * 100));
  };
  const rememberDraft = (next: Point[]) => {
    draftHistory.current.push(draft);
    setDraft(next);
    if (autoFocus) focus2D(next);
  };
  const addPiece = (part: Piece) => {
    if (!park.current || !draft.length) return;
    if (invertingPiece(part) && !COASTER_TYPES[coasterType].loop) {
      notify("Holzbahnen unterstützen keine Loopings.");
      return;
    }
    const next = appendPiece(draft, part),
      error = pieceError(
        trackEditWorld(park.current),
        draft,
        next,
        autoClear,
        park.current.trackEdit?.suffix,
      );
    if (error) notify(error);
    else {
      const suffix = park.current.trackEdit?.suffix,
        end = next.at(-1)!;
      if (
        suffix &&
        Math.hypot(end.x - suffix[0].x, end.y - suffix[0].y, (end.z ?? 0) - (suffix[0].z ?? 0)) <
          0.001 &&
        Math.cos((end.heading ?? 0) - (suffix[0].heading ?? 0)) > 0.999
      ) {
        const result = closeTrack(trackEditWorld(park.current), next, autoClear, suffix);
        if (result.track) {
          rememberDraft(result.track);
          notify(
            `${PIECES[part].name} eingesetzt und automatisch verbunden. Übernimm jetzt den Umbau.`,
          );
          return;
        }
      }
      rememberDraft(next);
    }
  };
  const autoClose = () => {
    if (!park.current) return;
    if (isClosedTrack(draft)) return;
    const result = closeTrack(
      trackEditWorld(park.current),
      draft,
      autoClear,
      park.current.trackEdit?.suffix,
    );
    if (result.error) notify(result.error);
    else if (result.track) rememberDraft(result.track);
  };
  const coasterBuild = () => {
    const s = park.current;
    if (!s || !draft.length) return;
    edit("Achterbahn", () => {
      if (s.trackEdit) {
        const id = s.trackEdit.buildingId,
          error = commitTrackEdit(s, draft, autoClear);
        if (error) {
          notify(error);
          return;
        }
        setDraft([]);
        draftHistory.current = [];
        setBuildWorld(null);
        setTool("select");
        setCategory("detail");
        setSelected(id);
        notify("Strecke umgebaut. Starte eine Testfahrt und öffne die Bahn wieder.");
        return;
      }
      const result = place(s, "coaster", draft[0], draft, autoClear);
      if (result.error) {
        notify(result.error);
        return;
      }
      completeBuild(result.id!, "coaster");
    });
  };
  const acceptTrackFit = (solution: TrackFit) => {
    const s = park.current;
    if (!s?.trackEdit) return;
    const id = s.trackEdit.buildingId;
    edit("Automatischer Streckenumbau", () => {
      const error = commitTrackFit(s, solution, autoClear);
      if (error) {
        notify(error);
        setFitPreview(null);
        return;
      }
      setDraft([]);
      draftHistory.current = [];
      setFitPreview(null);
      setBuildWorld(null);
      setTool("select");
      setCategory("detail");
      setSelected(id);
      notify(
        "Bauteil eingepasst und beide Enden verbunden. Starte eine Testfahrt und öffne die Bahn wieder.",
      );
    });
  };
  const b = snapshot?.buildings.find((b) => b.id === selected);
  const advice = useMemo(
    () => (snapshot && b && category === "detail" ? attractionAdvice(snapshot, b.id) : null),
    [snapshot, b?.id, category],
  );
  const cutTrack = useMemo(() => (b?.kind === "coaster" ? editableTrack(b) : []), [b?.track]);
  const sections = useMemo(
    () => (sectionMode === "drive" ? driveSections(cutTrack) : trackSections(cutTrack)),
    [cutTrack, sectionMode],
  );
  const driveGroups = useMemo(() => (b ? trackDriveGroups(b) : []), [b?.track]);
  const marked =
    cut && sectionMode === "remove"
      ? (cut.marked ?? Array.from({ length: cut.to - cut.from + 1 }, (_, i) => cut.from + i))
      : [];
  const markedGroups = selectionGroups(marked, sections.length) ?? [];
  const removalKey = JSON.stringify([cut, autoClear, b?.track, worldRevision]);
  const removalPreview = batchPreview?.key === removalKey ? batchPreview.plan : null;
  useEffect(() => {
    view.current.cutColor = sectionMode !== "remove" ? "#43d9d2" : "#ff634d";
    view.current.trackCuts =
      cut && cut.id === b?.id
        ? (sectionMode !== "remove" ? [{ from: cut.from, to: cut.to }] : markedGroups).map(
            (group) =>
              cutTrack.slice(sections[group.from]?.start ?? 0, (sections[group.to]?.end ?? 0) + 1),
          )
        : undefined;
    view.current.cutConnections =
      removalPreview && !removalPreview.error ? removalPreview.connections : undefined;
  }, [cut, cutTrack, sections, b?.id, sectionMode, removalPreview]);
  const resumeEdit = () => {
    const s = park.current;
    if (!s?.trackEdit) return;
    restoreDraft(s);
    setSelected(s.trackEdit.buildingId);
    setTool("coaster");
    setCategory("coaster");
    setBlueprintMode(false);
  };
  const openSections = (building: Building) => {
    if (park.current?.trackEdit) {
      resumeEdit();
      return;
    }
    setSelected(building.id);
    setCategory("detail");
    setMenuOpen(false);
    setSectionMode("remove");
    setCut({ id: building.id, from: 0, to: 0, marked: [] });
    setBatchPreview(null);
    setPodEdit(null);
    setTool("select");
  };
  const chooseAnotherRange = () => {
    const s = park.current;
    const live = s?.buildings.find((b) => b.id === s.trackEdit?.buildingId);
    if (!s || !live) return;
    cancelTrackEdit(s);
    draftHistory.current = [];
    setDraft([]);
    setBuildWorld(null);
    setWorldRevision((v) => v + 1);
    sync();
    openSections(live);
  };
  const resizeGap = (from: number, to: number) => {
    const s = park.current;
    if (!s) return;
    const error = resizeTrackEdit(s, from, to);
    if (error) {
      notify(error);
      return;
    }
    s.draft!.piece = piece;
    restoreDraft(s);
    if (buildWorld) setBuildWorld(structuredClone(s));
    setWorldRevision((v) => v + 1);
    sync();
    focus2D(s.trackEdit!.prefix);
    notify("Lücke vergrößert. Das gewählte Fertigteil wird am neuen Anschluss angezeigt.");
  };
  const selectedDriveKey = JSON.stringify(cutTrack[sections[cut?.from ?? -1]?.start]?.drive);
  useEffect(() => {
    if (sectionMode === "drive" && cut) {
      const existing = cutTrack[sections[cut.from]?.start]?.drive;
      if (existing) setDrive({ ...existing });
    }
  }, [cut?.id, cut?.from, cut?.to, sectionMode, selectedDriveKey]);
  const selectRange = (index: number, extend: boolean, addOnly = false) => {
    if (!b || !cut || index < 0 || index >= sections.length) return;
    setCut((current) => {
      if (!current || current.id !== b.id) return current;
      if (sectionMode !== "remove") {
        const group =
          !extend && sectionMode === "drive"
            ? driveGroups.find((g) => g.from <= index && g.to >= index)
            : undefined;
        return {
          id: b.id,
          from: extend ? Math.min(current.from, index) : (group?.from ?? index),
          to: extend ? Math.max(current.to, index) : (group?.to ?? index),
        };
      }
      const indices = new Set(current.marked ?? []);
      if (extend) {
        const anchor = current.anchor ?? index;
        for (let i = Math.min(anchor, index); i <= Math.max(anchor, index); i++) indices.add(i);
      } else if (indices.has(index) && !addOnly) indices.delete(index);
      else indices.add(index);
      const sorted = [...indices].sort((a, b) => a - b);
      return {
        ...current,
        marked: sorted,
        anchor: index,
        from: sorted[0] ?? 0,
        to: sorted.at(-1) ?? 0,
      };
    });
  };
  const setContiguousRange = (from: number, to: number) => {
    if (!cut) return;
    setCut({
      ...cut,
      from,
      to,
      anchor: from,
      marked:
        sectionMode === "remove"
          ? Array.from({ length: to - from + 1 }, (_, i) => from + i)
          : undefined,
    });
  };
  const previewRemoval = () => {
    const s = park.current,
      live = s?.buildings.find((x) => x.id === cut?.id);
    if (!s || !live) return;
    setBatchPreview({ key: removalKey, plan: batchTrackRemovalPlan(s, live, marked, autoClear) });
  };
  const commitRemoval = () => {
    const s = park.current,
      live = s?.buildings.find((x) => x.id === cut?.id);
    if (!s || !live || !removalPreview || removalPreview.error) return;
    edit("Mehrere Gleisteile entfernen", () => {
      const error = removeTrackSections(s, live, marked, autoClear);
      if (error) {
        notify(error);
        setBatchPreview(null);
        return;
      }
      notify(
        `${marked.length} Gleisteile entfernt und ${markedGroups.length} Lücken verbunden. Teste die Bahn vor dem Öffnen.`,
      );
      setCut(null);
      setBatchPreview(null);
    });
  };
  useEffect(() => {
    view.current.podEdit = podEdit ? { ...podEdit, clear: autoClear } : undefined;
  }, [podEdit, autoClear]);
  const modulePlan =
    b && cut && sectionMode === "drive" ? trackDrivePlan(b, cut.from, cut.to, drive) : null;
  const removeModulePlan =
    b && cut && sectionMode === "drive" ? trackDrivePlan(b, cut.from, cut.to, null) : null;
  const mountDrive = (value: TrackDrive | null, range = cut) => {
    const s = park.current,
      live = s?.buildings.find((b) => b.id === range?.id);
    if (!s || !live || !range) return;
    edit(value ? "Streckenmodul" : "Modul entfernen", () => {
      const error = installTrackDrive(s, live, range.from, range.to, value);
      notify(
        error ??
          (value
            ? "Modul montiert. Teste das neue Fahrprofil und öffne die Bahn wieder."
            : "Modul entfernt. Teste die Bahn erneut."),
      );
      if (!error) setCut(null);
    });
  };
  const removeSections = () => {
    const s = park.current,
      live = s?.buildings.find((b) => b.id === cut?.id);
    if (!s || !live || !cut || markedGroups.length !== 1) return;
    const error = beginTrackEdit(s, live, markedGroups[0].from, markedGroups[0].to);
    if (error) {
      notify(error);
      return;
    }
    setCut(null);
    setWorldRevision((v) => v + 1);
    restoreDraft(s);
    if (
      s.trackEdit &&
      Math.hypot(
        s.trackEdit.prefix.at(-1)!.x - s.trackEdit.suffix[0].x,
        s.trackEdit.prefix.at(-1)!.y - s.trackEdit.suffix[0].y,
      ) < 1.01
    ) {
      s.draft!.piece = "short";
      setPiece("short");
    }
    setBlueprintMode(false);
    setCategory("coaster");
    setTool("coaster");
    sync();
    notify(
      "Abschnitt entfernt. Die Baustelle wird gespeichert. Füge Bauteile an und verbinde zum offenen Ende.",
    );
    focus2D(s.trackEdit!.prefix);
  };
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
    snapshot?.buildings.filter(
      (b) => isRide(b.kind) && hasOperator(b) && b.open && b.tested && access(snapshot, b),
    ).length ?? 0;
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
  const changeCrew = (label: string, change: (s: Park) => string | null) =>
    edit(label, () => {
      const error = change(park.current!);
      if (error) notify(error);
    });
  const crewActions = {
    onHireCrew: () => changeCrew("Crew einstellen", hireRideCrew),
    onDismissCrew: (crewId: number) =>
      changeCrew("Crew entlassen", (s) => dismissRideCrew(s, crewId)),
    onAssignCrew: (crewId: number, buildingId: number | null) =>
      changeCrew("Creweinsatz ändern", (s) => assignRideCrew(s, crewId, buildingId)),
    onCrewAutomatic: (crewId: number) =>
      changeCrew("Crew automatisch verteilen", (s) => setCrewAutomatic(s, crewId)),
    onRideStaffingMode: (buildingId: number, mode: "auto" | "off") =>
      changeCrew("Personalautomatik ändern", (s) => setRideStaffingMode(s, buildingId, mode)),
  };
  const changeBuilding = (fn: (b: Building) => void) => {
    const b = park.current?.buildings.find((b) => b.id === selected);
    if (b) {
      fn(b);
      sync();
    }
  };
  const runAdvice = (issueId: string) => {
    const live = park.current,
      selectedBuilding = live?.buildings.find((item) => item.id === selected);
    const issue = advice?.issues.find((item) => item.id === issueId),
      action = issue?.action;
    if (!live || !selectedBuilding || !action || action.disabledReason) return;
    const scrollTo = (selector: string) =>
      setAdvisorSection((current) => ({ selector, serial: (current?.serial ?? 0) + 1 }));
    switch (action.kind) {
      case "access":
        if (issueId === "shared-space") scrollTo(".shared-access-control");
        else if (usesPods(selectedBuilding.kind)) scrollTo(".pod-controls");
        else if (isHabitat(selectedBuilding.kind)) scrollTo(".habitat-visitors");
        else {
          pickTool("path", "paths");
          focusMapPoint(selectedBuilding);
        }
        break;
      case "staff":
        setTab("personal");
        setSettings(true);
        break;
      case "maintenance":
        scrollTo(".maintenance-card");
        break;
      case "zoo":
        scrollTo("[data-advisor-anchor='zoo']");
        break;
      case "operations":
        if (issueId === "park-closed") {
          setTab("park");
          setSettings(true);
        } else if (
          ["price", "demand-score", "ride-fit"].includes(issueId) ||
          (!isAttraction(selectedBuilding.kind) && !isTransport(selectedBuilding.kind))
        )
          scrollTo("[data-advisor-anchor='price']");
        else
          scrollTo(
            isTransport(selectedBuilding.kind)
              ? "[data-advisor-anchor='transit']"
              : ".ride-operations-panel",
          );
        break;
      case "track":
        if (live.trackEdit?.buildingId === selectedBuilding.id) resumeEdit();
        else {
          openSections(selectedBuilding);
          setSectionMode("profile");
          setCut({ id: selectedBuilding.id, from: 0, to: 0 });
          notify(
            "Markiere den Abschnitt, den du verbessern möchtest. Der Fahrprofil-Assistent zeigt passende Vorschläge.",
          );
        }
        break;
      case "marketing":
        setMarketingTarget(selectedBuilding.id);
        setTab("marketing");
        setSettings(true);
        break;
      case "analysis":
        setTrafficPoint(selectedBuilding);
        setCategory("analysis");
        setTrafficMode(issueId === "litter" ? "litter" : issueId === "needs" ? "mood" : "crowd");
        setTool("select");
        setMenuOpen(false);
        focusMapPoint(selectedBuilding);
        break;
      default:
        edit("Besucher-Assistent · " + action.label, () => {
          const error = applyAttractionAdvice(live, selectedBuilding.id, issueId, action.id);
          notify(error ?? `${action.label}: erledigt. Der Assistent prüft die Situation erneut.`);
        });
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
              <strong>
                {snapshot && hasUnlimitedBudget(snapshot) ? "∞" : EUR(snapshot?.cash ?? 16000)}
              </strong>
              <span>
                {snapshot && hasUnlimitedBudget(snapshot) ? "Unbegrenztes Budget" : "Parkbudget"}
              </span>
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
          <ParkWeather
            park={snapshot}
            onBuild={() => {
              pickTool("select", "nature");
              setMenuOpen(false);
            }}
          />
        </div>
        <div className="topactions">
          <span className="save-label" title={saved}>
            {saved}
          </span>
        </div>
      </header>
      <section
        className={`surface ${menuOpen ? "menu-expanded" : ""}`}
        aria-label="Parkbau und Simulation"
      >
        {areaEditor && (
          <aside className="cleaner-area-editor" aria-label="Reinigungsbereich markieren">
            <div className="cleaner-area-editor-title">
              <MapPin />
              <strong>Reinigungsbereich · {areaName}</strong>
              <button
                className="iconbtn"
                aria-label="Bereichsauswahl abbrechen"
                onClick={leaveAreaEditor}
              >
                <X />
              </button>
            </div>
            <p>
              {areaEditor.ready
                ? "Prüfe den markierten Bereich. Zum Ändern ein neues Rechteck ziehen."
                : areaEditor.from
                  ? "Zweite Ecke wählen oder den Bereich aufziehen."
                  : "Zwei Ecken anklicken oder mit der linken Maustaste ein Rechteck aufziehen."}
            </p>
            {draftArea && areaStatus && (
              <div className="cleaner-area-facts">
                <span>
                  {areaStatus.reachablePaths} / {areaStatus.totalPaths} Wegfelder erreichbar
                </span>
                <span>
                  {areaStatus.litter} Müllteile · {areaStatus.fullBins} volle Tonnen
                </span>
              </div>
            )}
            {areaEditor.ready && areaStatus && !areaStatus.connected && (
              <p className="cleaner-area-warning">
                Hier fehlt eine begehbare Verbindung für die Reinigungskraft.
              </p>
            )}
            <div className="cleaner-area-actions">
              <button
                className="primary"
                disabled={!areaEditor.ready || !draftArea || !areaStatus?.connected}
                onClick={() => {
                  if (!park.current || !draftArea) return;
                  const error = assignCleanerArea(park.current, areaEditor.workerId, draftArea);
                  sync();
                  if (error) notify(error);
                  else {
                    leaveAreaEditor();
                    notify(`${areaName} übernimmt den markierten Reinigungsbereich.`);
                  }
                }}
              >
                Bereich zuweisen
              </button>
              <button
                className="secondary"
                onClick={() => {
                  clearCleanerArea(areaEditor.workerId);
                  leaveAreaEditor();
                }}
              >
                Automatisch verteilen
              </button>
            </div>
            <small>
              Andere Farben zeigen die Bereiche des Teams. Rechts ziehen verschiebt die Karte;
              Mausrad zoomt. Anreise und Müllentsorgung dürfen außerhalb liegen.
            </small>
          </aside>
        )}
        {buildWorld && tool === "coaster" && (
          <Suspense fallback={<div className="build3d-shell">Bauansicht wird geladen …</div>}>
            <BuildView
              park={buildWorld}
              draft={draft}
              candidate={candidate}
              fit={fitPreview ?? undefined}
              error={candidateError}
              follow={autoFocus}
              onPlace={(p) => act(p)}
              onClose={() => setBuildWorld(null)}
            />
          </Suspense>
        )}
        <canvas
          ref={canvas}
          className={`world ${tool !== "select" || areaEditor ? "building" : ""}`}
          aria-label="Isometrischer Freizeitpark. Wähle unten ein Bauwerk und klicke auf eine freie Fläche."
          onContextMenu={(e) => e.preventDefault()}
          onWheel={(e) => changeZoom(e.deltaY < 0 ? 1.07 : 1 / 1.07, e.clientX, e.clientY)}
          onPointerDown={(e) => {
            setHoverInfo(null);
            e.currentTarget.setPointerCapture(e.pointerId);
            if (areaEditor && e.button === 0 && !e.altKey) {
              const raw = tileAt(e),
                live = park.current!;
              const p = {
                x: Math.max(0, Math.min(mapWidth(live) - 1, raw.x)),
                y: Math.max(0, Math.min(mapHeight(live) - 1, raw.y)),
              };
              areaPointer.current = p;
              setAreaEditor((a) =>
                a
                  ? !a.from || a.ready
                    ? { ...a, from: p, to: p, ready: false }
                    : { ...a, to: p, ready: true }
                  : a,
              );
              return;
            }
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              px: view.current.panX,
              py: view.current.panY,
              moved: false,
              pan:
                e.button === 2 ||
                e.button === 1 ||
                e.altKey ||
                (tool === "select" &&
                  !(cut?.id === selected && category === "detail" && sectionMode === "remove")),
              tile: tileAt(e),
            };
            if (
              e.button === 0 &&
              !e.altKey &&
              ["path", "queue", "exit", "water", "erase", "scenery"].includes(tool)
            ) {
              stroke.current = [];
              const rect = e.currentTarget.getBoundingClientRect();
              act(
                tileAt(e),
                false,
                hitBuildingAt(view.current, e.clientX - rect.left, e.clientY - rect.top),
                hitAccessPodAt(view.current, e.clientX - rect.left, e.clientY - rect.top),
              );
            }
          }}
          onPointerMove={(e) => {
            const p = tileAt(e);
            if (areaEditor && !drag.current) {
              const live = park.current!,
                q = {
                  x: Math.max(0, Math.min(mapWidth(live) - 1, p.x)),
                  y: Math.max(0, Math.min(mapHeight(live) - 1, p.y)),
                };
              if (areaPointer.current || (areaEditor.from && !areaEditor.ready))
                setAreaEditor((a) => (a ? { ...a, to: q } : a));
              return;
            }
            const rect = e.currentTarget.getBoundingClientRect(),
              px = e.clientX - rect.left,
              py = e.clientY - rect.top;
            const hit =
              hitBuildingAt(view.current, px, py) ??
              (park.current ? occupant(park.current, p.x, p.y)?.id : null);
            view.current.hoveredId = trafficMode ? null : (hit ?? null);
            setHoverInfo(
              !drag.current &&
                !trafficMode &&
                tool === "select" &&
                (hit != null ||
                  ["path", "queue", "exit"].includes(park.current?.tiles[p.y]?.[p.x] ?? ""))
                ? {
                    id: hit ?? null,
                    tile: hit == null ? p : undefined,
                    pod: hitAccessPodAt(view.current, px, py),
                    x: Math.min(rect.width - 224, px + 18),
                    y: Math.min(rect.height - 80, py + 18),
                  }
                : null,
            );
            view.current.hover = p;
            setHoverTile((old) => (old?.x === p.x && old?.y === p.y ? old : p));
            if (adjust && !adjust.rotateOnly)
              setAdjust((a) =>
                a && (a.point.x !== p.x || a.point.y !== p.y) ? { ...a, point: p } : a,
              );
            const d = drag.current;
            if (d) {
              const dx = e.clientX - d.x,
                dy = e.clientY - d.y;
              if (Math.hypot(dx, dy) > 5) d.moved = true;
              if (d.moved && d.pan) {
                cameraTarget.current = null;
                view.current.panX = d.px + dx;
                view.current.panY = d.py + dy;
              } else if (
                d.moved &&
                cut &&
                cut.id === b?.id &&
                category === "detail" &&
                sectionMode === "remove"
              ) {
                const { project } = projection(rect.width, rect.height, view.current);
                const index = pickTrackSection(cutTrack, sections, { x: px, y: py }, project, 18);
                if (index >= 0) selectRange(index, false, true);
                const start = pickTrackSection(
                  cutTrack,
                  sections,
                  { x: d.x - rect.left, y: d.y - rect.top },
                  project,
                  18,
                );
                if (start >= 0) selectRange(start, false, true);
              } else if (
                d.moved &&
                ["path", "queue", "exit", "water", "erase", "scenery"].includes(tool)
              ) {
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
            if (areaEditor && areaPointer.current && e.button === 0) {
              const start = areaPointer.current,
                p = tileAt(e),
                live = park.current!;
              areaPointer.current = null;
              const end = {
                x: Math.max(0, Math.min(mapWidth(live) - 1, p.x)),
                y: Math.max(0, Math.min(mapHeight(live) - 1, p.y)),
              };
              if (start.x !== end.x || start.y !== end.y)
                setAreaEditor((a) => (a ? { ...a, to: end, ready: true } : a));
              return;
            }
            if (areaEditor && e.button === 2) {
              drag.current = null;
              return;
            }
            const d = drag.current;
            drag.current = null;
            if (
              d &&
              !d.moved &&
              !e.altKey &&
              e.button === 0 &&
              !["path", "queue", "exit", "water", "erase", "scenery"].includes(tool)
            ) {
              if (trafficMode && traffic && tool === "select") {
                const zone = trafficAt(traffic, tileAt(e));
                if (zone) inspectTrafficZone(zone, false);
              } else if (cut && b && cut.id === b.id && sections.length) {
                const rect = e.currentTarget.getBoundingClientRect(),
                  { project } = projection(rect.width, rect.height, view.current),
                  x = e.clientX - rect.left,
                  y = e.clientY - rect.top;
                const index = pickTrackSection(cutTrack, sections, { x, y }, project);
                if (index >= 0) selectRange(index, e.shiftKey);
              } else {
                const rect = e.currentTarget.getBoundingClientRect();
                act(
                  tileAt(e),
                  e.shiftKey,
                  hitBuildingAt(view.current, e.clientX - rect.left, e.clientY - rect.top),
                  hitAccessPodAt(view.current, e.clientX - rect.left, e.clientY - rect.top),
                );
              }
            }
            if (d && !d.moved && e.button === 2) {
              pickTool("select");
              setCategory("");
            }
            finishStroke();
          }}
          onPointerCancel={() => {
            areaPointer.current = null;
            drag.current = null;
            finishStroke();
          }}
          onLostPointerCapture={() => {
            areaPointer.current = null;
            drag.current = null;
            finishStroke();
          }}
          onPointerLeave={() => {
            if (!drag.current) {
              view.current.hover = null;
              setHoverTile(null);
              setHoverInfo(null);
              view.current.hoveredId = null;
            }
          }}
        />
        {trafficMode && (
          <TrafficMapLegend
            mode={trafficMode}
            onOpen={() => {
              setCategory("analysis");
              setMenuOpen(false);
              setSelected(null);
            }}
            onClose={() => setTrafficMode(null)}
          />
        )}
        {!trafficMode &&
          hoverInfo &&
          (() => {
            const object = snapshot?.buildings.find((b) => b.id === hoverInfo.id);
            const sharedPath =
              !object &&
              hoverInfo.tile &&
              snapshot?.buildings.find((item) => {
                if (!item.sharedAccess) return false;
                const route = sharedAccessRoute(snapshot, item);
                return route.some(
                  (p, i) =>
                    (i < route.length - 1 || route.length === 1) &&
                    p.x === hoverInfo.tile!.x &&
                    p.y === hoverInfo.tile!.y,
                );
              });
            return object ? (
              <div
                className="world-tooltip"
                style={{ left: hoverInfo.x, top: hoverInfo.y }}
                role="tooltip"
              >
                <strong>
                  {hoverInfo.pod
                    ? `${object.sharedAccess ? "Gemeinsamer Pod" : hoverInfo.pod === "entry" ? "Eingangspod" : "Ausgangspod"} · ${object.name}`
                    : object.name}
                </strong>
                <span>
                  {CATALOG[object.kind].name}
                  {object.kind === "coaster"
                    ? ` · ${COASTER_TYPES[object.track?.[0]?.style ?? "steel"].name}`
                    : ""}
                </span>
                {!decorative(object.kind) && (
                  <small>
                    {snapshot?.trackEdit?.buildingId === object.id
                      ? "Im Umbau"
                      : object.open
                        ? "Geöffnet"
                        : "Geschlossen"}{" "}
                    · {object.queue.length} warten
                  </small>
                )}
              </div>
            ) : hoverInfo.tile && snapshot ? (
              <div
                className="world-tooltip"
                style={{ left: hoverInfo.x, top: hoverInfo.y }}
                role="tooltip"
              >
                <strong>
                  {sharedPath
                    ? "Gemeinsamer Zugang · rot & blau"
                    : snapshot.tiles[hoverInfo.tile.y]?.[hoverInfo.tile.x] === "exit"
                      ? "Ausgangsweg · rot"
                      : snapshot.tiles[hoverInfo.tile.y]?.[hoverInfo.tile.x] === "queue"
                        ? "Eingangsweg · blau"
                        : "Parkweg"}
                </strong>
                <span>
                  {sharedPath
                    ? `Rot hinaus · Blau hinein · ${sharedPath.name}`
                    : snapshot.tiles[hoverInfo.tile.y]?.[hoverInfo.tile.x] === "exit"
                      ? exitNetwork(snapshot).has(`${hoverInfo.tile.x},${hoverInfo.tile.y}`)
                        ? "Nur hinaus · mit Parkweg verbunden"
                        : "Anschluss zum Parkweg fehlt"
                      : snapshot.tiles[hoverInfo.tile.y]?.[hoverInfo.tile.x] === "queue"
                        ? "Warteschlange · 4 Gäste pro Feld"
                        : "Gemeinsamer Weg in beide Richtungen"}
                </span>
              </div>
            ) : null;
          })()}
        {tool === "coaster" &&
          !blueprintMode &&
          candidateError &&
          !isClosedTrack(draft) &&
          !fitPreview && (
            <div className="conflict-options builder-help-card">
              <strong>So kannst du weiterbauen</strong>
              {snapshot?.trackEdit && (
                <button
                  className="auto-fit-shortcut"
                  onClick={() => fitAssistant.current?.search()}
                >
                  <WandSparkles size={16} /> Konflikt automatisch lösen
                </button>
              )}
              {conflictOptions.map((option, i) => (
                <button key={i} onClick={() => rememberDraft(option.track)}>
                  {option.label} anfügen · {EUR(trackCost(option.track) - trackCost(draft))}
                </button>
              ))}
              {!conflictOptions.length && (
                <span>
                  {snapshot?.trackEdit && !draftHistory.current.length
                    ? "Dieses Fertigteil braucht mehr freie Fläche. Vergrößere die Lücke oder wähle einen anderen Gleisbereich."
                    : "Entferne das letzte Teil und wähle davor eine andere Richtung."}
                </span>
              )}
              {snapshot?.trackEdit && !draftHistory.current.length ? (
                <button onClick={chooseAnotherRange}>Anderen Gleisbereich auswählen</button>
              ) : (
                <button
                  onClick={() =>
                    setDraft(draftHistory.current.pop() ?? park.current?.trackEdit?.prefix ?? [])
                  }
                >
                  Letztes Bauteil entfernen
                </button>
              )}
              <button onClick={() => setBuildWorld(structuredClone(park.current!))}>
                Konflikt in 3D ansehen
              </button>
            </div>
          )}
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
            <strong>
              {snapshot && hasUnlimitedBudget(snapshot)
                ? "Dein freier Park"
                : snapshot
                  ? scenarioOf(snapshot).name
                  : "Waldhain Park"}
            </strong>
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
        {[
          "rides",
          "coaster",
          "paths",
          "shops",
          "nature",
          "zoo",
          "detail",
          "guests",
          "analysis",
          "terrain",
          "scenery",
        ].includes(category) &&
          (category !== "detail" || (b && snapshot)) && (
            <aside
              ref={panelRef}
              className={`panel ${category === "coaster" ? "builder-panel" : ""} ${cut?.id === selected ? "editing-section" : ""} ${podEdit?.id === selected ? "pod-editing" : ""}`}
              data-menu-group={
                isHabitat(b?.kind ?? "")
                  ? "zoo"
                  : parkMenuGroup(category === "detail" ? "rides" : category)
              }
              aria-label="Bauauswahl"
            >
              <div className="panelhead">
                <h2>
                  {
                    (
                      {
                        rides: "Einsteigen & staunen",
                        coaster: snapshot?.trackEdit ? "Strecke umbauen" : "Deine Achterbahn",
                        terrain: "Gelände, Brücken & Tunnel",
                        scenery: "Deine Themenwelt",
                        paths: "Neue Verbindungen",
                        shops: "Für kleine Pausen",
                        nature: "Ein bisschen Grün",
                        zoo: "Zoo & Tierpflege",
                        detail: b?.name,
                        guests: "Stimmen aus dem Park",
                        analysis: "Parkanalyse & Heatmap",
                      } as Record<string, string | undefined>
                    )[category]
                  }
                </h2>
                {category === "detail" && b && supportsBuildingRotation(b.kind) && (
                  <button
                    className="iconbtn focus-attraction"
                    aria-label={`${b.name} drehen`}
                    title="Drehen · Vorschau in 90°-Schritten"
                    data-testid="rotate-selected-building"
                    onClick={startRotation}
                  >
                    <RotateCw />
                  </button>
                )}
                {category === "detail" && b && (
                  <button
                    className="iconbtn focus-attraction"
                    aria-label={`${b.name} im Park ansehen`}
                    title="Im Park ansehen · Kamera bewegen und heranzoomen"
                    data-testid="focus-selected-attraction"
                    onClick={() => focusAttraction(b.id)}
                  >
                    <Eye />
                  </button>
                )}
                <button
                  className="iconbtn"
                  aria-label="Baufenster schließen"
                  onClick={() => {
                    setCategory("");
                    setTool("select");
                    setCut(null);
                    setPodEdit(null);
                    setAdjust(null);
                  }}
                >
                  <X />
                </button>
              </div>
              <div className="panelbody">
                {category === "zoo" && snapshot && (
                  <>
                    {catalog([
                      "zebra",
                      "giraffe",
                      "elephant",
                      "lion",
                      "flamingo",
                      "penguin",
                      "panda",
                      "keeperhut",
                    ])}
                    <ZooOverview
                      onLocateStaff={locateStaff}
                      park={snapshot}
                      onAssignKeeper={(workerId, habitatId) => {
                        const error = assignZooKeeperToHabitat(park.current!, workerId, habitatId);
                        sync();
                        return error;
                      }}
                      onSpecialists={(role, count) => {
                        const error = setZooSpecialists(park.current!, role, count);
                        sync();
                        return error;
                      }}
                      onBuild={(k) => pickTool(k, "zoo")}
                      onKeepers={(n) => {
                        initZoo(park.current!);
                        park.current!.zoo!.keepers = n;
                        initZoo(park.current!);
                        sync();
                      }}
                    />
                    <button
                      className="secondary"
                      onClick={() => {
                        setTab("research");
                        setSettings(true);
                      }}
                    >
                      Tierarten erforschen
                    </button>
                  </>
                )}
                {category === "rides" && (
                  <>
                    <div
                      className="attraction-view-tabs"
                      role="group"
                      aria-label="Attraktionen auswählen"
                    >
                      <button
                        aria-pressed={ridesView === "catalog"}
                        onClick={() => setRidesView("catalog")}
                      >
                        Neu bauen
                      </button>
                      <button
                        aria-pressed={ridesView === "park"}
                        onClick={() => {
                          setRidesView("park");
                          setTool("select");
                        }}
                      >
                        Im Park{" "}
                        {snapshot
                          ? `(${snapshot.buildings.filter((item) => isAttraction(item.kind) || isTransport(item.kind)).length})`
                          : ""}
                      </button>
                    </div>
                    {ridesView === "park" && snapshot ? (
                      <AttractionDirectory
                        park={snapshot}
                        selectedId={selected}
                        onSelect={selectAttraction}
                        onFocus={focusAttraction}
                      />
                    ) : (
                      <>
                        {catalog([
                          "wheel",
                          "carousel",
                          "bumper",
                          "balloonride",
                          "rapids",
                          "swing",
                          "drop",
                          "pirate",
                          "teacups",
                          "spinner",
                        ])}
                        <button
                          className="secondary"
                          style={{ marginTop: 12, width: "100%" }}
                          onClick={() => {
                            if (snapshot && isUnlocked(snapshot, "custom")) setWorkshop(true);
                            else {
                              setTab("research");
                              setSettings(true);
                            }
                          }}
                        >
                          <Sparkles size={18} />{" "}
                          {snapshot && isUnlocked(snapshot, "custom")
                            ? "Eigene Attraktion entwickeln"
                            : "Werkstatt erforschen"}
                        </button>
                        {customDesign && (
                          <button
                            className="primary"
                            style={{ marginTop: 8 }}
                            onClick={() => pickTool("custom", "rides")}
                          >
                            {customDesign.name} platzieren · {EUR(designStats(customDesign).cost)}
                          </button>
                        )}
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
                            Platziere die Attraktion. Danach legt „Anschließen & öffnen“ den Weg für
                            dich an.
                          </span>
                        </div>
                      </>
                    )}
                  </>
                )}
                {category === "shops" && (
                  <>
                    {catalog([
                      "burger",
                      "hotdog",
                      "icecream",
                      "popcorn",
                      "drink",
                      "coffee",
                      "toilet",
                      "balloon",
                      "plush",
                      "bin",
                    ])}
                    <div className="hintbox">
                      <Info />
                      <span>Geschäfte stehen direkt an normalen Parkwegen.</span>
                    </div>
                  </>
                )}
                {category === "nature" && (
                  <>
                    <div className="hintbox">
                      <Sun />
                      <span>
                        Für jedes Wetter: trockene Plätze, Schatten und kostenloses Wasser.
                      </span>
                    </div>
                    {catalog(["shelter", "parasol", "fountain"])}
                    {catalog(["tree", "pine", "flowers", "bench", "picnic", "playground", "bin"])}
                    <button
                      className="secondary"
                      style={{ marginTop: 12 }}
                      onClick={() => {
                        setTab("land");
                        setSettings(true);
                      }}
                    >
                      Parkgelände erweitern
                    </button>
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
                {category === "terrain" && (
                  <TerrainPanel
                    value={terrainSettings}
                    onChange={setTerrainSettings}
                    onBuild={() => pickTool("terrain", "terrain")}
                  />
                )}
                {category === "scenery" && snapshot && (
                  <SceneryEditor
                    draft={sceneryDraft}
                    onChange={(p) => {
                      setSceneryDraft(p);
                      setTool("scenery");
                    }}
                    pieces={snapshot.scenery ?? []}
                    onRotate={(id) =>
                      edit("Themenbauteil drehen", () => {
                        const error = rotateScenery(park.current!, id);
                        if (error) notify(error);
                      })
                    }
                    onRemove={(id) =>
                      edit("Themenbauteil entfernen", () => {
                        removeScenery(park.current!, id);
                      })
                    }
                    onFocus={(p) => {
                      focusMapPoint(p);
                    }}
                  />
                )}
                {category === "paths" && (
                  <div className="stack">
                    <button
                      className="secondary"
                      onClick={() => {
                        setTerrainSettings({ ...terrainSettings, mode: "path" });
                        pickTool("terrain", "terrain");
                      }}
                    >
                      <Layers size={18} /> Brücken, Rampen & Tunnel
                    </button>
                    <button
                      className={`path-tool public ${tool === "path" ? "active" : ""}`}
                      aria-pressed={tool === "path"}
                      onClick={() => pickTool("path")}
                    >
                      <Route />
                      <span>
                        <strong>Parkweg · 12 €</strong>
                        <small>Gemeinsam durch den Park</small>
                      </span>
                    </button>
                    <div className="path-swatches" aria-label="Wegbelag">
                      {Object.entries(PATH_STYLES).map(([id, style]) => (
                        <button
                          key={id}
                          className={pathStyle === id ? "active" : ""}
                          aria-pressed={pathStyle === id}
                          title={style.description}
                          onClick={() => {
                            setPathStyle(id as PathStyle);
                            pickTool("path");
                          }}
                        >
                          <i style={{ background: style.color, borderColor: style.edge }} />
                          <span>{style.name}</span>
                        </button>
                      ))}
                    </div>
                    <p className="small">
                      Neue Wege: 12 € · vorhandene Wege umgestalten: 6 € pro Feld.
                    </p>
                    <button
                      className={`path-tool entrance ${tool === "queue" ? "active" : ""}`}
                      aria-pressed={tool === "queue"}
                      onClick={() => pickTool("queue")}
                    >
                      <LogIn />
                      <span>
                        <strong>Eingangsweg · 18 €</strong>
                        <small>Blau · anstellen & einsteigen</small>
                      </span>
                    </button>
                    <button
                      className={`path-tool exit ${tool === "exit" ? "active" : ""}`}
                      aria-pressed={tool === "exit"}
                      onClick={() => pickTool("exit")}
                    >
                      <LogOut />
                      <span>
                        <strong>Ausgangsweg · 18 €</strong>
                        <small>Rot · aussteigen & weitergehen</small>
                      </span>
                    </button>
                    <p className="small">
                      Klicke oder ziehe. Blau verbindet das Feld vor dem Eingangspod, Rot das Feld
                      vor dem Ausgangspod mit einem beigen Parkweg. Pfeile zeigen den Ausgang; ein
                      Kreuz bedeutet, dass der Anschluss fehlt.
                    </p>
                    <div className="empty-note">
                      Die Pod-Häuschen versetzt du in der Attraktionsverwaltung. Blaue Wege bieten
                      vier Warteplätze pro Feld. Rote Wege sind nur zum Aussteigen. Ohne fertigen
                      Ausgang nutzen Gäste weiterhin den bisherigen Zugang.
                    </div>
                    {catalog(["train", "shuttle"])}
                    <p className="small">
                      Zwei Halte desselben Typs an Parkwege setzen und zu einer Linie verbinden.
                      Fahrzeuge bleiben auf Parkwegen; rote Wege leiten aussteigende Fahrgäste
                      weiter.
                    </p>
                  </div>
                )}
                {category === "coaster" && (
                  <>
                    <div className="builder-view-options">
                      <button
                        className="secondary"
                        onClick={() => {
                          if (buildWorld) setBuildWorld(null);
                          else {
                            setBlueprintMode(false);
                            setBuildWorld(structuredClone(park.current!));
                          }
                        }}
                      >
                        {buildWorld ? "2D-Parkansicht" : "3D-Bauinspektor"}
                      </button>
                      <label>
                        <input
                          type="checkbox"
                          checked={autoFocus}
                          onChange={(e) => {
                            setAutoFocus(e.target.checked);
                            if (!e.target.checked) cameraTarget.current = null;
                          }}
                        />{" "}
                        Anschluss folgen
                      </label>
                    </div>
                    {!snapshot?.trackEdit && (
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
                                if (!COASTER_TYPES[type].loop && invertingPiece(piece))
                                  setPiece("straight");
                              }}
                            >
                              <CarPreview
                                vehicle={vehicleFor({ track: [{ x: 0, y: 0, style: type }] })}
                              />
                              <strong>{COASTER_TYPES[type].name}</strong>
                            </button>
                          ))}
                        </div>

                        <div className="build-modes" role="group" aria-label="Achterbahn-Bauweise">
                          <button
                            className={blueprintMode ? "active" : ""}
                            aria-pressed={blueprintMode}
                            disabled={!!snapshot?.trackEdit}
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
                            Fertigteile
                          </button>
                        </div>
                      </>
                    )}
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
                          <b>
                            {snapshot?.trackEdit
                              ? draftPlan?.error
                                ? "Umbauentwurf"
                                : EUR(draftPlan?.cost ?? 0)
                              : EUR(trackCost(draft))}
                          </b>
                        </div>
                        {snapshot?.trackEdit && (
                          <details className="track-edit-notice">
                            <summary>
                              {editRange
                                ? `Abschnitt ${editRange.from + 1}–${editRange.to + 1}`
                                : "Offene Lücke"}{" "}
                              · Lücke vergrößern
                            </summary>
                            <p>
                              Fertigteil auswählen, Vorschau prüfen und einsetzen. Passende Enden
                              verbinden sich sofort.
                            </p>
                            {editRange && (
                              <div className="gap-actions">
                                <button
                                  className="secondary"
                                  disabled={editRange.from === 0}
                                  onClick={() => resizeGap(editRange.from - 1, editRange.to)}
                                >
                                  ← Weiteres Gleis davor entfernen
                                </button>
                                <button
                                  className="secondary"
                                  disabled={editRange.to === editRange.sections.length - 1}
                                  onClick={() => resizeGap(editRange.from, editRange.to + 1)}
                                >
                                  Weiteres Gleis danach entfernen →
                                </button>
                              </div>
                            )}
                            <button className="secondary" onClick={chooseAnotherRange}>
                              Anderen Gleisbereich auswählen
                            </button>
                            {draftHistory.current.length > 0 && (
                              <small>Vergrößern setzt die neuen Teile im Entwurf zurück.</small>
                            )}
                          </details>
                        )}
                        <h3 className="prefab-heading">Fertigteile · auswählen und einsetzen</h3>
                        <TrackPieceCatalog
                          selected={piece}
                          wood={!COASTER_TYPES[coasterType].loop}
                          onSelect={(id) => {
                            setPiece(id);
                            if (park.current?.draft) park.current.draft.piece = id;
                          }}
                        />
                        <div
                          className={`candidate-status ${candidateError && !isClosedTrack(draft) ? "invalid" : ""}`}
                          role="status"
                        >
                          {candidateError ??
                            (draft.length
                              ? `${PIECES[piece].name}: Anschluss frei · ${EUR(trackCost(candidate) - trackCost(draft))}`
                              : "Setze die Station auf die Wiese.")}
                        </div>
                        {snapshot?.trackEdit && !isClosedTrack(draft) && (
                          <TrackFitAssistant
                            ref={fitAssistant}
                            park={snapshot}
                            draft={draft}
                            piece={piece}
                            clear={autoClear}
                            revision={worldRevision}
                            onPreview={setFitPreview}
                            onApply={acceptTrackFit}
                          />
                        )}
                        {fittingCut && (
                          <button
                            className="fit-gap"
                            onClick={() => resizeGap(fittingCut.from, fittingCut.to)}
                          >
                            Platz für {PIECES[piece].name} schaffen · {fittingCut.extra} weitere
                            Abschnitte entfernen
                          </button>
                        )}
                        <div className="builder-actions">
                          <div className="builder-row">
                            <button
                              className="primary"
                              disabled={!draft.length || !!candidateError}
                              onClick={() => addPiece(piece)}
                            >
                              <Plus size={16} /> {PIECES[piece].name} einsetzen
                            </button>
                            <button
                              className="secondary"
                              aria-label="Letztes Bauteil entfernen"
                              title="Letztes Bauteil entfernen · Strg/⌘ Z"
                              disabled={!draftHistory.current.length}
                              onClick={() =>
                                setDraft(
                                  draftHistory.current.pop() ??
                                    park.current?.trackEdit?.prefix ??
                                    [],
                                )
                              }
                            >
                              <Undo2 size={16} />
                            </button>
                          </div>
                          <button
                            className="secondary"
                            disabled={
                              isClosedTrack(draft) || draft.length < (snapshot?.trackEdit ? 1 : 2)
                            }
                            onClick={autoClose}
                          >
                            <Route size={16} />{" "}
                            {snapshot?.trackEdit
                              ? "Offene Enden verbinden"
                              : "Zur Station verbinden"}
                          </button>
                          <button
                            className="primary"
                            disabled={!draftPlan || !!draftPlan.error}
                            title={draftPlan?.error ?? "Strecke bauen"}
                            onClick={coasterBuild}
                          >
                            <Check size={16} />{" "}
                            {snapshot?.trackEdit ? "Umbau übernehmen" : "Strecke bauen"}
                            {(!snapshot?.trackEdit || (draftPlan && !draftPlan.error)) && (
                              <> · {EUR(draftPlan?.cost ?? trackCost(draft))}</>
                            )}
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
                                if (park.current?.trackEdit) {
                                  cancelTrackEdit(park.current);
                                  setWorldRevision((v) => v + 1);
                                  sync();
                                }
                                setDraft([]);
                              }}
                            >
                              {snapshot?.trackEdit ? "Umbau abbrechen" : "Verwerfen"}
                            </button>
                          </div>
                        </div>
                        <p className="buildnote">
                          {fitPreview
                            ? "Prüfe die Vorschau und wähle „Lösung übernehmen“. Rückgängig stellt die ursprüngliche Bahn wieder her."
                            : (draftPlan?.error ??
                              "Baustand gespeichert · Werkzeugwechsel jederzeit möglich.")}
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
                            {adjust.rotateOnly
                              ? "Ausrichtung ändern"
                              : adjust.mode === "station"
                                ? "Station versetzen"
                                : "Position anpassen"}
                          </h3>
                        </div>
                        <p className="small">
                          {adjust.rotateOnly
                            ? "Das Objekt bleibt an seinem Platz. Drehe die Vorschau in 90°-Schritten und übernimm die gewünschte Ausrichtung."
                            : adjust.mode === "station"
                              ? "Wähle ein grün markiertes Gleisfeld. Die Station braucht einen geraden, ebenen Abschnitt am Boden."
                              : "Bewege die Bahn über den Park. Ihre Station ist der Ankerpunkt. Die bisherige Position bleibt bis zur Bestätigung bestehen."}
                        </p>
                        {adjust.mode === "move" && supportsBuildingRotation(b.kind) && (
                          <button
                            className="secondary"
                            onClick={() =>
                              setAdjust((a) => (a ? { ...a, rotation: (a.rotation + 1) % 4 } : a))
                            }
                          >
                            <RotateCw size={16} /> Um 90° drehen <kbd>R</kbd> ·{" "}
                            {(((b.orientation ?? 0) + adjust.rotation) % 4) * 90}°
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
                          <Check size={16} />{" "}
                          {adjust.rotateOnly ? "Drehung übernehmen" : "Position übernehmen"}
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
                        {advice && !cut && (
                          <AttractionAdvisor
                            report={advice}
                            onAction={runAdvice}
                            onFocus={() => focusAttraction(b.id)}
                          />
                        )}
                        {b.kind === "coaster" ? (
                          <CarPreview className="detailhero" vehicle={vehicleFor(b)} />
                        ) : (
                          <img
                            className="detailhero"
                            src={assetUrl(CATALOG[b.kind].sprite)}
                            alt={b.name}
                          />
                        )}
                        <div
                          className={`statebadge ${(!reachable && !decorative(b.kind)) || !b.open ? "warn" : ""}`}
                        >
                          {!hasOperator(b)
                            ? "Geschlossen · Bedienpersonal fehlt"
                            : broken(b)
                              ? "Außer Betrieb · Reparatur nötig"
                              : isHabitat(b.kind) && habitatSafety(b).status === "closed"
                                ? "Sicherheitsstopp · Gehegebarriere warten lassen"
                                : isHabitat(b.kind) && !b.habitat?.count
                                  ? "Leeres Gehege · Tiere aufnehmen"
                                  : b.kind === "bin"
                                    ? `Mülleimer · ${b.binFill ?? 0} / 16 gefüllt · ${snapshot.staff} Reinigungskräfte`
                                    : b.kind === "keeperhut"
                                      ? reachable
                                        ? "Tierpflegerstation · Zoo-Team und Fachpersonal verwalten."
                                        : "Tierpflegerstation · Ein erreichbarer Parkweg fehlt."
                                      : decorative(b.kind)
                                        ? "Eine schöne Ecke für deine Besucher."
                                        : snapshot.trackEdit?.buildingId === b.id
                                          ? "Baustelle · Strecke unterbrochen"
                                          : !reachable
                                            ? isRide(b.kind)
                                              ? "Ein erreichbarer Weg oder eine Warteschlange fehlt am Eingang."
                                              : isHabitat(b.kind)
                                                ? "Ein normaler Besucherweg am Zaun fehlt."
                                                : "Ein erreichbarer Parkweg fehlt."
                                            : b.testing
                                              ? "Testfahrt läuft …"
                                              : !b.tested
                                                ? "Bereit für die Testfahrt."
                                                : b.open
                                                  ? isHabitat(b.kind)
                                                    ? "Geöffnet · Tiere vom Besucherweg beobachten."
                                                    : "Geöffnet · Besucher sind willkommen."
                                                  : "Geschlossen · Bereit zur Eröffnung."}
                        </div>
                        {isHabitat(b.kind) && connection && (
                          <HabitatVisitorPanel
                            park={snapshot}
                            building={b}
                            placing={tool === "viewpoint"}
                            plan={connection}
                            onPlace={() => {
                              setTool("viewpoint");
                              setPodEdit(null);
                              setCut(null);
                              setAdjust(null);
                              setMenuOpen(false);
                              notify(
                                "Wähle ein markiertes Feld außen am Zaun für den Beobachtungspunkt.",
                              );
                            }}
                            onClear={() =>
                              edit("Beobachtungspunkt entfernen", () => {
                                const live = park.current!.buildings.find(
                                  (item) => item.id === b.id,
                                )!;
                                notify(
                                  clearHabitatViewpoint(park.current!, live) ??
                                    "Besucher nutzen wieder alle verbundenen Wege am Zaun.",
                                );
                              })
                            }
                            onOpen={() =>
                              edit("Gehege verbinden und öffnen", () => {
                                const live = park.current!.buildings.find(
                                  (item) => item.id === b.id,
                                )!;
                                notify(
                                  connectBuilding(park.current!, live, autoClear) ??
                                    "Gehege geöffnet. Besucher können jetzt die Tiere beobachten.",
                                );
                              })
                            }
                          />
                        )}
                        {(isAttraction(b.kind) ||
                          (isTransport(b.kind) &&
                            snapshot.transitLines?.some((l) => l.a === b.id || l.b === b.id))) && (
                          <button
                            className="primary ride-launch"
                            disabled={snapshot.trackEdit?.buildingId === b.id}
                            onClick={() => {
                              const copy = structuredClone(park.current!);
                              rideActive.current = true;
                              setRide({
                                park: copy,
                                building: copy.buildings.find((x) => x.id === b.id)!,
                              });
                            }}
                          >
                            <Play size={18} />{" "}
                            {isHabitat(b.kind) ? "Tiere in 3D beobachten" : "3D-Mitfahren"}
                          </button>
                        )}
                        {isRide(b.kind) && (
                          <RideOperationsPanel
                            park={snapshot}
                            building={b}
                            onLocateStaff={locateStaff}
                            {...crewActions}
                            onRounds={(n) =>
                              edit("Fahrtprogramm ändern", () => {
                                const live = park.current!.buildings.find((x) => x.id === b.id)!;
                                const error = setRideRounds(live, n);
                                if (error) notify(error);
                              })
                            }
                          />
                        )}
                        {isAmenity(b.kind) && (
                          <section className="amenity-detail">
                            <h3>
                              {b.kind === "playground"
                                ? "Spielen & Entdecken"
                                : "Eine Pause im Park"}
                            </h3>
                            <p>{CATALOG[b.kind].description}</p>
                            <div className="controlrow">
                              <span>Gerade zu Besuch</span>
                              <strong>
                                {
                                  snapshot.guests.filter(
                                    (g) => g.target === b.id && g.state === "rest",
                                  ).length
                                }
                              </strong>
                            </div>
                            <p className="small">
                              {reachable
                                ? "Erreichbar über den Parkweg. Pausen verbessern Energie und Laune."
                                : "Baue einen normalen Parkweg direkt daneben."}
                            </p>
                          </section>
                        )}
                        {isHabitat(b.kind) && <div data-advisor-anchor="zoo" tabIndex={-1} />}
                        {isHabitat(b.kind) && (
                          <HabitatPanel
                            onManageStaff={() => {
                              setTab("personal");
                              setSettings(true);
                            }}
                            park={snapshot}
                            building={b}
                            onAction={(action) => {
                              const live = park.current!.buildings.find((x) => x.id === b.id)!;
                              let error: string | null = null;
                              if (action === "adopt") error = adoptAnimal(park.current!, live);
                              else if (action === "care")
                                error = careHabitat(park.current!, live, (s, b) => access(s, b));
                              else if (action === "rehome") {
                                if (live.habitat && live.habitat.count > 0) live.habitat.count--;
                                if (!live.habitat?.count) live.open = false;
                              } else if (action.startsWith("feature:")) {
                                error = addHabitatFeature(
                                  park.current!,
                                  live,
                                  action.slice(8) as HabitatFeatureId,
                                );
                              } else if (action === "electric-on" || action === "electric-off") {
                                error = setHabitatElectric(
                                  park.current!,
                                  live,
                                  action === "electric-on",
                                );
                              } else if (action === "inspect") {
                                error = inspectHabitat(park.current!, live);
                              } else if (action === "enrichment" || action === "shelter") {
                                error = upgradeHabitat(park.current!, live, action);
                              }
                              notify(
                                error ??
                                  (action === "adopt"
                                    ? "Ein neues Tier zieht ein. Prüfe Zugang und Tierpflege."
                                    : action === "rehome"
                                      ? "Ein Partnerzoo hat das Tier aufgenommen."
                                      : action.startsWith("feature:")
                                        ? "Neue Ausstattung eingebaut. Die Tiere können sie jetzt nutzen."
                                        : "Gehegeversorgung aktualisiert."),
                              );
                              sync();
                              return error;
                            }}
                          />
                        )}
                        {b.kind === "keeperhut" && (
                          <ZooOverview
                            onLocateStaff={locateStaff}
                            park={snapshot}
                            onAssignKeeper={(workerId, habitatId) => {
                              const error = assignZooKeeperToHabitat(
                                park.current!,
                                workerId,
                                habitatId,
                              );
                              sync();
                              return error;
                            }}
                            onSpecialists={(role, count) => {
                              const error = setZooSpecialists(park.current!, role, count);
                              sync();
                              return error;
                            }}
                            onBuild={(k) => pickTool(k, "zoo")}
                            onKeepers={(n) => {
                              initZoo(park.current!);
                              park.current!.zoo!.keepers = n;
                              initZoo(park.current!);
                              sync();
                            }}
                          />
                        )}
                        {isRide(b.kind) && (
                          <MaintenancePanel
                            park={snapshot}
                            building={b}
                            onLocateStaff={locateStaff}
                            onCommand={(action) => {
                              const error = action(park.current!);
                              sync();
                              if (error) notify(error);
                            }}
                          />
                        )}
                        <RideRetailPanel
                          park={snapshot}
                          building={b}
                          onCommand={(action) => {
                            const error = action(park.current!);
                            sync();
                            if (error) notify(error);
                          }}
                        />
                        {b.kind === "coaster" && (
                          <CoasterTrainPanel
                            key={b.id}
                            building={b}
                            onApply={(program) => {
                              const live = park.current!.buildings.find((q) => q.id === b.id)!;
                              const error = setCoasterTrainProgram(live, program);
                              sync();
                              notify(
                                error ??
                                  "Zugprogramm eingerichtet. Jeder Zug beachtet die Blocksignale.",
                              );
                            }}
                          />
                        )}
                        {isTransport(b.kind) && <div data-advisor-anchor="transit" tabIndex={-1} />}
                        {isTransport(b.kind) && (
                          <div className="transit-box">
                            <strong>
                              {b.kind === "train" ? "Parkbahnlinie" : "Shuttle-Verbindung"}
                            </strong>
                            {(() => {
                              const line = snapshot.transitLines?.find(
                                (l) => l.a === b.id || l.b === b.id,
                              );
                              if (line)
                                return (
                                  <>
                                    <span>
                                      {snapshot.buildings.find((x) => x.id === line.a)?.name} ↔{" "}
                                      {snapshot.buildings.find((x) => x.id === line.b)?.name}
                                    </span>
                                    <span>
                                      {Math.round((line.route.length - 1) * 5)} m ·{" "}
                                      {line.passengers.length}/{transportCapacity(line.kind)} an
                                      Bord · {line.served} Fahrgäste
                                    </span>
                                    <span>
                                      {line.fault ??
                                        (line.wait > 0
                                          ? "Halt · Ein- und Aussteigen"
                                          : "Fahrzeug unterwegs")}
                                    </span>
                                    <button
                                      className="secondary"
                                      onClick={() =>
                                        edit("Linienbetrieb", () => {
                                          const live = park.current!.transitLines!.find(
                                            (l) => l.id === line.id,
                                          )!;
                                          live.enabled = !live.enabled;
                                          tickTransit(park.current!, 0);
                                        })
                                      }
                                    >
                                      {line.enabled ? "Linie pausieren" : "Linie fortsetzen"}
                                    </button>
                                    <button
                                      className="secondary"
                                      disabled={!!repairTransitPlan(snapshot, line).error}
                                      onClick={() =>
                                        edit("Linie neu verbinden", () => {
                                          const live = park.current!.transitLines!.find(
                                            (l) => l.id === line.id,
                                          )!;
                                          notify(
                                            repairTransit(park.current!, live) ??
                                              "Verbindung neu berechnet. Die Fahrt beginnt am ersten Halt.",
                                          );
                                        })
                                      }
                                    >
                                      Route neu verbinden ·{" "}
                                      {EUR(repairTransitPlan(snapshot, line).cost)}
                                    </button>
                                    {repairTransitPlan(snapshot, line).error && (
                                      <span>{repairTransitPlan(snapshot, line).error}</span>
                                    )}
                                  </>
                                );
                              const stops = snapshot.buildings.filter(
                                (x) =>
                                  x.id !== b.id &&
                                  x.kind === b.kind &&
                                  !snapshot.transitLines?.some((l) => l.a === x.id || l.b === x.id),
                              );
                              return (
                                <>
                                  <p className="small">
                                    {stops.length
                                      ? "Wähle den zweiten Halt. Fahrzeuge benutzen die eingezeichneten Parkwege und halten an beiden Enden."
                                      : "Setze einen zweiten Halt dieses Typs mindestens fünf Wegfelder entfernt."}
                                  </p>
                                  {stops.map((stop) => {
                                    const plan = transitPlan(snapshot, b, stop);
                                    return (
                                      <div key={stop.id}>
                                        <button
                                          className="secondary"
                                          disabled={!!plan.error}
                                          onMouseEnter={() =>
                                            (view.current.connection = plan.route)
                                          }
                                          onMouseLeave={() => (view.current.connection = undefined)}
                                          onClick={() =>
                                            edit("Transportlinie", () => {
                                              const error = createTransitLine(
                                                park.current!,
                                                park.current!.buildings.find((x) => x.id === b.id)!,
                                                park.current!.buildings.find(
                                                  (x) => x.id === stop.id,
                                                )!,
                                              );
                                              notify(
                                                error ??
                                                  "Linie eröffnet. Gäste nutzen sie, wenn sie schneller als der Fußweg ist.",
                                              );
                                            })
                                          }
                                        >
                                          Mit {stop.name} ({stop.x}, {stop.y}) verbinden ·{" "}
                                          {EUR(plan.cost)}
                                        </button>
                                        {plan.error && <p className="small">{plan.error}</p>}
                                      </div>
                                    );
                                  })}
                                </>
                              );
                            })()}
                          </div>
                        )}
                        {b.kind === "coaster" && (
                          <VehicleCustomizer
                            building={b}
                            onApply={(vehicle) =>
                              edit("Wagendesign", () => {
                                const live = park.current!.buildings.find((x) => x.id === b.id)!;
                                live.vehicle = { ...vehicle };
                                notify(
                                  "Wagendesign übernommen. Farben gelten auch für die 3D-Mitfahrt.",
                                );
                              })
                            }
                          />
                        )}
                        {b.kind === "coaster" && (
                          <div className="track-edit-controls">
                            {snapshot.trackEdit ? (
                              <>
                                <p className="track-edit-notice">
                                  Eine Bahn ist im Umbau. Offene Gleise bleiben geschlossen.
                                </p>
                                <button className="primary" onClick={resumeEdit}>
                                  Baustelle fortsetzen
                                </button>
                              </>
                            ) : cut?.id === b.id ? (
                              <>
                                <h3>
                                  {sectionMode === "drive"
                                    ? "Streckenmodule"
                                    : sectionMode === "profile"
                                      ? "Fahrt spannender machen"
                                      : "Abschnitte entfernen"}
                                </h3>
                                <p className="small">
                                  {sectionMode === "drive"
                                    ? "Wähle einen Gleisbereich. Beschleuniger sind türkis, Bremsen orange markiert."
                                    : sectionMode === "profile"
                                      ? "Wähle einen Abschnitt. Umschalt + Klick erweitert ihn. Fertigprofile und Assistent zeigen die Wirkung vor dem Umbau."
                                      : "Mehrfachauswahl: Klicken markiert oder löst ein Teil. Ziehen über die Bahn markiert mehrere; Umschalt + Klick ergänzt einen Bereich. Rechts ziehen verschiebt die Kamera."}
                                </p>
                                <TrackRangeMap
                                  track={cutTrack}
                                  sections={sections}
                                  selected={sectionMode === "remove" ? marked : undefined}
                                  from={cut.from}
                                  to={cut.to}
                                  color={sectionMode === "drive" ? "#35bcb5" : "#e35c42"}
                                  onSelect={selectRange}
                                />
                                {sectionMode === "remove" && (
                                  <div className="selection-summary">
                                    <strong aria-live="polite">
                                      {marked.length}{" "}
                                      {marked.length === 1 ? "Teil markiert" : "Teile markiert"} ·{" "}
                                      {markedGroups.length}{" "}
                                      {markedGroups.length === 1 ? "Bereich" : "Bereiche"}
                                    </strong>
                                    <button
                                      className="secondary"
                                      disabled={!marked.length}
                                      onClick={() =>
                                        setCut({
                                          ...cut,
                                          marked: [],
                                          from: 0,
                                          to: 0,
                                          anchor: undefined,
                                        })
                                      }
                                    >
                                      Auswahl leeren
                                    </button>
                                  </div>
                                )}
                                <details className="range-details">
                                  <summary>Abschnitte gezielt auswählen</summary>
                                  <label>
                                    Von Abschnitt
                                    <select
                                      aria-label="Erster ausgewählter Abschnitt"
                                      value={cut.from}
                                      onChange={(e) =>
                                        setContiguousRange(
                                          +e.target.value,
                                          Math.max(cut.to, +e.target.value),
                                        )
                                      }
                                    >
                                      {sections.map((part, i) => (
                                        <option key={i} value={i}>
                                          {i + 1} · {part.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label>
                                    Bis Abschnitt
                                    <select
                                      aria-label="Letzter ausgewählter Abschnitt"
                                      value={cut.to}
                                      onChange={(e) =>
                                        setContiguousRange(cut.from, +e.target.value)
                                      }
                                    >
                                      {sections.map(
                                        (part, i) =>
                                          i >= cut.from && (
                                            <option key={i} value={i}>
                                              {i + 1} · {part.label}
                                            </option>
                                          ),
                                      )}
                                    </select>
                                  </label>
                                  {sectionMode === "remove" && (
                                    <div className="section-checklist">
                                      {sections.map((part, i) => (
                                        <label key={i}>
                                          <input
                                            type="checkbox"
                                            checked={marked.includes(i)}
                                            onChange={() => selectRange(i, false)}
                                          />
                                          {i + 1} · {part.label}
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </details>
                                {sectionMode === "profile" ? (
                                  <RideProfileAssistant
                                    park={snapshot}
                                    id={b.id}
                                    from={cut.from}
                                    to={cut.to}
                                    revision={worldRevision}
                                    clear={autoClear}
                                    onPreview={setProfilePreview}
                                    onApply={(plan) => {
                                      let commitError: string | null = null;
                                      edit("Fahrprofil verbessern", () => {
                                        const error = (commitError = commitRideProfile(
                                          park.current!,
                                          plan,
                                          autoClear,
                                        ));
                                        if (error) {
                                          notify(error);
                                          setProfilePreview(null);
                                          return;
                                        }
                                        setCut(null);
                                        setProfilePreview(null);
                                        notify(
                                          "Fahrprofil übernommen. Starte eine Testfahrt und öffne die Bahn wieder.",
                                        );
                                      });
                                      return commitError;
                                    }}
                                  />
                                ) : sectionMode === "drive" ? (
                                  <>
                                    <div className="build-modes">
                                      <button
                                        className={drive.kind === "boost" ? "active" : ""}
                                        onClick={() =>
                                          setDrive({
                                            ...drive,
                                            kind: "boost",
                                            speed: drive.kind === "boost" ? drive.speed : 60,
                                          })
                                        }
                                      >
                                        <Zap size={16} /> Beschleuniger
                                      </button>
                                      <button
                                        className={drive.kind === "brake" ? "active" : ""}
                                        onClick={() =>
                                          setDrive({
                                            ...drive,
                                            kind: "brake",
                                            speed: drive.kind === "brake" ? drive.speed : 15,
                                          })
                                        }
                                      >
                                        <OctagonPause size={16} /> Bremse
                                      </button>
                                    </div>
                                    <label>
                                      Zieltempo · {drive.speed} km/h
                                      <input
                                        aria-label="Zieltempo des Streckenmoduls"
                                        type="range"
                                        min="5"
                                        max={
                                          b.track?.[0]?.style === "wood"
                                            ? 68
                                            : b.track?.[0]?.style === "launch"
                                              ? 93
                                              : 82
                                        }
                                        value={drive.speed}
                                        onChange={(e) =>
                                          setDrive({ ...drive, speed: +e.target.value })
                                        }
                                      />
                                    </label>
                                    <label>
                                      Stärke · {drive.strength} m/s²
                                      <input
                                        aria-label="Stärke des Streckenmoduls"
                                        type="range"
                                        min="0.5"
                                        max="12"
                                        step="0.5"
                                        value={drive.strength}
                                        onChange={(e) =>
                                          setDrive({ ...drive, strength: +e.target.value })
                                        }
                                      />
                                    </label>
                                    <p className="small">
                                      Wirkt nur auf dem markierten Gleis. Das erreichbare Tempo
                                      hängt von Länge, Steigung und der nächsten Bremse ab. Die
                                      Stationsbremse bleibt aktiv.
                                    </p>
                                    <button
                                      className="primary"
                                      disabled={
                                        !!modulePlan?.error ||
                                        !modulePlan?.changed ||
                                        (modulePlan?.cost ?? 0) > (snapshot?.cash ?? 0)
                                      }
                                      onClick={() => mountDrive(drive)}
                                    >
                                      {removeModulePlan?.changed
                                        ? "Änderungen übernehmen"
                                        : "Modul montieren"}{" "}
                                      · {EUR(modulePlan?.cost ?? 0)}
                                    </button>
                                    <button
                                      className="secondary"
                                      disabled={!removeModulePlan?.changed}
                                      onClick={() => mountDrive(null)}
                                    >
                                      Module im Bereich entfernen
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <p className="small">
                                      Rot: zu entfernende Teile. Die Vorschau zeigt neue
                                      Verbindungen in Türkis. Nicht markierte Gleise und die Station
                                      bleiben erhalten.
                                    </p>
                                    <button
                                      className="primary"
                                      disabled={!marked.length}
                                      onClick={previewRemoval}
                                    >
                                      Verbindungen vorschauen
                                    </button>
                                    {removalPreview && (
                                      <div
                                        className={`removal-preview ${removalPreview.error ? "error" : ""}`}
                                        role="status"
                                      >
                                        {removalPreview.error ? (
                                          <p>{removalPreview.error}</p>
                                        ) : (
                                          <>
                                            <strong>
                                              {marked.length}{" "}
                                              {marked.length === 1
                                                ? "Teil entfernen"
                                                : "Teile entfernen"}{" "}
                                              · {EUR(removalPreview.cost)}
                                            </strong>
                                            <p>
                                              {markedGroups.length}{" "}
                                              {markedGroups.length === 1
                                                ? "Lücke wird"
                                                : "Lücken werden"}{" "}
                                              mit neuen Gleisen geschlossen. Gerade Verbindungen
                                              können dem bisherigen Verlauf entsprechen.
                                            </p>
                                            <button
                                              className="primary cut-confirm"
                                              disabled={!canAfford(snapshot, removalPreview.cost)}
                                              onClick={commitRemoval}
                                            >
                                              <Eraser size={16} /> Entfernen & Lücken verbinden
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}
                                    <button
                                      className="secondary"
                                      disabled={markedGroups.length !== 1}
                                      onClick={removeSections}
                                    >
                                      Auswahl durch Fertigteile ersetzen
                                    </button>
                                    <button
                                      className="secondary"
                                      disabled={markedGroups.length !== 1}
                                      onClick={() => {
                                        setSectionMode("profile");
                                        setCut({
                                          id: b.id,
                                          from: markedGroups[0].from,
                                          to: markedGroups[0].to,
                                        });
                                      }}
                                    >
                                      Fahrprofil für die Auswahl
                                    </button>
                                    {markedGroups.length > 1 && (
                                      <p className="small">
                                        Für Loopings oder andere Fertigteile wählst du einen
                                        zusammenhängenden Bereich.
                                      </p>
                                    )}
                                  </>
                                )}
                                <button className="secondary" onClick={() => setCut(null)}>
                                  Auswahl abbrechen
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="primary"
                                  onClick={() => {
                                    setSectionMode("profile");
                                    setCut({
                                      id: b.id,
                                      from: Math.min(2, sections.length - 1),
                                      to: Math.min(4, sections.length - 1),
                                    });
                                    setTool("select");
                                  }}
                                >
                                  <WandSparkles size={17} /> Fahrt spannender machen
                                </button>
                                <button className="secondary" onClick={() => openSections(b)}>
                                  <Eraser size={16} /> Gleise ersetzen / entfernen
                                </button>
                                <button
                                  className="secondary"
                                  onClick={() => {
                                    setSectionMode("drive");
                                    setCut({
                                      id: b.id,
                                      from:
                                        driveGroups[0]?.from ??
                                        Math.min(1, driveSections(cutTrack).length - 1),
                                      to:
                                        driveGroups[0]?.to ??
                                        Math.min(1, driveSections(cutTrack).length - 1),
                                    });
                                    setTool("select");
                                  }}
                                >
                                  <Zap size={16} /> Beschleuniger & Bremsen
                                </button>
                              </>
                            )}
                          </div>
                        )}
                        {b.kind === "coaster" && !snapshot.trackEdit && !cut && (
                          <div className="module-list">
                            <h3>Montierte Module · {driveGroups.length}</h3>
                            {!driveGroups.length && (
                              <p className="small">
                                Noch keine Module montiert. Unter „Beschleuniger & Bremsen“ wählst
                                du ein Gleisstück.
                              </p>
                            )}
                            {driveGroups.map((group, i) => (
                              <div
                                className={`module-card ${group.drive.kind}`}
                                key={`${group.from}-${group.to}`}
                              >
                                <strong>
                                  {group.drive.kind === "boost" ? "Beschleuniger" : "Bremse"}{" "}
                                  {i + 1}
                                </strong>
                                <span>
                                  {group.drive.speed} km/h · {group.drive.strength} m/s² ·{" "}
                                  {Math.round(group.length)} m
                                </span>
                                <div>
                                  <button
                                    className="secondary"
                                    onClick={() => {
                                      setSectionMode("drive");
                                      setDrive({ ...group.drive });
                                      setCut({ id: b.id, from: group.from, to: group.to });
                                      setTool("select");
                                    }}
                                  >
                                    Bearbeiten
                                  </button>
                                  <button
                                    className="secondary"
                                    onClick={() =>
                                      mountDrive(null, { id: b.id, from: group.from, to: group.to })
                                    }
                                  >
                                    Entfernen
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {b.kind === "coaster" && b.track && !snapshot.trackEdit && (
                          <section className="photo-control">
                            <h3>Streckenfoto · Lichtschranke</h3>
                            <p className="small">
                              Setze den Foto-Laser auf deinen gewählten Streckenabschnitt oder
                              verschiebe ihn entlang der Bahn. In der 3D-Mitfahrt entsteht beim
                              Passieren ein herunterladbares Foto.
                            </p>
                            {b.photoPoint !== undefined ? (
                              <>
                                <label className="controlrow">
                                  Fotopunkt{" "}
                                  <strong>{Math.round(b.photoPoint * 100)} % der Strecke</strong>
                                </label>
                                <input
                                  aria-label="Position des Foto-Lasers"
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={Math.round(b.photoPoint * 100)}
                                  onChange={(e) =>
                                    edit("Foto-Laser verschieben", () => {
                                      const live = park.current!.buildings.find(
                                        (x) => x.id === b.id,
                                      )!;
                                      live.photoPoint = Number(e.target.value) / 100;
                                    })
                                  }
                                />
                                <button
                                  className="secondary"
                                  onClick={() =>
                                    edit("Foto-Laser entfernen", () => {
                                      delete park.current!.buildings.find((x) => x.id === b.id)!
                                        .photoPoint;
                                    })
                                  }
                                >
                                  Foto-Laser entfernen
                                </button>
                              </>
                            ) : (
                              <button
                                className="primary"
                                disabled={!canAfford(snapshot, 180)}
                                onClick={() =>
                                  edit("Foto-Laser montieren", () => {
                                    const live = park.current!.buildings.find(
                                      (x) => x.id === b.id,
                                    )!;
                                    if (!canAfford(park.current!, 180)) return;
                                    const track = editableTrack(live),
                                      point =
                                        cut?.id === b.id
                                          ? track[Math.floor((cut.from + cut.to) / 2)]
                                          : null;
                                    live.photoPoint = point
                                      ? (closestPhotoPoint(makeRidePath(live.track!), {
                                          x: point.x * 5,
                                          y: (point.z ?? 0) * 5 + 1.1,
                                          z: point.y * 5,
                                        })?.u ?? 0.5)
                                      : 0.5;
                                    spendCash(park.current!, 180);
                                    park.current!.expenses += 180;
                                    park.current!.dayExpenses += 180;
                                    notify(
                                      "Foto-Laser montiert. Du kannst den Fotopunkt jederzeit verschieben.",
                                    );
                                  })
                                }
                              >
                                Foto-Laser {cut?.id === b.id ? "auf Auswahl " : ""}montieren · 180 €
                              </button>
                            )}
                          </section>
                        )}
                        {b.kind === "coaster" && b.track && !snapshot.trackEdit && (
                          <section className="station-direction-panel">
                            <h3>Station & Abfahrt</h3>
                            <p className="small">
                              Aktuelle Richtung: {stationOrientation(b)?.direction}. Eine Umkehr
                              dreht den Zug und die Abfahrt um 180°. Danach ist eine neue Testfahrt
                              nötig.
                            </p>
                            <button
                              className="secondary"
                              onMouseEnter={() => {
                                const plan = planStationReverse(snapshot, b);
                                if (!plan.error)
                                  view.current.stationDirection = { ...b, ...plan.geometry };
                              }}
                              onMouseLeave={() => {
                                view.current.stationDirection = undefined;
                              }}
                              onClick={() =>
                                edit("Station drehen · Fahrtrichtung umkehren", () => {
                                  const live = park.current!.buildings.find((x) => x.id === b.id)!;
                                  const plan = planStationReverse(park.current!, live);
                                  notify(
                                    plan.error ??
                                      commitStationReverse(park.current!, plan) ??
                                      "Station um 180° gedreht. Starte eine neue Testfahrt.",
                                  );
                                  view.current.stationDirection = undefined;
                                })
                              }
                            >
                              <RotateCw size={16} />
                              Station um 180° drehen
                            </button>
                            <p className="small">
                              Die Fußgängerpods bleiben an ihren Wegen. Für 90° nutze „Bahn
                              verschieben / drehen“ – dabei dreht sich die ganze Strecke.
                            </p>
                          </section>
                        )}
                        <div className="adjust-actions">
                          {b.kind === "coaster" && (
                            <button
                              className="secondary"
                              disabled={!!snapshot.trackEdit}
                              onClick={() => startAdjustment("station")}
                            >
                              <MapPin size={16} /> Station versetzen
                            </button>
                          )}
                          <button
                            className="secondary"
                            disabled={!!snapshot.trackEdit}
                            onClick={() => startAdjustment("move")}
                          >
                            <Move size={16} />{" "}
                            {b.kind === "coaster"
                              ? "Bahn verschieben / drehen"
                              : "Gebäude versetzen"}
                          </button>
                        </div>
                        {directAccess && (
                          <p className="direct-access">
                            <Check size={14} /> Direktzugang · {b.sharedAccess ? 2 : 4} Warteplätze.
                            Eine eigene Warteschlange schafft mehr Platz.
                          </p>
                        )}
                        {usesPods(b.kind) &&
                          (() => {
                            const pods = effectivePods(snapshot, b),
                              size = CATALOG[b.kind].size;
                            const outgoing = exitPath(snapshot, b);
                            const exitProposal =
                              !b.sharedAccess && !outgoing.length
                                ? suggestExit(snapshot, b, autoClear)
                                : null;
                            return (
                              <div className="pod-controls" tabIndex={-1}>
                                <h3>Ein- & Ausgangspods</h3>
                                {needsOperator(b.kind) && (
                                  <SharedAccessControl
                                    park={snapshot}
                                    building={b}
                                    onBuildPath={() => pickTool("queue", "paths")}
                                    onChange={(enabled) => {
                                      if (enabled === !!b.sharedAccess) return;
                                      edit(
                                        enabled
                                          ? "Ein- und Ausgang zusammenlegen"
                                          : "Ein- und Ausgang trennen",
                                        () => {
                                          const live = park.current!.buildings.find(
                                            (item) => item.id === b.id,
                                          )!;
                                          const error = setSharedAccess(
                                            park.current!,
                                            live,
                                            enabled,
                                          );
                                          if (!error) {
                                            setPodEdit(null);
                                            setTool("select");
                                            view.current.connection = undefined;
                                          }
                                          notify(
                                            error ??
                                              (enabled
                                                ? "Ein gemeinsamer Pod mit roter Auslass- und blauer Einlassspur. Baue den Anschluss mit Eingangswegen."
                                                : "Ein- und Ausgang sind wieder getrennt. Prüfe die beiden Weganschlüsse."),
                                          );
                                        },
                                      );
                                    }}
                                    onClose={() =>
                                      edit("Attraktion für Zugangsumbau schließen", () => {
                                        const live = park.current!.buildings.find(
                                          (item) => item.id === b.id,
                                        )!;
                                        live.open = false;
                                        live.autoOpen = false;
                                        notify(
                                          "Geschlossen. Lass die Gäste aussteigen; danach kannst du die Zugangsart umstellen.",
                                        );
                                      })
                                    }
                                  />
                                )}
                                <p className="small">
                                  {b.sharedAccess ? (
                                    "Verbinde den gemeinsamen Pod mit blauen Eingangswegen zum Parkweg. Der Anschluss teilt sich automatisch in eine blaue Einlass- und rote Auslassspur."
                                  ) : (
                                    <>
                                      Die Häuschen sitzen am Rand. Verbinde das Feld direkt vor dem
                                      blauen Pod mit dem Eingangsweg und vor dem roten Pod mit dem
                                      Ausgangsweg.
                                    </>
                                  )}
                                </p>
                                {(b.sharedAccess
                                  ? (["entry"] as const)
                                  : (["entry", "exit"] as const)
                                ).map((role) => {
                                  const pod = pods[role],
                                    port = podPort(b, size, pod),
                                    ok = role === "entry" ? !!reachable : !!outgoing.length;
                                  return (
                                    <div
                                      className={`pod-card ${b.sharedAccess ? "shared" : role}`}
                                      key={role}
                                    >
                                      <strong>
                                        {role === "entry" ? (
                                          <LogIn size={17} />
                                        ) : (
                                          <LogOut size={17} />
                                        )}{" "}
                                        {b.sharedAccess
                                          ? "Gemeinsamer Pod"
                                          : role === "entry"
                                            ? "Eingangspod"
                                            : "Ausgangspod"}
                                      </strong>
                                      <span>
                                        {POD_SIDES[pod.side]} {size > 1 ? pod.offset + 1 : ""} ·
                                        Anschluss ({port.x}, {port.y})
                                      </span>
                                      <small>
                                        {ok
                                          ? "Weg verbunden"
                                          : role === "entry"
                                            ? "Eingangsweg fehlt"
                                            : "Ausgangsweg fehlt · bisheriger Zugang bleibt nutzbar"}
                                      </small>
                                      <div>
                                        <button
                                          className="secondary"
                                          disabled={!!snapshot.trackEdit}
                                          onClick={() => beginPod(b, role)}
                                        >
                                          Pod versetzen
                                        </button>
                                        <button
                                          className="secondary"
                                          onClick={() =>
                                            pickTool(role === "entry" ? "queue" : "exit", "paths")
                                          }
                                        >
                                          {b.sharedAccess ? "Geteilten Weg bauen" : "Weg bauen"}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                                {!b.sharedAccess && !outgoing.length && (
                                  <div className="exit-suggestion">
                                    <strong>Ausgang automatisch verbinden</strong>
                                    {exitProposal ? (
                                      <>
                                        <p className="small">
                                          {POD_SIDES[exitProposal.pod.side]}{" "}
                                          {exitProposal.pod.offset + 1} ·{" "}
                                          {
                                            exitProposal.points.filter(
                                              (p) => snapshot.tiles[p.y][p.x] !== "exit",
                                            ).length
                                          }{" "}
                                          rote Wegfelder · {EUR(exitProposal.cost)}
                                        </p>
                                        <button
                                          className="primary"
                                          disabled={!canAfford(snapshot, exitProposal.cost)}
                                          onMouseEnter={() => {
                                            view.current.connection = exitProposal.points;
                                          }}
                                          onMouseLeave={() => {
                                            view.current.connection = undefined;
                                          }}
                                          onClick={() =>
                                            edit("Ausgang automatisch verbinden", () => {
                                              const live = park.current!.buildings.find(
                                                (item) => item.id === b.id,
                                              )!;
                                              notify(
                                                applyExitSuggestion(
                                                  park.current!,
                                                  live,
                                                  exitProposal,
                                                  autoClear,
                                                ) ??
                                                  "Ausgang mit dem Parkweg verbunden. Du kannst die Attraktion wieder öffnen.",
                                              );
                                            })
                                          }
                                        >
                                          Vorschlag übernehmen · {EUR(exitProposal.cost)}
                                        </button>
                                      </>
                                    ) : (
                                      <p className="small">
                                        Kein freier Weg gefunden. Baue einen Parkweg näher an die
                                        Station oder versetze sie.
                                      </p>
                                    )}
                                  </div>
                                )}
                                {podEdit?.id === b.id && (
                                  <div className="pod-position-picker">
                                    <strong>
                                      {podEdit.role === "entry" ? "Eingangs" : "Ausgangs"}pod
                                      platzieren
                                    </strong>
                                    <p className="small">
                                      Klicke ein markiertes Anschlussfeld im Park oder wähle hier
                                      eine Randposition.
                                    </p>
                                    <div className="pod-slot-grid">
                                      {podSlots(size).map((slot) => {
                                        const plan = planPod(
                                            snapshot,
                                            b,
                                            podEdit.role,
                                            slot,
                                            autoClear,
                                          ),
                                          port = podPort(b, size, slot);
                                        return (
                                          <button
                                            key={`${slot.side}-${slot.offset}`}
                                            className={
                                              samePod(slot, pods[podEdit.role]) ? "active" : ""
                                            }
                                            disabled={!!plan.error}
                                            title={plan.error ?? `Anschluss (${port.x}, ${port.y})`}
                                            onClick={() => applyPod(b, podEdit.role, slot)}
                                          >
                                            {POD_SIDES[slot.side]} {size > 1 ? slot.offset + 1 : ""}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <button
                                      className="secondary"
                                      onClick={() => {
                                        setPodEdit(null);
                                        setTool("select");
                                      }}
                                    >
                                      Platzierung abbrechen
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        {connection && (!reachable || !b.open) && (
                          <div className="connect-action">
                            <button
                              className="primary"
                              disabled={
                                snapshot.trackEdit?.buildingId === b.id ||
                                broken(b) ||
                                (isHabitat(b.kind) && !b.habitat?.count) ||
                                !!connection.error ||
                                (!!b.autoOpen && !!reachable)
                              }
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
                                  ? isHabitat(b.kind)
                                    ? "Der Besucherweg am Zaun wird verwendet. Keine Baukosten."
                                    : "Vorhandener Zugang wird verwendet. Keine Baukosten."
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
                              <button
                                className="secondary"
                                onClick={() => pickTool("path", "paths")}
                              >
                                <Route size={16} /> Parkweg selbst bauen
                              </button>
                            )}
                          </div>
                        )}
                        {!decorative(b.kind) && (
                          <>
                            {isHabitat(b.kind) ? (
                              <>
                                <div className="detailstats">
                                  <div>
                                    <span>Tierbeobachtungen</span>
                                    <strong>{b.served}</strong>
                                  </div>
                                  <div>
                                    <span>Gäste am Zaun</span>
                                    <strong>
                                      {
                                        snapshot.guests.filter(
                                          (g) => g.target === b.id && g.state === "observe",
                                        ).length
                                      }
                                    </strong>
                                  </div>
                                </div>
                                <p className="direct-access">
                                  {habitatViewingSpots(snapshot, b).length} erreichbare Wegfelder am
                                  Zaun
                                </p>
                                <p className="small">
                                  Normale Parkwege an jeder Zaunseite ermöglichen den Blick ins
                                  Gehege. Gäste bleiben draußen und beobachten die Tiere ohne
                                  Warteschlange. Der Besuch ist im Parkeintritt enthalten.
                                </p>
                                <button
                                  className="secondary"
                                  onClick={() => pickTool("path", "paths")}
                                >
                                  <Route size={16} /> Besucherweg am Zaun bauen
                                </button>
                              </>
                            ) : (
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
                                <div
                                  className="controlrow"
                                  data-advisor-anchor="price"
                                  tabIndex={-1}
                                >
                                  <span>
                                    {isTransport(b.kind) ? "Fahrpreis" : "Preis pro Besuch"}
                                  </span>
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
                                      {b.queue.length} /{" "}
                                      {isAttraction(b.kind)
                                        ? queueCapacity(snapshot, b)
                                        : isTransport(b.kind)
                                          ? 16
                                          : 6}{" "}
                                      {!isTransport(b.kind) && `· ~${Math.ceil(expectedWait(b))} s`}
                                    </strong>
                                  </div>
                                )}
                              </>
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
                                    disabled={
                                      snapshot.trackEdit?.buildingId === b.id ||
                                      !!b.testing ||
                                      broken(b)
                                    }
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
                                disabled={
                                  snapshot.trackEdit?.buildingId === b.id ||
                                  (!b.open && (!reachable || !b.tested))
                                }
                                onClick={() => changeBuilding((b) => (b.open = !b.open))}
                              >
                                {b.open ? <Pause size={16} /> : <Play size={16} />}{" "}
                                {b.open
                                  ? isHabitat(b.kind)
                                    ? "Gehege schließen"
                                    : "Attraktion schließen"
                                  : "Jetzt eröffnen"}
                              </button>
                            )}
                          </>
                        )}
                        <button
                          className="secondary"
                          disabled={isHabitat(b.kind) && (b.habitat?.count ?? 0) > 0}
                          title={
                            isHabitat(b.kind) && (b.habitat?.count ?? 0) > 0
                              ? "Gib die Tiere vor dem Abriss an einen Partnerzoo ab."
                              : undefined
                          }
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
                {category === "analysis" && snapshot && (
                  <>
                    {traffic && (
                      <ParkTrafficPanel
                        report={traffic}
                        mode={trafficMode}
                        selected={selectedTraffic}
                        onMode={(mode) => {
                          setTrafficMode(mode);
                          setTool("select");
                          setSelected(null);
                          setCut(null);
                          setPodEdit(null);
                          setAdjust(null);
                        }}
                        onZone={(zone) => inspectTrafficZone(zone)}
                        onFocusBuilding={(id) => {
                          const row = traffic.buildings.find((b) => b.id === id);
                          if (row) {
                            setTrafficPoint(row.point);
                            focusMapPoint(row.point);
                          }
                        }}
                        onInspect={(id) => {
                          setTrafficMode(null);
                          setSelected(id);
                          setCategory("detail");
                          setTool("select");
                        }}
                      />
                    )}
                    <VisitorAudiencePanel park={snapshot} />
                    <details className="traffic-care-details">
                      <summary>Sauberkeit & Handlungsempfehlungen</summary>
                      <ParkAnalysis
                        park={snapshot}
                        moods={showMoods}
                        onMoods={setShowMoods}
                        onFocus={(issue) => {
                          const el = canvas.current;
                          if (!el) return;
                          const v = view.current,
                            p = projection(el.clientWidth, el.clientHeight, v).project(
                              issue.point.x,
                              issue.point.y,
                            );
                          cameraTarget.current = {
                            zoom: v.zoom,
                            panX: v.panX + el.clientWidth * 0.61 - p.x,
                            panY: v.panY + el.clientHeight * 0.5 - p.y,
                          };
                        }}
                        onBin={() => pickTool("bin", "shops")}
                        onStaff={() => {
                          setTab("personal");
                          setSettings(true);
                        }}
                        onInspect={(id) => {
                          setTrafficMode(null);
                          setSelected(id);
                          setCategory("detail");
                          setTool("select");
                        }}
                        onRide={(id) => {
                          setTrafficMode(null);
                          setSelected(id);
                          setCategory("detail");
                          setTool("select");
                          setSectionMode("profile");
                          setCut({ id, from: 1, to: 3 });
                        }}
                      />
                    </details>
                  </>
                )}
                {category === "guests" && snapshot && <VisitorPanel park={snapshot} />}
              </div>
            </aside>
          )}
        <aside
          key={snapshot?.scenario}
          className={`objective ${areaEditor ? "area-hidden" : ""} ${showGoals ? "show-goals" : ""} ${tool !== "select" ? "while-building" : ""}`}
        >
          <div className="eyebrow">
            <Flag /> {snapshot?.mode === "sandbox" ? "Freies Spiel" : "Dein nächstes Ziel"}
            {showGoals && (
              <button
                className="iconbtn"
                aria-label={
                  snapshot?.mode === "sandbox"
                    ? "Freispielhinweise schließen"
                    : "Kampagnenziele schließen"
                }
                onClick={() => setShowGoals(false)}
              >
                <X size={16} />
              </button>
            )}
          </div>
          {snapshot?.mode === "sandbox" ? (
            <>
              <h3>Dein Park. Deine Regeln.</h3>
              <p>
                Alle Attraktionen, Tiere und Forschungsprojekte sind freigeschaltet. Es gibt keine
                Kampagnenziele.
              </p>
              {hasUnlimitedBudget(snapshot) && (
                <p>∞ Unbegrenztes Baubudget. Gestalte deinen Freizeitpark, Zoo oder beides.</p>
              )}
              {!snapshot.open && (
                <button
                  className="primary"
                  onClick={() => {
                    park.current!.open = true;
                    sync();
                  }}
                >
                  Park für Gäste öffnen
                </button>
              )}
              <button className="secondary" onClick={() => pickTool("select", "rides")}>
                Attraktionen entdecken
              </button>
            </>
          ) : (
            <>
              <h3>{snapshot?.won ? "Ein Publikumsliebling!" : goal.subtitle}</h3>
              {snapshot && !snapshot.open && (
                <button
                  className="primary"
                  onClick={() => {
                    park.current!.open = true;
                    sync();
                    notify(
                      "Park geöffnet. Erreichbare, geöffnete Attraktionen ziehen neue Gäste an.",
                    );
                  }}
                >
                  Park für Gäste öffnen
                </button>
              )}
              {snapshot?.customScenario && !snapshot.won && (
                <div className={customScenarioExpired(snapshot) ? "warning" : "info"} role="status">
                  {customScenarioExpired(snapshot)
                    ? "Zeitlimit erreicht. Du kannst weiterbauen oder das Szenario erneut starten."
                    : customScenarioTimeLeft(snapshot) === null
                      ? "Eigene Herausforderung · ohne Zeitlimit"
                      : `Zeit bis zum Ziel: ${Math.ceil(customScenarioTimeLeft(snapshot)! / 60)} Spielminuten`}
                </div>
              )}
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
              {goal.rides > 0 && (
                <>
                  <div className="goalrow">
                    <span>Attraktionen eröffnen</span>
                    <b>
                      {Math.min(goal.rides, readyRides)} / {goal.rides}
                    </b>
                  </div>
                  <div className="progressrail">
                    <div style={{ width: Math.min(100, (readyRides / goal.rides) * 100) + "%" }} />
                  </div>
                </>
              )}
              <div className="goalrow">
                <span>Zufriedenheit</span>
                <b>
                  {snapshot?.rating ?? 80} / {goal.rating} %
                </b>
              </div>
              {goal.cleanliness > 0 && (
                <div className="goalrow">
                  <span>Sauberkeit</span>
                  <b>
                    {snapshot ? cleanlinessScore(snapshot) : 100} / {goal.cleanliness}%
                  </b>
                </div>
              )}
              {goal.condition > 0 && (
                <div className="goalrow">
                  <span>Zustand der Fahrgeschäfte</span>
                  <b>
                    {snapshot ? maintenanceScore(snapshot) : 100} / {goal.condition}%
                  </b>
                </div>
              )}
              {goal.species > 0 && (
                <>
                  <div className="goalrow">
                    <span>Gesunde Arten geöffnet</span>
                    <b>
                      {snapshot ? zooStats(snapshot).healthyOpen : 0} / {goal.species}
                    </b>
                  </div>
                  <div className="goalrow">
                    <span>Tierwohl</span>
                    <b>
                      {snapshot ? zooStats(snapshot).welfare : 100} / {goal.welfare}%
                    </b>
                  </div>
                </>
              )}
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
                  <span>Betriebsgewinn / 90 s</span>
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
              <div className="reward">
                <Trophy />{" "}
                {snapshot?.won
                  ? "Ziel erreicht – baue weiter!"
                  : "Erreiche alle Ziele und entdecke weitere Szenarien."}
              </div>
            </>
          )}
        </aside>
        {tool !== "select" && !(tool === "coaster" && !blueprintMode) && (
          <div className={`build-status ${placement?.error ? "invalid" : ""}`} aria-live="polite">
            <div>
              <strong>
                {tool === "terrain" && terrainFeedback
                  ? (terrainFeedback.error ??
                    `${terrainSettings.mode === "terrain" ? "Gelände ändern" : terrainSettings.erase ? "Höhenweg entfernen" : "Höhenweg bauen"} · ${EUR(terrainSettings.erase ? 0 : terrainFeedback.cost)}`)
                  : tool === "viewpoint"
                    ? "Beobachtungspunkt am Zaun platzieren"
                    : podEdit
                      ? `${podEdit.role === "entry" ? "Eingangs" : "Ausgangs"}pod versetzen`
                      : (placement?.error ??
                        (adjust
                          ? `${adjust.rotateOnly ? "Ausrichtung ändern" : adjust.mode === "station" ? "Station versetzen" : "Position anpassen"} · ${EUR(placement?.cost ?? 0)}`
                          : placement
                            ? `${tool === "erase" ? "Abreißen" : tool === "coaster" ? COASTER_TYPES[coasterType].name : (CATALOG[tool as Kind]?.name ?? (tool === "path" ? "Parkweg" : tool === "queue" ? "Eingangsweg (blau)" : tool === "exit" ? "Ausgangsweg (rot)" : "Wasser"))} · ${EUR(placement.cost)}`
                            : "Bewege den Zeiger auf den Bauplatz"))}
              </strong>
              <span>
                {podEdit
                  ? "Farbiges Anschlussfeld am Rand wählen · Klick versetzt den Pod · Esc beendet"
                  : (placement?.warning ??
                    (adjust
                      ? adjust.mode === "station"
                        ? "Grünes Gleisfeld wählen · Klick übernimmt · Esc beendet"
                        : "Klick übernimmt · R dreht · Esc beendet"
                      : tool === "coaster" && blueprintMode
                        ? "Klick baut · R dreht · Esc beendet"
                        : ["path", "queue", "exit", "water", "erase", "scenery"].includes(tool)
                          ? "Ziehen baut mehrere Felder · Strg/⌘ Z nimmt den Bauzug zurück"
                          : tool === "coaster"
                            ? "Bauteil im Baufenster wählen · Klick ergänzt · Esc beendet"
                            : "Klick baut · Shift für mehrere · Esc beendet"))}
              </span>
            </div>
            {exitHelp && (
              <div className="exit-build-help">
                <strong>{exitHelp.name}: Anschluss finden</strong>
                <span>
                  {exitHelp.proposal
                    ? `${exitHelp.proposal.moved ? "Pod an eine freie Seite versetzen. " : "Pod bleibt an seinem Platz. "}${exitHelp.proposal.underpass.length ? "Der Weg führt unter ausreichend hohen Gleisen hindurch." : "Rote Wege verbinden den Ausgang mit dem Parkweg."}`
                    : "Hier fehlt Platz. Versetze den Pod an eine andere Seite oder ziehe einen Parkweg näher heran."}
                </span>
                {exitHelp.proposal ? (
                  <button
                    className="secondary"
                    disabled={!snapshot || !canAfford(snapshot, exitHelp.proposal.cost)}
                    onMouseEnter={() => {
                      view.current.connection = exitHelp.proposal!.points;
                    }}
                    onMouseLeave={() => {
                      view.current.connection = undefined;
                    }}
                    onClick={() => {
                      const help = exitHelp;
                      edit("Ausgang automatisch verbinden", () => {
                        const live = park.current?.buildings.find((b) => b.id === help.buildingId);
                        if (!live || !park.current) return;
                        const error = applyExitSuggestion(
                          park.current,
                          live,
                          help.proposal!,
                          autoClear,
                        );
                        notify(error ?? "Ausgang verbunden. Der neue Weg ist bereit.");
                        if (!error) {
                          setExitHelpPoint(null);
                          view.current.connection = undefined;
                        }
                      });
                    }}
                  >
                    <Route size={16} />
                    Lösung bauen · {EUR(exitHelp.proposal.cost)}
                  </button>
                ) : (
                  <button
                    className="secondary"
                    onClick={() => {
                      const b = park.current?.buildings.find((b) => b.id === exitHelp.buildingId);
                      if (b) {
                        selectAttraction(b.id);
                        beginPod(b, "exit");
                      }
                    }}
                  >
                    Ausgangspod anpassen
                  </button>
                )}
              </div>
            )}
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
          <ParkCalendar park={snapshot} />
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
        <ParkMenu
          open={menuOpen}
          setOpen={setMenuOpen}
          actions={[
            ...categories
              .filter((c) => c.id !== "erase")
              .map(({ id, label, Icon }) => ({
                id,
                label,
                Icon,
                active: category === id,
                run: () => {
                  if (id === "select") pickTool(id, id);
                  else if (id === "coaster") pickTool("coaster", "coaster");
                  else {
                    setCategory(id);
                    setSelected(null);
                    setTool(id === "paths" ? "path" : "select");
                  }
                },
              })),
            {
              id: "terrain",
              label: "Gelände & Höhenwege",
              Icon: Layers,
              group: "build",
              description: "Terrassen, Brücken, Rampen und Tunnel bauen.",
              run: () => pickTool("terrain", "terrain"),
            },
            {
              id: "scenery",
              label: "Themenbaukasten",
              Icon: Sparkles,
              group: "build",
              description: "Eigene Gebäude aus Wänden, Dächern und Details gestalten.",
              run: () => pickTool("scenery", "scenery"),
            },
            {
              id: "scenario-editor",
              label: "Szenarioeditor",
              Icon: Flag,
              group: "manage",
              description: "Eigene Karten, Startbedingungen und Ziele erstellen.",
              run: () => {
                setTab("scenario-editor");
                setSettings(true);
              },
            },
            {
              id: "land",
              label: "Park erweitern",
              Icon: MapPin,
              run: () => {
                setTab("land");
                setSettings(true);
              },
            },
            {
              id: "research",
              label: "Forschung & Freischaltungen",
              Icon: FlaskConical,
              badge: !!snapshot?.research?.active,
              run: () => {
                setTab("research");
                setSettings(true);
              },
            },
            {
              id: "erase",
              label: "Abreißen",
              Icon: Eraser,
              active: tool === "erase",
              run: () => pickTool("erase", "erase"),
            },
            {
              id: "workshop",
              label: "Eigene Attraktionen · Werkstatt",
              Icon: Sparkles,
              run: () => {
                if (snapshot && isUnlocked(snapshot, "custom")) setWorkshop(true);
                else {
                  setTab("research");
                  setSettings(true);
                }
              },
            },
            {
              id: "guests",
              label: "Besucher beobachten",
              Icon: Users,
              run: () => {
                setCategory("guests");
                setSelected(null);
                setTool("select");
              },
            },
            {
              id: "personal",
              label: "Personalübersicht",
              Icon: Users,
              run: () => {
                setTab("personal");
                setSettings(true);
              },
            },
            {
              id: "entrance",
              label: "Eingangstor gestalten",
              Icon: Flag,
              run: () => {
                setTab("entrance");
                setSettings(true);
              },
            },
            {
              id: "marketing",
              label: "Werbung & Kampagnen",
              Icon: Megaphone,
              run: () => {
                setTab("marketing");
                setSettings(true);
              },
            },
            {
              id: "analysis",
              label: "Parkanalyse & Heatmap",
              Icon: TrendingUp,
              active: category === "analysis",
              run: () => {
                setTrafficMode("crowd");
                setCategory("analysis");
                setTool("select");
                setSelected(null);
                setMenuOpen(false);
              },
            },
            {
              id: "finance",
              label: "Finanzen & Kredit",
              Icon: Wallet,
              group: "manage",
              description: "Kredit aufnehmen, tilgen und deine Tagesfinanzen prüfen.",
              run: () => {
                setTab("finance");
                setSettings(true);
              },
            },
            {
              id: "settings",
              label: "Parkverwaltung",
              Icon: Settings2,
              run: () => {
                setTab("park");
                setSettings(true);
              },
            },
            {
              id: "sound",
              label: audioSettings.enabled ? "Sound ausschalten" : "Sound einschalten",
              Icon: audioSettings.enabled ? Volume2 : VolumeX,
              run: toggleSound,
            },
            { id: "save", label: "Park speichern", Icon: Save, run: save },
            {
              id: "goals",
              label: "Kampagnenziele",
              Icon: Trophy,
              run: () => {
                setCategory("");
                setTool("select");
                setShowGoals(true);
              },
            },
            {
              id: "campaigns",
              label: "Kampagnen spielen",
              Icon: Flag,
              run: () => setNewDialog(true),
            },
            {
              id: "freeplay",
              label: "Freies Spiel starten",
              Icon: InfinityIcon,
              description: "Ein leerer Park, alle Freischaltungen und unbegrenztes Budget.",
              run: () => setNewDialog(true),
            },
            { id: "help", label: "Spielanleitung", Icon: HelpCircle, run: () => setHelp(true) },
          ]}
        />
        <div className="camerahelp">
          Q / E: 90° drehen · Rechts ziehen: verschieben · Mausrad: Zoom
        </div>
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
          <div className="camera-quarter-turns" role="group" aria-label="Parkkamera drehen">
            <button
              className="iconbtn"
              aria-label="Kamera 90 Grad nach links drehen"
              title="90° nach links · Q"
              onClick={() => rotateCamera(-1)}
            >
              <RotateCcw size={17} />
            </button>
            <span className="camera-angle" aria-label={`Kamerawinkel ${cameraAngle} Grad`}>
              {cameraAngle}°
            </span>
            <button
              className="iconbtn"
              aria-label="Kamera 90 Grad nach rechts drehen"
              title="90° nach rechts · E"
              onClick={() => rotateCamera(1)}
            >
              <RotateCw size={17} />
            </button>
          </div>
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
              view.current = { ...view.current, zoom: 1, panX: 0, panY: 40, cameraTurn: 0 };
              cameraTarget.current = null;
              setCameraAngle(0);
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
              <b>Parkmenü:</b> Das Halbrad unten enthält Bauwerkzeuge, Forschung, Werkstatt,
              Parkerweiterung und Verwaltung. Fahre über ein Symbol, um seine Funktion zu sehen.
              Forschung ist auch bei eingeklapptem Menü direkt erreichbar.
            </li>
            <li>
              <b>Neue Attraktionen:</b> Wähle unten ein Gebäude und klicke auf freie Wiese. Verbinde
              Fahrgeschäfte mit „Anschließen & öffnen“ automatisch mit dem Wegenetz. Ein direkt
              angrenzender Parkweg bietet vier Warteplätze.
            </li>
            <li>
              <b>Kamera drehen:</b> Mit Q / E oder den Pfeiltasten neben dem Zoom drehst du die
              Parkansicht in 90°-Schritten. Bauauswahl und Wege bleiben dabei an ihren
              Weltpositionen.
              <br />
              <b>Besucher lenken:</b> Im Menü „Wege“ ist Blau die Warteschlange zum Eingang, Rot der
              Ausgang zurück zum beigen Parkweg. Beide an unterschiedliche Anschlüsse der Attraktion
              setzen; bei Achterbahnen neben die Station. Weiße Pfeile zeigen die Ausgangsrichtung.
              Ein Kreuz markiert einen noch nicht angeschlossenen Ausgang.
            </li>
            <li>
              <b>Eröffnen:</b> Nach dem Bauen öffnet sich die Verwaltung direkt. Du kannst den
              Anschluss dort mit einem Klick bauen. Der Park verdient am Eintritt und an echten
              Besuchen.
            </li>
            <li>
              <b>Achterbahn:</b> Im Schnellbau setzt du einen vollständigen Rundkurs; R dreht ihn.
              Unter „Fertigteile“ setzt du eine Station, wählst eine bebilderte Gerade, Steigung,
              Kurve, einen Hügel, eine S-Kurve oder einen Looping und drückst „Einsetzen“. „Zur
              Station verbinden“ sucht einen passenden Rückweg. Danach bauen, testen und
              anschließen. Wähle eine fertige Bahn und „3D-Mitfahren“ für eine Probefahrt; Sound und
              Musik stellst du in der Parkverwaltung ein.
            </li>
            <li>
              <b>Nachträglich anpassen:</b> Klicke eine Bahn an. „Station versetzen“ bietet grüne,
              ebene Gleisfelder; „Bahn verschieben / drehen“ versetzt die gesamte Anlage. R dreht
              die Vorschau, Strg/⌘ Z nimmt den Umbau zurück. Mit „Gleise ersetzen / entfernen“
              entfernst du einen markierten Bereich, setzt neue Bauteile ein und verbindest die
              offenen Enden automatisch. „Beschleuniger & Bremsen“ montiert Module mit einstellbarem
              Zieltempo und einstellbarer Stärke. Danach ist eine neue Testfahrt nötig.
            </li>
            <li>
              <b>3D erleben:</b> Auch die anderen Fahrgeschäfte haben eine Mitfahrt aus ihren
              bewegten Sitzen. Die Parkbahn und der Shuttle verbinden je zwei Haltestellen am
              Wegenetz; wähle eine verbundene Haltestelle zum Mitfahren. Im 3D-Baumodus dreht die
              linke Maustaste die Kamera, die rechte verschiebt sie. Das Mausrad zoomt; F schaltet
              das Folgen des nächsten Bauteils um.
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
            Karte ziehen: Auswahlwerkzeug oder rechte Maustaste. Mausrad: Zoom. Ein Spieltag dauert{" "}
            {Math.round(DAY_SECONDS)} Sekunden. Ein Jahr hat {DAYS_PER_YEAR} Parktage und dauert bei
            1× genau 20 Minuten. Löhne und Betriebskosten werden alle 90 Spielsekunden abgerechnet.
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
            if (workshopReturn.current) {
              workshopReturn.current = false;
              setWorkshop(true);
            }
            audio.current?.ride(0, false);
          }
        }}
      >
        <DialogContent className="ride-modal" showCloseButton={false}>
          <DialogTitle className="sr-only">
            {ride && isHabitat(ride.building.kind) ? "3D-Tierbeobachtung" : "3D-Mitfahrt"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {ride && isHabitat(ride.building.kind)
              ? "Beobachte deine Tiere frei im Gehege. Der Park pausiert."
              : "Probefahrt in deiner gebauten Attraktion. Der Park pausiert."}
          </DialogDescription>
          {ride && (
            <Suspense
              fallback={<div className="ride-loading">Deine 3D-Ansicht wird aufgebaut …</div>}
            >
              <RideView
                {...ride}
                audio={audio.current}
                muted={!audioSettings.enabled}
                onMute={toggleSound}
                onClose={() => {
                  rideActive.current = false;
                  setRide(null);
                  if (workshopReturn.current) {
                    workshopReturn.current = false;
                    setWorkshop(true);
                  }
                  audio.current?.ride(0, false);
                }}
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
      {workshop && (
        <Suspense fallback={null}>
          <Workshop
            initialDesign={customDesign}
            onClose={() => setWorkshop(false)}
            onBuild={(d) => {
              setCustomDesign(d);
              setWorkshop(false);
              pickTool("custom", "rides");
            }}
            onPreview={(d) => {
              workshopReturn.current = true;
              setCustomDesign(d);
              setWorkshop(false);
              const copy = structuredClone(park.current!);
              const id = copy.nextId++;
              const building: Building = {
                id,
                kind: "custom",
                x: 11,
                y: 10,
                name: d.name,
                open: true,
                price: 10,
                served: 0,
                revenue: 0,
                queue: [],
                riders: [],
                cycle: 0,
                tested: true,
                design: structuredClone(d),
              };
              copy.buildings = copy.buildings.filter(
                (b) => !(b.x >= 9 && b.x < 16 && b.y >= 8 && b.y < 15),
              );
              copy.buildings.push(building);
              rideActive.current = true;
              setRide({ park: copy, building });
            }}
          />
        </Suspense>
      )}
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className={`manual park-management tab-${tab}`}>
          <DialogTitle>Dein Park, deine Regeln.</DialogTitle>
          <DialogDescription>Verwalte den Parkbetrieb und deinen Spielstand.</DialogDescription>
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList className="tabsrow">
              <TabsTrigger value="park">Parkbetrieb</TabsTrigger>
              <TabsTrigger value="finance">Finanzen & Kredit</TabsTrigger>
              <TabsTrigger value="scenario-editor">Szenarioeditor</TabsTrigger>
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="entrance">Eingangstor</TabsTrigger>
              <TabsTrigger value="marketing">Werbung</TabsTrigger>
              <TabsTrigger value="save">Spielstand</TabsTrigger>
              <TabsTrigger value="audio">Sound</TabsTrigger>
              <TabsTrigger value="research">Forschung</TabsTrigger>
              <TabsTrigger value="land">Parkgelände</TabsTrigger>
            </TabsList>
            <TabsContent value="entrance">
              {snapshot && (
                <section className="entrance-panel">
                  <h3>Willkommen in deinem Park</h3>
                  <p>
                    Wähle ein Eingangstor. Gekaufte Gestaltungen kannst du jederzeit kostenlos
                    wechseln.
                  </p>
                  <div className="entrance-themes">
                    {(Object.keys(GATES) as GateStyle[]).map((style) => {
                      const gate = GATES[style],
                        owned = style === "classic" || snapshot.entrance?.owned.includes(style);
                      return (
                        <button
                          key={style}
                          className={`entrance-card ${gateStyle(snapshot) === style ? "active" : ""}`}
                          aria-pressed={gateStyle(snapshot) === style}
                          disabled={!owned && !canAfford(snapshot, gate.cost)}
                          onClick={() => {
                            notify(changeGate(park.current!, style) ?? `${gate.name} ausgewählt.`);
                            setWorldRevision((v) => v + 1);
                            sync();
                          }}
                        >
                          <img src={assetUrl(gate.sprite)} alt="" />
                          <strong>{gate.name}</strong>
                          <span>
                            {gateStyle(snapshot) === style
                              ? "Aktuelles Tor"
                              : owned
                                ? "Kostenlos wechseln"
                                : EUR(gate.cost)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <label className="controlrow">
                    Parkeintritt <strong>{EUR(snapshot.ticket)}</strong>
                    <input
                      aria-label="Eintritt am Tor"
                      type="range"
                      min="0"
                      max="30"
                      value={snapshot.ticket}
                      onChange={(e) => {
                        park.current!.ticket = Number(e.target.value);
                        sync();
                      }}
                    />
                  </label>
                  <p className="small">
                    Etwa {Math.round(entryDemand(snapshot) * 100)} % der Interessenten entscheiden
                    sich bei diesem Preis für einen Besuch.
                  </p>
                  <button
                    className="primary"
                    onClick={() => {
                      park.current!.open = !park.current!.open;
                      sync();
                    }}
                  >
                    {snapshot.open ? "Eingang für neue Besucher schließen" : "Eingang öffnen"}
                  </button>
                </section>
              )}
            </TabsContent>
            <TabsContent value="finance">
              {snapshot && (
                <FinancePanel
                  park={snapshot}
                  onBorrow={(amount) => {
                    const error = borrowLoan(park.current!, amount);
                    sync();
                    return error;
                  }}
                  onRepay={(amount) => {
                    const error = repayLoan(park.current!, amount);
                    sync();
                    return error;
                  }}
                />
              )}
            </TabsContent>
            <TabsContent value="scenario-editor">
              {snapshot && (
                <ScenarioEditor park={snapshot} onStart={switchPark} onEditMap={switchPark} />
              )}
            </TabsContent>
            <TabsContent value="personal">
              {snapshot && (
                <MaintenancePanel
                  park={snapshot}
                  onLocateStaff={locateStaff}
                  onCommand={(action) => {
                    const error = action(park.current!);
                    sync();
                    if (error) notify(error);
                  }}
                />
              )}
              {snapshot && (
                <StaffPanel
                  onLocateStaff={locateStaff}
                  onEditCleanerArea={beginCleanerArea}
                  onClearCleanerArea={clearCleanerArea}
                  park={snapshot}
                  onAssignKeeper={(workerId, habitatId) => {
                    const error = assignZooKeeperToHabitat(park.current!, workerId, habitatId);
                    sync();
                    return error;
                  }}
                  onSpecialists={(role, count) => {
                    const error = setZooSpecialists(park.current!, role, count);
                    sync();
                    return error;
                  }}
                  onCleaners={(count) => {
                    park.current!.staff = count;
                    initCleanliness(park.current!);
                    sync();
                  }}
                  onKeepers={(count) => {
                    initZoo(park.current!);
                    park.current!.zoo!.keepers = count;
                    initZoo(park.current!);
                    sync();
                  }}
                  {...crewActions}
                  onSelectRide={(id) => {
                    setSettings(false);
                    setSelected(id);
                    setCategory("detail");
                    setTool("select");
                  }}
                />
              )}
            </TabsContent>
            <TabsContent value="marketing">
              {snapshot && (
                <MarketingPanel
                  key={marketingTarget ?? "park"}
                  initialTarget={marketingTarget}
                  park={snapshot}
                  onStart={(kind, days, id) => {
                    const error = startMarketing(
                      park.current!,
                      kind,
                      days,
                      id,
                      (s, b) => !!access(s, b),
                    );
                    notify(
                      error ??
                        "Werbekampagne gestartet. Beobachte Besucher und Umsatz in der Auswertung.",
                    );
                    sync();
                  }}
                  onCancel={(id) => {
                    notify(
                      cancelMarketing(park.current!, id) ??
                        "Kampagne beendet. Bereits gewonnene Besucher bleiben im Park.",
                    );
                    sync();
                  }}
                />
              )}
            </TabsContent>
            <TabsContent value="land">
              <p>
                Dein Park besitzt{" "}
                {snapshot ? `${mapWidth(snapshot)} × ${mapHeight(snapshot)}` : "30 × 30"} Felder.
                Kaufe angrenzende Wiesen in sechs Felder breiten Streifen.
              </p>
              <div className="land-options">
                {snapshot &&
                  (["east", "south"] as const).map((axis) => {
                    const plan = expansionPlan(snapshot, axis);
                    return (
                      <div key={axis}>
                        <strong>{axis === "east" ? "Ostgrundstück" : "Südgrundstück"}</strong>
                        <p>
                          {plan.points.length} neue Bauplätze · danach {plan.width} × {plan.height}{" "}
                          Felder
                        </p>
                        <button
                          className="primary"
                          disabled={!!plan.error}
                          onClick={() => {
                            const error = expandPark(park.current!, axis);
                            if (!error) {
                              setWorldRevision((v) => v + 1);
                              setSettings(false);
                              cameraTarget.current = null;
                              const live = park.current!,
                                max = Math.max(mapWidth(live), mapHeight(live));
                              view.current.zoom = Math.max(0.55, 30 / max);
                              view.current.panX = 0;
                              view.current.panY = 40;
                              view.current.cameraTurn = 0;
                              setCameraAngle(0);
                              setZoom(Math.round(view.current.zoom * 100));
                            }
                            notify(
                              error ??
                                "Grundstück gekauft. Neue Wege und Bauwerke sind hier jetzt möglich.",
                            );
                            sync();
                          }}
                        >
                          {EUR(plan.cost)} · Grundstück kaufen
                        </button>
                        {plan.error && <p className="small">{plan.error}</p>}
                      </div>
                    );
                  })}
              </div>
              <p className="small">
                Bis zu 54 × 54 Felder. Der Eingang und bestehende Bauwerke bleiben an ihrem Platz.
              </p>
            </TabsContent>
            <TabsContent value="research">
              {snapshot && (
                <ResearchTree
                  park={snapshot}
                  onStart={(id) => {
                    const error = startResearch(park.current!, id);
                    notify(error ?? `${RESEARCH[id].name}: Forschung gestartet.`);
                    sync();
                  }}
                />
              )}
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
              {snapshot && (
                <section className="difficulty-panel">
                  <h3>Schwierigkeitsgrad</h3>
                  <button className="secondary" onClick={() => setTab("finance")}>
                    Startkapital benötigt? Finanzen & Kredit öffnen
                  </button>
                  <p className="small">
                    Jederzeit änderbar. Der gewählte Satz gilt für die nächste Tagesabrechnung.
                  </p>
                  <div className="difficulty-options">
                    {(Object.keys(DIFFICULTIES) as Difficulty[]).map((level) => (
                      <button
                        key={level}
                        aria-pressed={difficultyOf(snapshot) === level}
                        onClick={() => {
                          setDifficulty(park.current!, level);
                          sync();
                        }}
                      >
                        <strong>{DIFFICULTIES[level].label}</strong>
                        <span>{DIFFICULTIES[level].costDescription}</span>
                        <small>{DIFFICULTIES[level].description}</small>
                      </button>
                    ))}
                  </div>
                </section>
              )}
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
                <span>Reinigungsteam</span>
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
                  initCleanliness(park.current!);
                  sync();
                }}
              />
              <p className="small">
                {difficultyEuro(difficultyCost(snapshot ?? {}, 80, "wages"))} pro Mitarbeiter und
                Tag. Das Team sammelt Müll und leert erreichbare Mülleimer. Ein Mitarbeiter betreut
                bis zu 25 Gäste. Unterbesetzung drückt die Stimmung.
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
                  <Save /> Zehn Speicherplätze öffnen
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    try {
                      const raw = localStorage.getItem(PARK_SAVE_KEY);
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
                  <FolderOpen /> Automatische Sicherung laden
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
      <SaveSlots
        open={saveSlotsOpen}
        onOpenChange={setSaveSlotsOpen}
        getPark={() => park.current}
        onLoad={switchPark}
        onSaved={(name) => {
          setSaved(`Gespeichert: ${name}`);
          notify(`Spielstand „${name}“ gespeichert.`);
        }}
      />
      <Dialog open={newDialog} onOpenChange={setNewDialog}>
        <DialogContent className="manual">
          <DialogTitle>Dein nächster Park</DialogTitle>
          <DialogDescription>
            Beim Wechsel wird dein aktueller Park gesichert. Du kannst ihn hier mit „Vorherigen Park
            fortsetzen“ wieder öffnen.
          </DialogDescription>
          <button
            className="free-play-card"
            data-testid="start-free-play"
            onClick={() => switchPark(createFreePark())}
          >
            <span className="free-play-icon">
              <InfinityIcon size={36} />
            </span>
            <span>
              <strong>Freies Spiel starten</strong>
              <small>Ein leerer Park für deine Ideen</small>
            </span>
            <span className="free-play-features">
              <span>∞ Budget</span>
              <span>Alles freigeschaltet</span>
              <span>Keine Ziele</span>
            </span>
            <span className="free-play-description">
              Baue Achterbahnen, einen Zoo oder deinen eigenen Mix. Gäste, Personal und Tiere
              reagieren weiterhin auf deinen Park.
            </span>
            <span className="free-play-start">
              Jetzt frei bauen <Play size={17} />
            </span>
          </button>
          {previousPark && (
            <button
              className="secondary previous-park"
              data-testid="restore-previous-park"
              onClick={() => {
                let previous: Park | null = null;
                try {
                  previous = readPreviousPark(localStorage);
                } catch {}
                if (previous) switchPark(previous);
                else
                  notify(
                    "Die Sicherung ist nicht mehr verfügbar. Dein aktueller Park bleibt geöffnet.",
                  );
              }}
            >
              <FolderOpen size={19} />
              <span>
                <strong>Vorherigen Park fortsetzen</strong>
                <small>
                  {hasUnlimitedBudget(previousPark) ? "Freier Park" : scenarioOf(previousPark).name}{" "}
                  · {calendarOf(previousPark).weekday} · Tag {calendarOf(previousPark).day}, Jahr{" "}
                  {calendarOf(previousPark).year}
                </small>
              </span>
            </button>
          )}
          <details className="new-game-campaigns">
            <summary>Lieber eine Kampagne spielen</summary>
            <div className="stack">
              {Object.keys(SCENARIOS).map((id) => {
                const scenario = SCENARIOS[id as ScenarioId];
                return (
                  <button
                    className="scenario-card secondary"
                    key={id}
                    onClick={() => switchPark(newPark("scenario", id as ScenarioId))}
                  >
                    <strong>
                      {scenario.name} · {EUR(scenario.cash)}
                    </strong>
                    <span>{scenario.description}</span>
                  </button>
                );
              })}
            </div>
          </details>
        </DialogContent>
      </Dialog>
    </main>
  );
}
