import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Menu,
  PawPrint,
  RollerCoaster,
  Settings2,
  Trees,
  X,
} from "lucide-react";

export type ParkMenuGroup = "build" | "zoo" | "park" | "manage";
export type ParkAction = {
  id: string;
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  run: () => void;
  active?: boolean;
  badge?: boolean;
  /** Optional overrides for additional actions; the existing API stays compatible. */
  group?: ParkMenuGroup;
  description?: string;
  disabled?: boolean;
};
const GROUPS = [
  {
    id: "build",
    label: "Bauen",
    Icon: RollerCoaster,
    description: "Attraktionen, Wege und Bauwerkzeuge",
  },
  { id: "zoo", label: "Zoo", Icon: PawPrint, description: "Tiere, Gehege und Tierpflege" },
  { id: "park", label: "Park", Icon: Trees, description: "Versorgung, Natur und Parkleben" },
  {
    id: "manage",
    label: "Verwalten",
    Icon: Settings2,
    description: "Finanzen, Betrieb und Einstellungen",
  },
] as const;
const GROUP_BY_ID: Record<string, ParkMenuGroup> = {
  select: "build",
  rides: "build",
  coaster: "build",
  paths: "build",
  workshop: "build",
  erase: "build",
  zoo: "zoo",
  habitats: "zoo",
  animals: "zoo",
  keepers: "zoo",
  animalcare: "zoo",
  entrance: "park",
  shops: "park",
  nature: "park",
  land: "park",
  guests: "park",
  goals: "park",
  campaigns: "park",
  personal: "manage",
  analysis: "manage",
  marketing: "manage",
  settings: "manage",
  sound: "manage",
  save: "manage",
  help: "manage",
};
const ORDER: Record<ParkMenuGroup, readonly string[]> = {
  build: ["select", "rides", "coaster", "paths", "workshop", "erase"],
  zoo: ["zoo", "habitats", "animals", "keepers", "animalcare"],
  park: ["entrance", "shops", "nature", "land", "guests", "goals", "campaigns"],
  manage: ["personal", "analysis", "marketing", "settings", "sound", "save", "help"],
};
const SHORT_LABELS: Record<string, string> = {
  entrance: "Eingangstor",
  personal: "Personal",
  select: "Auswählen",
  rides: "Fahrgeschäfte",
  coaster: "Achterbahnen",
  paths: "Wege",
  workshop: "Werkstatt",
  erase: "Abreißen",
  zoo: "Tiere & Gehege",
  habitats: "Gehege",
  animals: "Tiere",
  keepers: "Tierpflege",
  animalcare: "Tierpflege",
  shops: "Versorgung",
  nature: "Natur",
  land: "Erweitern",
  guests: "Besucher",
  goals: "Ziele",
  campaigns: "Szenarien",
  analysis: "Parkanalyse",
  marketing: "Werbung",
  settings: "Verwaltung",
  save: "Speichern",
  help: "Spielhilfe",
};
const DESCRIPTIONS: Record<string, string> = {
  entrance: "Das Eingangstor gestalten oder gegen ein anderes Modell tauschen.",
  personal: "Personal einstellen und Reinigung sowie Tierpflege organisieren.",
  select: "Gebäude und Gäste im Park auswählen.",
  rides: "Fertige Fahrgeschäfte für deinen Park bauen.",
  coaster: "Eine Achterbahn aus Streckenteilen entwerfen.",
  paths: "Parkwege sowie Ein- und Ausgangswege bauen.",
  workshop: "Eigene Attraktionen gestalten und bauen.",
  erase:
    "Das gesamte getroffene Fahrgeschäft, Gebäude oder Wegefeld entfernen. Bewohnte Gehege bleiben geschützt.",
  zoo: "Gehege bauen, Tiere aufnehmen und ihre Pflege verwalten.",
  shops: "Essen, Getränke, Souvenirs und Toiletten anbieten.",
  nature: "Bäume, Blumen und Ausstattung für deinen Park.",
  land: "Zusätzliches Baugelände für deinen Park kaufen.",
  guests: "Gäste, Wünsche und Besucherströme beobachten.",
  goals: "Fortschritt und Ziele der laufenden Kampagne ansehen.",
  campaigns: "Einen neuen Park oder eine neue Kampagne starten.",
  analysis: "Zufriedenheit, Sauberkeit und den Parkbetrieb prüfen.",
  marketing: "Kampagnen für deinen Park und einzelne Attraktionen starten.",
  settings: "Parkeinstellungen und den laufenden Betrieb verwalten.",
  save: "Den aktuellen Park speichern.",
  help: "Spielregeln, Werkzeuge und Steuerung nachschlagen.",
};
const PAGE_SIZE = 6;
export const parkMenuGroup = (id: string): ParkMenuGroup => GROUP_BY_ID[id] ?? "manage";
const actionGroup = (a: ParkAction): ParkMenuGroup => a.group ?? parkMenuGroup(a.id);
const shortLabel = (a: ParkAction) =>
  a.id === "sound" ? a.label : (SHORT_LABELS[a.id] ?? a.label);
