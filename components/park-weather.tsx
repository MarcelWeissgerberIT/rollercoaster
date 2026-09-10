import { useEffect, useRef, useState } from "react";
import { Cloud, CloudRain, Sun, ThermometerSun, Umbrella, X } from "lucide-react";
import type { Park } from "../game/simulation";
import { calendarOf, DAYS_PER_YEAR, DAY_SECONDS } from "../game/calendar";
import { forecastWeather, parkWeather, type WeatherSnapshot } from "../game/weather";
import "./park-weather.css";

const weatherIcon = (kind: WeatherSnapshot["kind"]) =>
  ({ sun: Sun, cloud: Cloud, rain: CloudRain, heat: ThermometerSun })[kind];

export function ParkCalendar({ park }: { park: Park | null }) {
  const date = calendarOf(park ?? { time: 0 });
  return (
    <div
      className="day park-calendar"
      title={`${DAYS_PER_YEAR} Parktage pro Jahr · ${DAY_SECONDS.toFixed(1)} Sekunden pro Tag · 20 Minuten pro Jahr bei 1×. Pause hält die Zeit an.`}
    >
      <strong>
        {date.weekday} · Tag {date.day}
      </strong>
      <span>
        {date.seasonName} · Jahr {date.year}
      </span>
      <div
        className="calendar-progress"
        aria-label={`Jahr ${Math.round(date.yearProgress * 100)} Prozent abgeschlossen`}
      >
        <i style={{ width: `${date.yearProgress * 100}%` }} />
      </div>
    </div>
  );
}

export function ParkWeather({ park, onBuild }: { park: Park | null; onBuild: () => void }) {
  const [open, setOpen] = useState(false),
    root = useRef<HTMLDivElement>(null);
  const state = park ?? { time: 0 },
    weather = parkWeather(state),
    Icon = weatherIcon(weather.kind),
    forecast = forecastWeather(state);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="park-weather" ref={root}>
      <button
        className={`metric weather weather-toggle weather-${weather.kind}`}
        aria-expanded={open}
        aria-label={`Wetter: ${weather.label}, ${Math.round(weather.temperature)} Grad. Vorhersage anzeigen`}
        onClick={() => setOpen(!open)}
      >
        <Icon />
        <div>
          <strong>{Math.round(weather.temperature)}°</strong>
          <span>{weather.label}</span>
        </div>
      </button>
      {open && (
        <section className="weather-forecast" aria-label="Wettervorhersage">
          <div className="weather-title">
            <div>
              <small>DEIN PARKWETTER</small>
              <h3>{weather.label}</h3>
            </div>
            <button aria-label="Wettervorhersage schließen" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <p>{weather.description}</p>
          <div className="weather-future">
            {forecast.map((w, i) => {
              const FutureIcon = weatherIcon(w.kind);
              return (
                <div key={`${w.phaseStart}-${i}`}>
                  <FutureIcon size={22} />
                  <strong>{w.label}</strong>
                  <span>
                    {Math.round(w.temperature)}° · in{" "}
                    {Math.max(1, Math.ceil(w.phaseStart - state.time))} s
                  </span>
                </div>
              );
            })}
          </div>
          <p className="weather-help">
            Pavillons halten trocken. Schattenplätze und Bäume helfen bei Hitze. Trinkbrunnen bieten
            kostenloses Wasser.
          </p>
          <button
            className="weather-build"
            onClick={() => {
              setOpen(false);
              onBuild();
            }}
          >
            <Umbrella size={18} /> Schutz & Schatten bauen
          </button>
          <small className="weather-clock-note">
            Spielzeit bei 1× · Wetter und Kalender pausieren gemeinsam.
          </small>
        </section>
      )}
    </div>
  );
}
