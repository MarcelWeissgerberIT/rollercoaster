import { DAY_SECONDS, DAYS_PER_YEAR } from "../game/calendar";
import { useId } from "react";
import {
  ArrowRight,
  Check,
  Coins,
  FerrisWheel,
  FlaskConical,
  Gift,
  Info,
  LockKeyhole,
  MoveHorizontal,
  PawPrint,
  Timer,
  Zap,
} from "lucide-react";
import { RESEARCH, type Park, type ResearchId } from "../game/simulation";
import { COIN_COST, researchCoins, nextResearchReward } from "../game/research-coins";
import "./research-tree.css";

export type ResearchTreeProps = {
  park: Park;
  onStart: (id: ResearchId) => void;
};

type ResearchStatus = "done" | "active" | "available" | "locked";
const RESEARCH_IDS = Object.keys(RESEARCH) as ResearchId[];
const ROOTS = [
  { id: "zoo", label: "Zoo", Icon: PawPrint, theme: "zoo" },
  { id: "family", label: "Familie", Icon: FerrisWheel, theme: "family" },
  { id: "thrill", label: "Thrill", Icon: Zap, theme: "thrill" },
] as const;
const GAME_DAY_SECONDS = DAY_SECONDS;
const number = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

function gameDays(seconds: number, dative = false) {
  const days = Math.max(0, seconds) / GAME_DAY_SECONDS;
  if (days > 0 && days < 0.1) return `weniger als 0,1 ${dative ? "Spieltagen" : "Spieltage"}`;
  return `${number.format(days)} ${days === 1 ? "Spieltag" : dative ? "Spieltagen" : "Spieltage"}`;
}

