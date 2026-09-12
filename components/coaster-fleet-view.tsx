import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Pause, Play, X, Volume2, VolumeX } from "lucide-react";
import { tick, type Building, type Park } from "../game/simulation";
import type { ParkAudio } from "../game/audio";
import { createWorld } from "../game/scene-world";
import { createCoasterFleetScene } from "../game/coaster-fleet-scene";
import { makeRidePath } from "../game/ride-path";
import { addCoasterStructure } from "../game/coaster-structure";
import { addDriveHardware } from "../game/track-hardware";
import { addPhotoHardware, isPhotoPoint, crossedPhotoPoint } from "../game/coaster-photo";
import { createRidePhotoCapture, type RidePhoto } from "../game/coaster-photo-capture";
import { coasterTrainVisuals, TRAIN_PHASE_LABELS } from "../game/coaster-trains";
import { prepareRoute } from "../game/motion";
import { forceAt } from "../game/gforce";
import { vehicleFor } from "../game/vehicles";

export default function CoasterFleetView({
  park,
  building,
  audio,
  muted,
  onMute,
  onClose,
}: {
  park: Park;
  building: Building;
  audio: ParkAudio | null;
  muted: boolean;
  onMute: () => void;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    selected = useRef(building.trainFleet!.trains.find((t) => t.riders.length)?.id ?? 1),
    control = useRef({ playing: true, test: false, camera: "front" }),
    [playing, setPlaying] = useState(true),
    [train, setTrain] = useState(selected.current),
    [error, setError] = useState(""),
    [photo, setPhoto] = useState<RidePhoto | null>(null),
    [photoError, setPhotoError] = useState(""),
    [hud, setHud] = useState({
      phase: "Bereit",
      speed: 0,
      height: 0,
      g: 1,
      vertical: 1,
      lateral: 0,
      longitudinal: 0,
      peak: 1,
      guests: 0,
    });
  useEffect(() => {
    if (!host.current) return;
    const preview = structuredClone(park),
      b = preview.buildings.find((b) => b.id === building.id)!;
    preview.speed = 1;
    const world = createWorld(preview, b.id),
      path = makeRidePath(b.track!),
      route = prepareRoute(b.track!);
    addCoasterStructure(world.scene, preview, b, path);
    addDriveHardware(world.scene, path);
    const fleet = createCoasterFleetScene(world.scene, preview, b, path),
      photoRig = isPhotoPoint(b.photoPoint)
        ? addPhotoHardware(world.scene, path, b.photoPoint)
        : null,
      photos = createRidePhotoCapture(setPhoto, setPhotoError);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      setError("Für diese Mitfahrt wird WebGL 2 benötigt.");
      world.dispose();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const target = host.current;
    target.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(72, 1, 0.08, 600),
      resize = () => {
        renderer.setSize(target.clientWidth, target.clientHeight);
        camera.aspect = target.clientWidth / Math.max(1, target.clientHeight);
        camera.updateProjectionMatrix();
      },
      observer = new ResizeObserver(resize);
    observer.observe(target);
    resize();
    let last = performance.now(),
      elapsed = 0,
      lastHud = 0,
      peak = 1,
      previousSpeed = 0,
      previousTrain = selected.current,
      photoProgress: number | null = null,
      photoTaken = false,
      lost = false;
    const contextLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      setError("Die 3D-Verbindung wurde unterbrochen. Öffne die Mitfahrt erneut.");
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    renderer.setAnimationLoop((now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden || lost) {
        audio?.ride(0, true);
        audio?.rideCheer(null);
        return;
      }
      if (control.current.test) {
        const t = b.trainFleet!.trains.find((t) => t.id === selected.current)!;
        if (!t.riders.length && ["waiting", "boarding", "blocked"].includes(t.phase)) {
          t.phase = "running";
          t.roundsLeft = 1;
        }
        control.current.test = false;
      }
      if (control.current.playing) {
        tick(preview, dt);
        elapsed += dt;
      }
      world.update(0);
      fleet.update();
      const t = coasterTrainVisuals(b).find((t) => t.id === selected.current)!,
        p = path.at(t.distance / route.length),
        acceleration = dt && previousTrain === t.id ? (t.speed - previousSpeed) / dt : 0,
        forces = forceAt(route, t.distance, {
          speed: t.speed,
          tangentialAcceleration: acceleration,
          stationary: t.speed < 0.05,
        });
      if (previousTrain !== t.id) {
        photoProgress = null;
        photoTaken = false;
        peak = 1;
        photos.clear();
      }
      previousTrain = t.id;
      previousSpeed = t.speed;
      peak = Math.max(peak, forces.total);
      const suspended = vehicleFor(b).model === ("suspended" as string),
        chase = control.current.camera === "chase";
      camera.position
        .copy(p.position)
        .addScaledVector(p.up, (suspended ? -2.1 : 0) + (chase ? 4 : 1.55))
        .addScaledVector(p.tangent, chase ? -(t.cars * 3.7 + 5) : 1.15);
      camera.up.copy(p.up);
      camera.lookAt(
        p.position
          .clone()
          .addScaledVector(p.tangent, 12)
          .addScaledVector(p.up, (suspended ? -2.1 : 0) + 1.55),
      );
      const progress = t.completed + t.distance / route.length,
        trigger =
          control.current.playing &&
          !photoTaken &&
          isPhotoPoint(b.photoPoint) &&
          crossedPhotoPoint(photoProgress, progress, b.photoPoint);
      photoRig?.setFlash(trigger ? 1 : 0);
      renderer.render(world.scene, camera);
      if (trigger)
        photoTaken = photos.capture(renderer.domElement, "Coaster-Grove-Zug-Mitfahrt.jpg");
      photoProgress = progress;
      audio?.ride(
        control.current.playing ? t.speed : 0,
        true,
        t.speed > 0.05 ? p.phase : "station",
        b.track![0].style ?? "steel",
      );
      audio?.rideCheer({
        time: elapsed,
        speed: t.speed,
        tangent: p.tangent,
        up: p.up,
        verticalG: forces.vertical,
        phase: p.phase,
        playing: control.current.playing && t.speed > 1,
        visible: true,
        people: t.riders.length,
      });
      if (now - lastHud > 120) {
        lastHud = now;
        setHud({
          phase: TRAIN_PHASE_LABELS[t.phase],
          speed: Math.round(t.speed * 3.6),
          height: Math.round(p.position.y),
          g: forces.total,
          vertical: forces.vertical,
          lateral: forces.lateral,
          longitudinal: forces.longitudinal,
          peak,
          guests: t.riders.length,
        });
      }
    });
    return () => {
      photos.dispose();
      renderer.setAnimationLoop(null);
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      audio?.ride(0, false);
      audio?.rideCheer(null);
      world.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [park, building, audio]);
  return (
    <div className="ride-view">
      <div className="ride-top">
        <div>
          <span className="eyebrow">3D · ZUG {train} · SIMULIERTE MITFAHRT</span>
          <h2>{building.name}</h2>
        </div>
        <button className="secondary" onClick={onClose}>
          <X size={18} /> Zurück zum Park
        </button>
      </div>
      <div className="ride-scene" ref={host} />
      {error && (
        <div className="ride-error">
          <strong>{error}</strong>
          <button className="primary" onClick={onClose}>
            Zurück zum Park
          </button>
        </div>
      )}
      {photo && (
        <aside className="ride-photo">
          <img src={photo.url} alt="Foto deiner Zug-Mitfahrt" width={180} />
          <a href={photo.url} download={photo.filename}>
            Foto herunterladen
          </a>
        </aside>
      )}
      {photoError && (
        <p className="photo-error" role="status">
          {photoError}
        </p>
      )}
      <div className="ride-hud">
        <strong>
          {hud.speed} km/h · {hud.height} m
        </strong>
        <span>
          {hud.phase} · {hud.guests} Gäste
        </span>
      </div>
      <aside className="gforce-hud" aria-label="G-Kraft-Messung">
        <span className="eyebrow">G-KRAFT · ZUG {train}</span>
        <strong>
          {hud.g.toFixed(2)} <small>g</small>
        </strong>
        <div className="gforce-axes">
          <span>Vertikal {hud.vertical.toFixed(2)} g</span>
          <span>Seitlich {hud.lateral.toFixed(2)} g</span>
          <span>Längs {hud.longitudinal.toFixed(2)} g</span>
        </div>
        <small>Spitze {hud.peak.toFixed(2)} g · tatsächliche Zuggeschwindigkeit</small>
      </aside>
      <div className="ride-controls">
        <button
          className="primary"
          onClick={() => {
            control.current.playing = !playing;
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />} {playing ? "Pause" : "Weiter"}
        </button>
        {building.trainFleet!.trains.map((t) => (
          <button
            key={t.id}
            className="secondary"
            aria-pressed={train === t.id}
            onClick={() => {
              selected.current = t.id;
              setTrain(t.id);
            }}
          >
            Zug {t.id}
          </button>
        ))}
        <button
          className="secondary"
          onClick={() => {
            control.current.camera = control.current.camera === "front" ? "chase" : "front";
          }}
        >
          Kamera wechseln
        </button>
        <button
          className="secondary"
          onClick={() => {
            control.current.test = true;
            control.current.playing = true;
            setPlaying(true);
          }}
        >
          Leere Testfahrt starten
        </button>
        <button
          className="secondary"
          aria-label={muted ? "Ton einschalten" : "Ton ausschalten"}
          onClick={onMute}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
    </div>
  );
}