const detail = (a: ParkAction) => a.description ?? DESCRIPTIONS[a.id] ?? a.label;

/** The blade and caterpillar tracks distinguish demolition from the drawing eraser. */
function Bulldozer({ size = 26, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 20v-8h8l3 8M7 12V6h8l3 11M9 9h4v6H9zM18 18h4l3 6M25 15v11h5M18 23h7" />
      <rect x="3" y="20" width="17" height="8" rx="4" />
      <circle cx="7" cy="24" r="1" />
      <circle cx="12" cy="24" r="1" />
      <circle cx="17" cy="24" r="1" />
    </svg>
  );
}
function coordinates(angle: number, radius: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: 220 + Math.cos(rad) * radius, y: 244 - Math.sin(rad) * radius };
}
function wedge(index: number, count: number) {
  const gap = 1.6,
    step = 180 / count;
  const a = coordinates(180 - index * step - gap, 212);
  const b = coordinates(180 - (index + 1) * step + gap, 212);
  const c = coordinates(180 - (index + 1) * step + gap, 88);
  const d = coordinates(180 - index * step - gap, 88);
  return `M${a.x},${a.y} A212,212 0 0 1 ${b.x},${b.y} L${c.x},${c.y} A88,88 0 0 0 ${d.x},${d.y} Z`;
}
function Sector({ index, count }: { index: number; count: number }) {
  return (
    <svg className="pm8-item-sector" viewBox="0 0 440 244" aria-hidden="true">
      <path className="pm8-sector" d={wedge(index, count)} />
    </svg>
  );
}
function tileStyle(index: number, count: number, shade: number): CSSProperties {
  const angle = 180 - ((index + 0.5) * 180) / count;
  const p = coordinates(angle, count <= 4 ? 150 : 162);
  // Match the visible annular wedge, including its gaps, for pointer hit testing.
  const start = 180 - (index * 180) / count - 1.6;
  const end = 180 - ((index + 1) * 180) / count + 1.6;
  const steps = Math.ceil((start - end) / 2);
  const points = [212, 88].flatMap((radius, ring) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const t = ring === 0 ? i / steps : 1 - i / steps;
      const point = coordinates(start + (end - start) * t, radius);
      return `${(point.x / 440) * 100}% ${(point.y / 244) * 100}%`;
    }),
  );
  return {
    "--pm8-clip": `polygon(${points.join(",")})`,
    "--pm8-x": `${(p.x / 440) * 100}%`,
    "--pm8-y": `${(p.y / 244) * 100}%`,
    "--pm8-shade": `${8 + shade * 8}%`,
  } as CSSProperties;
}