/** Copy this file and research-tree.css into components/. The coin engine owns all mutations. */
export function ResearchTree({ park, onStart }: ResearchTreeProps) {
  const uid = useId();
  const sandbox = park.mode === "sandbox";
  const completed = new Set(park.research?.completed ?? []);
  const active = park.research?.active ?? null;
  const balance = Math.max(0, Math.floor(researchCoins(park)));
  const reward = nextResearchReward(park);
  const remaining = Math.max(0, Number.isFinite(reward.remaining) ? reward.remaining : 0);
  const projectedReward = Math.max(1, Math.min(3, Math.floor(reward.coins) || 1));
  const completedCount = sandbox
    ? RESEARCH_IDS.length
    : RESEARCH_IDS.filter((id) => completed.has(id)).length;
  const isDone = (id: ResearchId) => sandbox || completed.has(id);
  const isPaused = park.speed === 0;

  function renderNode(id: ResearchId, seen = new Set<ResearchId>()) {
    // Protect rendering if future research data accidentally contains a circular prerequisite.
    if (seen.has(id)) return null;
    const nextSeen = new Set(seen).add(id);
    const project = RESEARCH[id];
    const cost = COIN_COST[id];
    const done = isDone(id);
    const running = !done && active === id;
    const prerequisite = project.requires as ResearchId | null;
    const missingPrerequisite = prerequisite && !isDone(prerequisite);
    const otherRunning = !!active && active !== id && !sandbox;
    const missingCoins = Math.max(0, cost - balance);
    const reasons = [
      missingPrerequisite ? `Erforsche zuerst „${RESEARCH[prerequisite].name}“.` : null,
      otherRunning
        ? `„${RESEARCH[active!].name}“ läuft bereits. Es ist immer nur eine Forschung gleichzeitig möglich.`
        : null,
      missingCoins
        ? `Es fehlen ${missingCoins} ${missingCoins === 1 ? "Coin" : "Coins"}. Neue Coins gibt es beim Jahresbonus.`
        : null,
    ].filter(Boolean) as string[];
    const status: ResearchStatus = done
      ? "done"
      : running
        ? "active"
        : reasons.length
          ? "locked"
          : "available";
    const titleId = `${uid}-${id}-title`;
    const reasonId = `${uid}-${id}-reason`;
    const statusLabel = {
      done: sandbox ? "Im freien Spiel verfügbar" : "Freigeschaltet",
      active: isPaused ? "Forschung pausiert" : "Wird erforscht",
      available: "Bereit zur Forschung",
      locked: "Noch gesperrt",
    }[status];
    const StatusIcon = done
      ? Check
      : running
        ? FlaskConical
        : status === "locked"
          ? LockKeyhole
          : ArrowRight;
    const actionLabel = done
      ? "Freigeschaltet"
      : running
        ? isPaused
          ? "Pausiert"
          : "Forschung läuft"
        : missingPrerequisite
          ? "Voraussetzung fehlt"
          : otherRunning
            ? "Forschung läuft bereits"
            : missingCoins
              ? `${missingCoins} ${missingCoins === 1 ? "Coin fehlt" : "Coins fehlen"}`
              : "Erforschen";
    const duration = Math.max(1, project.duration);
    const secondsLeft = Math.max(0, Math.min(duration, park.research?.remaining ?? duration));
    const progress = Math.max(0, Math.min(100, Math.round((1 - secondsLeft / duration) * 100)));
    const children = RESEARCH_IDS.filter((child) => RESEARCH[child].requires === id);

    return (
      <li
        className="rt-node"
        key={id}
        data-connected={prerequisite ? isDone(prerequisite) : undefined}
      >
        <article
          className="rt-card"
          data-status={status}
          data-research-id={id}
          aria-labelledby={titleId}
        >
          <div className="rt-card-top">
            <span className="rt-state">
              <StatusIcon aria-hidden="true" />
              {statusLabel}
            </span>
            <span className="rt-cost" aria-label={`${cost} ${cost === 1 ? "Coin" : "Coins"}`}>
              <Coins aria-hidden="true" />
              <b>{cost}</b>
            </span>
          </div>
          <h4 id={titleId}>{project.name}</h4>
          <p className="rt-unlocks">{project.description}</p>
          <div className="rt-duration">
            <Timer aria-hidden="true" />
            {gameDays(project.duration)}
          </div>
          {prerequisite && (
            <p className="rt-prerequisite">
              {isDone(prerequisite) ? (
                <Check aria-hidden="true" />
              ) : (
                <LockKeyhole aria-hidden="true" />
              )}
              <span>Nach: {RESEARCH[prerequisite].name}</span>
            </p>
          )}
          {running && (
            <div className="rt-progress-block" role="status" aria-live="off">
              <div>
                <span>{progress}% erforscht</span>
                <span>{gameDays(secondsLeft)} übrig</span>
              </div>
              <progress
                max={100}
                value={progress}
                aria-label={`${project.name}: ${progress}% erforscht`}
              />
              {isPaused && <p>Setze das Spiel fort, damit die Forschung weiterläuft.</p>}
            </div>
          )}
          {status === "locked" && (
            <p className="rt-reason" id={reasonId}>
              {reasons[0]}
            </p>
          )}
          <button
            type="button"
            className="rt-action"
            aria-disabled={status !== "available"}
            aria-label={`${project.name}: ${actionLabel}${status === "available" ? ` für ${cost} ${cost === 1 ? "Coin" : "Coins"}` : ""}`}
            aria-describedby={status === "locked" ? reasonId : undefined}
            title={status === "locked" ? reasons.join(" ") : statusLabel}
            onClick={() => {
              if (status === "available") onStart(id);
            }}
          >
            {done ? (
              <Check aria-hidden="true" />
            ) : running ? (
              <FlaskConical aria-hidden="true" />
            ) : status === "locked" ? (
              <LockKeyhole aria-hidden="true" />
            ) : (
              <ArrowRight aria-hidden="true" />
            )}
            {actionLabel}
          </button>
        </article>
        {children.length > 0 && (
          <ul className="rt-children" aria-label={`Weiterforschen nach ${project.name}`}>
            {children.map((child) => renderNode(child, nextSeen))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <section className="research-tree" aria-labelledby={`${uid}-heading`}>
      <header className="rt-header">
        <div>
          <p className="rt-eyebrow">Dein nächster Parkausbau</p>
          <h2 id={`${uid}-heading`}>Was möchtest du entdecken?</h2>
          <p className="rt-intro">
            {sandbox
              ? "Im freien Spiel sind alle Forschungszweige bereits freigeschaltet."
              : "Wähle einen Einstieg. Die Verbindungen zeigen, was du danach erforschen kannst."}
          </p>
        </div>
        <div
          className="rt-wallet"
          aria-label={
            sandbox
              ? "Im freien Spiel ist alles verfügbar"
              : `${balance} Forschungs-Coins verfügbar`
          }
        >
          <Coins aria-hidden="true" />
          <div>
            <strong>{sandbox ? "Alle" : balance}</strong>
            <span>{sandbox ? "freigeschaltet" : "Forschungs-Coins"}</span>
          </div>
        </div>
      </header>

      {!sandbox && (
        <aside className="rt-reward" aria-label="Forschungs-Coins verdienen">
          <div className="rt-reward-summary">
            <Gift aria-hidden="true" />
            <p>
              <strong>Nächster Jahresbonus in {gameDays(remaining, true)}</strong>
              <span>
                Aktuelle Prognose: {projectedReward} {projectedReward === 1 ? "Coin" : "Coins"}
              </span>
            </p>
            <details className="rt-reward-details">
              <summary>
                <Info aria-hidden="true" />
                So verdienst du Coins
              </summary>
              <div>
                <p>Du startest mit 3 Coins. Ein Parkjahr dauert {DAYS_PER_YEAR} Spieltage – 20 Minuten bei 1×.</p>
                <ol>
                  <li>
                    <b>1 Coin</b>, wenn dein Park das Jahr übersteht.
                  </li>
                  <li>
                    <b>2 Coins insgesamt</b> bei mindestens 70% durchschnittlicher
                    Besucherzufriedenheit im Jahr.
                  </li>
                  <li>
                    <b>3 Coins insgesamt</b>, wenn zusätzlich der Betriebsgewinn des Jahres positiv
                    ist.
                  </li>
                </ol>
                <p>
                  Die Auszahlung erfolgt am Jahresende. Forschung kostet Coins und Spielzeit, kein
                  zusätzliches Geld aus der Parkkasse.
                </p>
              </div>
            </details>
          </div>
        </aside>
      )}

      <div className="rt-tree-toolbar">
        <span>
          <Check aria-hidden="true" />
          {completedCount} von {RESEARCH_IDS.length} freigeschaltet
        </span>
        <span className="rt-scroll-hint">
          <MoveHorizontal aria-hidden="true" />
          Seitlich scrollen für alle 3 Zweige
        </span>
      </div>
      <div
        className="rt-scroll"
        tabIndex={0}
        role="region"
        aria-label="Forschungsbaum mit den Zweigen Zoo, Familie und Thrill; bei schmalem Fenster seitlich scrollen"
      >
        <div className="rt-forest">
          {ROOTS.map(({ id, label, Icon, theme }) => (
            <section
              className="rt-branch"
              data-theme={theme}
              key={id}
              aria-labelledby={`${uid}-${id}-branch`}
            >
              <h3 id={`${uid}-${id}-branch`}>
                <Icon aria-hidden="true" />
                {label}
              </h3>
              <ul className="rt-root">{renderNode(id)}</ul>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ResearchTree;
