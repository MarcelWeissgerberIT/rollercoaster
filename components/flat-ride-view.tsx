import { needsOperator, operationsOf } from "../game/operations";
import { createTransportRig } from "@/game/transport-rig";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Pause, Play, RotateCcw, X, Volume2, VolumeX } from "lucide-react";
import { createWorld } from "../game/scene-world";
import { createAttractionRig } from "../game/attraction-rig";
import { transportPose, transportClock, transportSpeed, isTransport } from "../game/transit";
import { rideDuration, type Building, type Park } from "../game/simulation";
import type { ParkAudio } from "../game/audio";
type Props = {
  park: Park;
  building: Building;
  audio: ParkAudio | null;
  muted: boolean;
  onMute: () => void;
  onClose: () => void;
};
export default function FlatRideView({ park, building, audio, muted, onMute, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null),
    control = useRef({ time: 0, playing: true, mode: "seat", seat: 0, yaw: 0, pitch: 0 });
  const timeline = useRef({ base: 1, total: 1, rounds: 1, finite: false });
  const [mode, setMode] = useState("seat"),
    [playing, setPlaying] = useState(true),
    [seat, setSeat] = useState(0),
    [error, setError] = useState(""),
    [hud, setHud] = useState({
      height: 0,
      progress: 0,
      seats: 1,
      speed: 0,
      round: 1,
      rounds: 1,
      programProgress: 0,
      done: false,
    });
  useEffect(() => {
    if (!host.current) return;
    const target = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError("Dein Browser benötigt WebGL 2 für die Mitfahrt.");
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    target.appendChild(renderer.domElement);
    const world = createWorld(park, building.id),
      scene = world.scene,
      camera = new THREE.PerspectiveCamera(72, 1, 0.08, 750),
      orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.screenSpacePanning = false;
    orbit.minDistance = 4;
    orbit.maxDistance = 450;
    const line = park.transitLines?.find((l) => l.a === building.id || l.b === building.id);
    let root: THREE.Group,
      seats: THREE.Object3D[],
      people: THREE.Object3D[] = [],
      duration: number,
      update: (t: number) => void;
    if (isTransport(building.kind) && line) {
      const rig = createTransportRig(line, park);
      ({ root, seats, duration, update } = rig);
      people = rig.passengers;
      scene.add(root);
    } else {
      const rig = createAttractionRig(building, park);
      ({ root, seats, duration, update } = rig);
      people = rig.passengers;
      scene.add(root);
    }
    const finite = needsOperator(building.kind),
      rounds = finite ? operationsOf(building).rounds : 1,
      total = duration * rounds;
    timeline.current = { base: duration, total, rounds, finite };
    seats[0].getWorldPosition(orbit.target);
    orbit.target.y += 4;
    camera.position.copy(orbit.target).add(new THREE.Vector3(25, 18, 25));
    const overview = () => {
      seats[0].getWorldPosition(orbit.target);
      orbit.target.y += 4;
      camera.position.copy(orbit.target).add(new THREE.Vector3(28, 20, 28));
    };
    const resize = () => {
      renderer.setSize(target.clientWidth, target.clientHeight);
      camera.aspect = target.clientWidth / Math.max(1, target.clientHeight);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(target);
    resize();
    let pointer: { x: number; y: number } | null = null,
      lastMode = "seat",
      last = performance.now(),
      raf = 0,
      report = 0,
      lastTime = -1,
      lastSeat = -1;
    const previous = new THREE.Vector3(),
      position = new THREE.Vector3(),
      q = new THREE.Quaternion();
    const down = (e: PointerEvent) => {
      if (control.current.mode === "seat") {
        pointer = { x: e.clientX, y: e.clientY };
        renderer.domElement.setPointerCapture(e.pointerId);
      }
    };
    const move = (e: PointerEvent) => {
      if (!pointer) return;
      control.current.yaw -= (e.clientX - pointer.x) * 0.005;
      control.current.pitch = THREE.MathUtils.clamp(
        control.current.pitch - (e.clientY - pointer.y) * 0.005,
        -1.1,
        1.1,
      );
      pointer = { x: e.clientX, y: e.clientY };
    };
    const up = () => (pointer = null);
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    const animate = (now: number) => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const c = control.current;
      if (document.hidden) {
        audio?.ride(0, false);
        return;
      }
      if (c.playing) c.time = finite ? Math.min(total, c.time + dt) : c.time + dt;
      const done = finite && c.time >= total;
      if (done && c.playing) {
        c.playing = false;
        setPlaying(false);
      }
      update(c.time);
      world.update(c.time);
      const selected = Math.min(seats.length - 1, c.seat),
        anchor = seats[selected];
      anchor.getWorldPosition(position);
      anchor.getWorldQuaternion(q);
      const continuous =
        c.playing &&
        lastSeat === selected &&
        lastTime >= 0 &&
        Math.abs(c.time - lastTime - dt) < 0.001;
      const speed = continuous && dt > 0 ? Math.min(150, position.distanceTo(previous) / dt) : 0;
      previous.copy(position);
      lastTime = c.time;
      lastSeat = selected;
      orbit.enabled = c.mode === "overview";
      if (c.mode !== lastMode && orbit.enabled) overview();
      lastMode = c.mode;
      people.forEach(
        (p, i) =>
          (p.visible =
            i < (line?.passengers.length ?? building.riders.length) &&
            (i !== selected || c.mode !== "seat")),
      );
      if (c.mode === "seat") {
        camera.position.copy(position);
        camera.quaternion
          .copy(q)
          .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(c.pitch, c.yaw, 0, "YXZ")));
      } else orbit.update();
      renderer.render(scene, camera);
      audio?.ride(speed, c.playing, "coast");
      if (now - report > 120) {
        report = now;
        setHud({
          height: Math.max(0, Math.round(position.y)),
          progress: done ? 1 : (c.time % duration) / duration,
          programProgress: finite ? c.time / total : (c.time % duration) / duration,
          round: done ? rounds : Math.min(rounds, Math.floor(c.time / duration) + 1),
          rounds,
          done,
          seats: seats.length,
          speed: Math.round(speed * 3.6),
        });
      }
    };
    raf = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      orbit.dispose();
      audio?.ride(0, false);
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
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
          <span className="eyebrow">3D · PROBEFAHRT</span>
          <h2>{building.name}</h2>
        </div>
        <button className="secondary" onClick={onClose}>
          <X size={18} /> Zurück zum Park
        </button>
      </div>
      <div className="ride-scene" ref={host} />
      {error && <div className="ride-error">{error}</div>}
      <div className="ride-hud">
        <strong>
          {hud.height} m · {hud.speed} km/h
        </strong>
        <span>
          {hud.done
            ? `Programm beendet · ${hud.rounds} Runden`
            : needsOperator(building.kind)
              ? `Runde ${hud.round}/${hud.rounds} · ${Math.round(hud.progress * 100)} %`
              : `${Math.round(hud.progress * 100)} % der Rundfahrt`}
        </span>
      </div>
      <input
        className="ride-timeline"
        aria-label="Position in der Fahrt"
        type="range"
        min={0}
        max={1000}
        value={Math.round(hud.programProgress * 1000)}
        onChange={(e) => {
          control.current.time = (Number(e.target.value) / 1000) * timeline.current.total;
          control.current.playing = false;
          setPlaying(false);
        }}
      />
      <div className="ride-controls">
        <button
          className="primary"
          onClick={() => {
            if (
              !playing &&
              timeline.current.finite &&
              control.current.time >= timeline.current.total
            )
              control.current.time = 0;
            control.current.playing = !playing;
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />} {playing ? "Pause" : "Start"}
        </button>
        <button
          className="secondary"
          aria-label="Mitfahrt neu starten"
          onClick={() => {
            control.current.time = 0;
            control.current.yaw = control.current.pitch = 0;
          }}
        >
          <RotateCcw size={18} />
        </button>
        <div className="build-modes">
          {[
            ["seat", "Im Sitz"],
            ["overview", "Freie Kamera"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={mode === id ? "active" : ""}
              onClick={() => {
                setMode(id);
                control.current.mode = id;
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          Sitz{" "}
          <select
            aria-label="Sitzplatz"
            value={seat}
            onChange={(e) => {
              setSeat(+e.target.value);
              control.current.seat = +e.target.value;
            }}
          >
            {Array.from({ length: hud.seats }, (_, i) => (
              <option value={i} key={i}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary" onClick={onMute} aria-label="Sound umschalten">
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
      <p className="ride-caption">
        {mode === "seat"
          ? "Ziehen zum Umsehen · Sitzplatz wechseln"
          : "Links ziehen: drehen · Rechts ziehen: verschieben · Mausrad: zoomen"}{" "}
        · Der Park pausiert während der Probefahrt.
      </p>
    </div>
  );
}