type Props = { actions: ParkAction[]; open: boolean; setOpen: (value: boolean) => void };
export default function ParkMenu({ actions, open, setOpen }: Props) {
  const [group, setGroup] = useState<ParkMenuGroup | null>(null);
  const [page, setPage] = useState(0);
  const [tip, setTip] = useState("");
  const root = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const nextFocus = useRef<string | null>(null);
  const panelId = useId();
  const tipId = useId();
  const research = actions.find((a) => a.id === "research");
  const demolition = actions.find((a) => a.id === "erase");
  const entries = GROUPS.map((g) => ({
    ...g,
    actions: actions
      .filter((a) => a.id !== "research" && a.id !== "erase" && actionGroup(a) === g.id)
      .sort((a, b) => {
        const rank = (id: string) => {
          const n = ORDER[g.id].indexOf(id);
          return n < 0 ? 1000 : n;
        };
        return rank(a.id) - rank(b.id);
      }),
  })).filter((g) => g.actions.length > 0);
  const rootCount = entries.length + (demolition ? 1 : 0);
  const current = entries.find((g) => g.id === group);
  const totalPages = Math.max(1, Math.ceil((current?.actions.length ?? 0) / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = current?.actions.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE) ?? [];

  function close(restoreFocus = false) {
    setTip("");
    setGroup(null);
    setPage(0);
    setOpen(false);
    if (restoreFocus) toggle.current?.focus({ preventScroll: true });
  }
  function back() {
    nextFocus.current = group;
    setGroup(null);
    setPage(0);
    setTip("");
  }
  function run(action: ParkAction) {
    if (action.disabled) return;
    // Restore a stable focus target first; a newly opened dialog may then take focus.
    close(true);
    action.run();
  }
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        setOpen(false);
        setGroup(null);
        setPage(0);
        setTip("");
      }
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open, setOpen]);
  useEffect(() => {
    if (!open) {
      setGroup(null);
      setPage(0);
      setTip("");
      return;
    }
    const buttons = [
      ...(root.current?.querySelectorAll<HTMLButtonElement>("[data-pm8-item]:not(:disabled)") ??
        []),
    ];
    const preferred = buttons.find((b) => b.dataset.pm8Item === nextFocus.current);
    (preferred ?? buttons[0] ?? toggle.current)?.focus({ preventScroll: true });
    nextFocus.current = null;
  }, [open, group, safePage]);

  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      if (current) back();
      else close(true);
      return;
    }
    if (!open || event.ctrlKey || event.metaKey || event.altKey) return;
    const buttons = [
      ...(root.current?.querySelectorAll<HTMLButtonElement>("[data-pm8-item]:not(:disabled)") ??
        []),
    ];
    if (!buttons.length) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = (index + 1 + buttons.length) % buttons.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else if (event.key.length === 1 && /[\p{L}\p{N}]/u.test(event.key)) {
      const ordered = [...buttons.slice(index + 1), ...buttons.slice(0, index + 1)];
      const found = ordered.find((b) =>
        (b.dataset.pm8Label ?? "")
          .toLocaleLowerCase("de")
          .startsWith(event.key.toLocaleLowerCase("de")),
      );
      event.stopPropagation();
      if (found) {
        event.preventDefault();
        found.focus();
      }
      return;
    } else return;
    event.preventDefault();
    event.stopPropagation();
    buttons[next]?.focus();
  }

  return (
    <nav
      ref={root}
      className={`pm8 ${open ? "pm8--open" : ""}`}
      aria-label="Parkmenü"
      onKeyDown={keyboard}
      onBlur={(event) => {
        if (
          open &&
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setOpen(false);
          setGroup(null);
          setPage(0);
          setTip("");
        }
      }}
    >
      {open && (
        <section
          id={panelId}
          className={`pm8-panel ${current ? `pm8-submenu pm8-${current.id}` : "pm8-root"}`}
          aria-label={current ? `${current.label}: Werkzeuge` : "Menügruppen"}
        >
          <div className="pm8-heading">
            {current ? (
              <button className="pm8-back" onClick={back} title="Zurück zu den Menügruppen">
                <ArrowLeft size={16} />
                <span>{current.label}</span>
              </button>
            ) : (
              <span>Dein Park. Deine Ideen.</span>
            )}
            {current && totalPages > 1 && (
              <div className="pm8-pages" aria-label="Weitere Werkzeuge">
                <button
                  aria-label="Vorherige Werkzeuge"
                  disabled={safePage === 0}
                  onClick={() => {
                    setPage(safePage - 1);
                    setTip("");
                  }}
                >
                  <ChevronLeft size={17} />
                </button>
                <span aria-live="polite">
                  {safePage + 1} / {totalPages}
                </span>
                <button
                  aria-label="Weitere Werkzeuge"
                  disabled={safePage === totalPages - 1}
                  onClick={() => {
                    setPage(safePage + 1);
                    setTip("");
                  }}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            )}
          </div>
          <svg className="pm8-wheel" viewBox="0 0 440 244" aria-hidden="true">
            <path className="pm8-wheel-base" d="M3 244 A217 217 0 0 1 437 244 Z" />
          </svg>
          <div className="pm8-items">
            {current
              ? visible.map((a, i) => {
                  const Icon = a.id === "erase" ? Bulldozer : a.Icon;
                  return (
                    <button
                      key={a.id}
                      data-pm8-item={a.id}
                      data-pm8-label={shortLabel(a)}
                      className={`pm8-item pm8-action ${a.active ? "is-active" : ""}`}
                      style={tileStyle(i, visible.length, i)}
                      disabled={a.disabled}
                      aria-label={a.label}
                      aria-pressed={a.active === undefined ? undefined : a.active}
                      aria-describedby={tipId}
                      onMouseEnter={() => setTip(detail(a))}
                      onMouseLeave={() => setTip("")}
                      onFocus={() => setTip(detail(a))}
                      onBlur={() => setTip("")}
                      onClick={() => run(a)}
                    >
                      <Sector index={i} count={visible.length} />
                      <span className="pm8-label">
                        <span className="pm8-icon">
                          <Icon size={27} strokeWidth={1.8} />
                          {a.active && <Check className="pm8-check" size={12} />}
                          {a.badge && <i className="pm8-dot" />}
                        </span>
                        <span>{shortLabel(a)}</span>
                      </span>
                    </button>
                  );
                })
              : entries.map((g, i) => (
                  <button
                    key={g.id}
                    data-pm8-item={g.id}
                    data-pm8-label={g.label}
                    className={`pm8-item pm8-group pm8-${g.id} ${g.actions.some((a) => a.active) ? "has-active" : ""}`}
                    style={tileStyle(i, rootCount, i)}
                    aria-label={`${g.label}: ${g.description}`}
                    aria-expanded={false}
                    aria-describedby={tipId}
                    onMouseEnter={() => setTip(g.description)}
                    onMouseLeave={() => setTip("")}
                    onFocus={() => setTip(g.description)}
                    onBlur={() => setTip("")}
                    onClick={() => {
                      setGroup(g.id);
                      setPage(0);
                      setTip("");
                    }}
                  >
                    <Sector index={i} count={rootCount} />
                    <span className="pm8-label">
                      <span className="pm8-icon">
                        <g.Icon size={30} strokeWidth={1.65} />
                        {g.actions.some((a) => a.active) && (
                          <Check className="pm8-check" size={12} />
                        )}
                        {g.actions.some((a) => a.badge) && <i className="pm8-dot" />}
                      </span>
                      <span>{g.label}</span>
                    </span>
                  </button>
                ))}
            {!current && demolition && (
              <button
                data-pm8-item="erase"
                data-pm8-label="Abreißen"
                className={`pm8-item pm8-group pm8-demolition ${demolition.active ? "is-active" : ""}`}
                style={tileStyle(entries.length, rootCount, 2)}
                disabled={demolition.disabled}
                aria-label="Abreißen"
                aria-pressed={demolition.active === undefined ? undefined : demolition.active}
                aria-describedby={tipId}
                onMouseEnter={() => setTip(detail(demolition))}
                onMouseLeave={() => setTip("")}
                onFocus={() => setTip(detail(demolition))}
                onBlur={() => setTip("")}
                onClick={() => run(demolition)}
              >
                <Sector index={entries.length} count={rootCount} />
                <span className="pm8-label">
                  <span className="pm8-icon">
                    <Bulldozer size={30} />
                    {demolition.active && <Check className="pm8-check" size={12} />}
                  </span>
                  <span>Abreißen</span>
                </span>
              </button>
            )}
          </div>
          <div className="pm8-tip" id={tipId} role="status" aria-live="polite">
            {tip || (current ? current.description : "Wähle eine Gruppe. Mit Esc geht es zurück.")}
          </div>
        </section>
      )}
      <div className="pm8-dock">
        <button
          ref={toggle}
          className="pm8-toggle"
          aria-label={open ? "Parkmenü schließen" : "Parkmenü öffnen"}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          title={open ? "Parkmenü schließen (Esc)" : "Parkmenü öffnen"}
          onClick={() => {
            if (open) close(true);
            else {
              setGroup(null);
              setPage(0);
              setOpen(true);
            }
          }}
        >
          {open ? <X size={24} strokeWidth={1.8} /> : <Menu size={24} strokeWidth={1.8} />}
          <span>Parkmenü</span>
        </button>
        {research && (
          <button
            className={`pm8-research ${research.active ? "is-active" : ""}`}
            disabled={research.disabled}
            title={research.label}
            aria-label={research.label}
            aria-pressed={research.active === undefined ? undefined : research.active}
            onClick={() => run(research)}
          >
            <FlaskConical size={23} strokeWidth={1.8} />
            {research.badge && <i className="pm8-dot" aria-label="Forschung läuft" />}
          </button>
        )}
      </div>
    </nav>
  );
}
