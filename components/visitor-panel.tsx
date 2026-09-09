import { useEffect, useRef, useState } from "react";
import { Heart, Users, Baby } from "lucide-react";
import type { Guest, Park } from "../game/simulation";
import { guestName } from "../game/guest-identity";
import {
  guestAppearance,
  visitorAudience,
  visitorPartyLabel,
  PARTY_LABELS,
} from "../game/visitors";
import { drawWalkingGuest } from "../game/guest-sprite";
import { assetUrl } from "../game/assets";
import "./visitor-panel.css";

function GuestPortrait({ guest }: { guest: Guest }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const ctx = ref.current?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, 72, 88);
      drawWalkingGuest(ctx, image, guest, 36, 76, 2.6);
    };
    image.src = assetUrl("walk-red-se-1");
    return () => {
      image.onload = null;
    };
  }, [guest.id, guest.appearance, guest.ageGroup]);
  return (
    <canvas
      ref={ref}
      width={72}
      height={88}
      className="vp-portrait"
      aria-label={`Spielfigur von ${guest.name ?? guestName(guest.id)}`}
      role="img"
    />
  );
}

export function VisitorAudiencePanel({ park }: { park: Park }) {
  const audience = visitorAudience(park);
  const children = park.guests.filter((g) => guestAppearance(g).ageGroup === "child").length;
  const parties = new Set(
    park.guests.filter((g) => g.party && g.party.kind !== "solo").map((g) => g.party!.id),
  ).size;
  return (
    <section className="vp-audience" data-testid="visitor-audience">
      <h3>
        <Users size={18} /> Wer besucht deinen Park?
      </h3>
      <div className="vp-counters">
        <span>
          <b>{children}</b> Kinder
        </span>
        <span>
          <b>{park.guests.length - children}</b> Erwachsene
        </span>
        <span>
          <b>{parties}</b> Gruppen
        </span>
      </div>
      <details>
        <summary>Welche Gäste zieht dein Angebot an?</summary>
        <p>{audience.summary}</p>
        {(["family", "couple", "friends", "solo"] as const).map((kind) => (
          <div className={`vp-share vp-${kind}`} key={kind}>
            <span>{PARTY_LABELS[kind]}</span>
            <b>{Math.round(audience.percentages[kind])} %</b>
            <i>
              <em style={{ width: `${audience.percentages[kind]}%` }} />
            </i>
          </div>
        ))}
        <ul>
          {audience.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

export function VisitorPanel({ park }: { park: Park }) {
  const [filter, setFilter] = useState("all");
  const filtered = park.guests.filter(
    (g) =>
      filter === "all" ||
      (filter === "child" ? guestAppearance(g).ageGroup === "child" : g.party?.kind === filter),
  );
  return (
    <div className="vp-panel">
      <VisitorAudiencePanel park={park} />
      <div className="vp-filters" aria-label="Besucher filtern">
        {[
          { id: "all", label: "Alle" },
          { id: "family", label: "Familien" },
          { id: "couple", label: "Paare" },
          { id: "child", label: "Kinder" },
        ].map((item) => (
          <button
            key={item.id}
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {!filtered.length && (
        <p className="vp-empty">
          Noch keine{" "}
          {filter === "child"
            ? "Kinder"
            : filter === "couple"
              ? "Paare"
              : filter === "family"
                ? "Familien"
                : "Besucher"}{" "}
          im Park. Neue Gruppen kommen nach und nach am Eingang an.
        </p>
      )}
      {filtered.slice(0, 18).map((g) => (
        <article className="vp-guest" key={g.id} data-testid={`visitor-${g.id}`}>
          <GuestPortrait guest={g} />
          <div>
            <strong>{g.name ?? guestName(g.id)}</strong>
            <span className="vp-party">
              {g.party?.kind === "couple" ? (
                <Heart size={12} />
              ) : guestAppearance(g).ageGroup === "child" ? (
                <Baby size={13} />
              ) : (
                <Users size={12} />
              )}
              {visitorPartyLabel(g)}
            </span>
            <small>
              {guestAppearance(g).ageGroup === "child" ? "Kind" : "Erwachsen"} ·{" "}
              {g.profile === "thrill"
                ? "Nervenkitzel"
                : g.profile === "budget"
                  ? "Sparfuchs"
                  : "Gemütliche Erlebnisse"}
            </small>
            <small>
              Budget {Math.round(g.wallet ?? 60)} € · Zufriedenheit {Math.round(g.happiness)} %
            </small>
            <p>{g.thought}</p>
          </div>
        </article>
      ))}
      {filtered.length > 18 && (
        <p className="vp-empty">18 von {filtered.length} Gästen in dieser Auswahl</p>
      )}
    </div>
  );
}
