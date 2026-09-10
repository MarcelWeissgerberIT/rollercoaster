import { createBirdScene } from "../game/bird-scene";
import { createWeatherScene } from "../game/weather-scene";
import { addCoasterStructure } from "../game/coaster-structure";
import { addPhotoHardware, isPhotoPoint, crossedPhotoPoint } from "../game/coaster-photo";
import { createRidePhotoCapture, type RidePhoto } from "../game/coaster-photo-capture";
import { operationsOf } from "../game/operations";
import { PATH_STYLES, pathStyleAt } from "../game/park-life";
import ZooView from "./zoo-view";
import { isHabitat } from "../game/zoo";
import { forceAt, analyzeForces } from "../game/gforce";
import { prepareRoute } from "../game/motion";
import { createCoasterCar } from "../game/coaster-car";
import { vehicleFor, carSeat } from "../game/vehicles";
import { addDriveHardware } from "@/game/track-hardware";
import { createGuestModel } from "@/game/guest-model";
import FlatRideView from "./flat-ride-view";
import { mapWidth, mapHeight } from "../game/grid";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Pause, Play, RotateCcw, X, Volume2, VolumeX } from "lucide-react";
import { type Building, type Park, CATALOG, rideCapacity } from "../game/simulation";
import { populatePark } from "../game/park-scene";
import { PHASE_NAMES, type RidePhase } from "../game/motion";
import { makeRidePath } from "../game/ride-path";
import type { ParkAudio } from "../game/audio";
type Props = {
  park: Park;
  building: Building;
  audio: ParkAudio | null;
  muted: boolean;
  onMute: () => void;
  onClose: () => void;
};
export default function RideView(props: Props) {
  return isHabitat(props.building.kind) ? (
    <ZooView {...props} />
  ) : props.building.kind === "coaster" ? (
    <CoasterRideView {...props} />
  ) : (
    <FlatRideView {...props} />
  );
}
function CoasterRideView({ park, building, audio, muted, onMute, onClose }: Props) {
  const compiledPath = useMemo(() => makeRidePath(building.track!), [building.track]);
  const forceRoute = useMemo(() => prepareRoute(building.track!), [building.track]);
  const forceAnalysis = useMemo(() => analyzeForces(building.track!), [building.track]);
  const host = useRef<HTMLDivElement>(null),
    control = useRef({
      playing: true,
      time: 0,
      camera: "front",
      reset: 0,
      photoSeek: 0,
      orbit: { yaw: 0.72, pitch: 0.68, radius: 180 },
    });
  const [playing, setPlaying] = useState(true),
    [mode, setMode] = useState("front"),
    [error, setError] = useState("");
  const [photo, setPhoto] = useState<RidePhoto | null>(null),
    [photoError, setPhotoError] = useState("");
  const rounds = operationsOf(building).rounds;
  const [hud, setHud] = useState({
    speed: 0,
    lap: 1,
    forces: { vertical: 1, lateral: 0, longitudinal: 0, total: 1 },
    peakG: 1,
    airtime: false,
    height: 0,
    progress: 0,
    trackProgress: 0,
    phase: "station" as RidePhase,
  });
  useEffect(() => {
    const target = host.current;
    if (!target) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      setError(
        "Die 3D-Mitfahrt braucht WebGL 2. Aktiviere die Hardwarebeschleunigung deines Browsers.",
      );
      return;
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#acdbe4");
    scene.fog = new THREE.Fog("#acdbe4", 145, 340);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    target.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(72, 1, 0.08, 400);
    const ambient = new THREE.HemisphereLight("#e6faff", "#597340", 2.7);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight("#fff0d0", 2.5);
    sun.position.set(40, 100, -40);
    scene.add(sun);
    const weatherScene = createWeatherScene(scene, park, { ambient, sun });
    const birds = createBirdScene(scene, park);
    const materials = new Map<string, THREE.MeshStandardMaterial>();
    const mat = (color: string) => {
      if (!materials.has(color))
        materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
      return materials.get(color)!;
    };
    const cube = new THREE.BoxGeometry(1, 1, 1),
      cylinder = new THREE.CylinderGeometry(1, 1, 1, 8),
      cone = new THREE.ConeGeometry(1, 1, 7);
    function mesh(
      geometry: THREE.BufferGeometry,
      color: string,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      parent: THREE.Object3D = scene,
    ) {
      const m = new THREE.Mesh(geometry, mat(color));
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      parent.add(m);
      return m;
    }
    const ground = mesh(
      cube,
      "#7caa49",
      (mapWidth(park) - 1) * 2.5,
      -0.6,
      (mapHeight(park) - 1) * 2.5,
      mapWidth(park) * 5,
      1,
      mapHeight(park) * 5,
    );
    const tileGeometry = new THREE.BoxGeometry(4.96, 0.12, 4.96);
    for (const type of ["path", "queue", "exit", "water"] as const) {
      const tiles = park.tiles.flatMap((row, y) =>
        row.flatMap((t, x) => (t === type ? [{ x, y }] : [])),
      );
      const instances = new THREE.InstancedMesh(
        tileGeometry,
        mat(
          type === "water"
            ? "#47a6bf"
            : type === "queue"
              ? "#79aadd"
              : type === "exit"
                ? "#db8b81"
                : "#ffffff",
        ),
        tiles.length,
      );
      const matrix = new THREE.Matrix4();
      tiles.forEach((t, i) => {
        matrix.makeTranslation(t.x * 5, 0.01, t.y * 5);
        instances.setMatrixAt(i, matrix);
        if (type === "path")
          instances.setColorAt(i, new THREE.Color(PATH_STYLES[pathStyleAt(park, t.x, t.y)].color));
      });
      scene.add(instances);
    }
    const updatePark = populatePark(scene, park, building.id, mesh, mat, cube, cylinder, cone);
    const path = compiledPath;
    addCoasterStructure(scene, park, building, path);
    const train = Array.from({ length: Math.ceil(rideCapacity(building) / 2) }, (_, i) => {
      const wagon = createCoasterCar(vehicleFor(building), i);
      scene.add(wagon);
      return wagon;
    });
    train.forEach((wagon, i) => {
      for (let side = 0; side < 2; side++)
        if (i * 2 + side < building.riders.length) {
          const seat = carSeat(vehicleFor(building), side);
          const person = createGuestModel(
            park.guests.find((g) => g.id === building.riders[i * 2 + side]),
          );
          person.position.set(seat.x, 0.75, seat.z);
          wagon.add(person);
        }
    });
    addDriveHardware(scene, path);
    const photoRig = isPhotoPoint(building.photoPoint)
      ? addPhotoHardware(scene, path, building.photoPoint)
      : null;
    const photos = createRidePhotoCapture(setPhoto, setPhotoError);
    const photoCamera = new THREE.PerspectiveCamera(50, camera.aspect, 0.08, 400);
    let photoPrevious: number | null = null,
      photoCaptured = false,
      seenPhotoSeek = control.current.photoSeek;
    const programDuration = path.duration * rounds;
    const desiredCamera = new THREE.PerspectiveCamera();
    const resize = () => {
      const w = target.clientWidth,
        h = target.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    let pointer: { x: number; y: number } | null = null;
    const pointerDown = (e: PointerEvent) => {
      if (control.current.camera !== "overview") return;
      pointer = { x: e.clientX, y: e.clientY };
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const pointerMove = (e: PointerEvent) => {
      if (!pointer) return;
      const orbit = control.current.orbit;
      orbit.yaw -= (e.clientX - pointer.x) * 0.008;
      orbit.pitch = Math.max(0.25, Math.min(1.35, orbit.pitch + (e.clientY - pointer.y) * 0.006));
      pointer = { x: e.clientX, y: e.clientY };
    };
    const pointerUp = () => {
      pointer = null;
    };
    const wheel = (e: WheelEvent) => {
      if (control.current.camera !== "overview") return;
      e.preventDefault();
      control.current.orbit.radius = Math.max(
        45,
        Math.min(250, control.current.orbit.radius * Math.exp(e.deltaY * 0.001)),
      );
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointercancel", pointerUp);
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    const observer = new ResizeObserver(resize);
    observer.observe(target);
    resize();
    let last = performance.now(),
      lastHud = 0,
      parkTime = 0,
      initialized = false,
      lost = false,
      peakG = 1;
    const contextLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      audio?.ride(0, false);
      setError("Die 3D-Verbindung wurde unterbrochen. Schließe die Mitfahrt und öffne sie erneut.");
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    renderer.setAnimationLoop((now) => {
      if (lost) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden) {
        audio?.ride(0, true);
        audio?.rideCheer(null);
        return;
      }
      const c = control.current;
      if (c.reset) {
        photoPrevious = null;
        photoCaptured = false;
        photos.clear();
        setPhotoError("");
        c.time = 0;
        peakG = 1;
        c.reset = 0;
        initialized = false;
      }
      if (c.playing) c.time = Math.min(programDuration, c.time + dt);
      const lap = Math.min(rounds - 1, Math.floor(c.time / path.duration));
      const u = path.progress(c.time >= programDuration ? path.duration : c.time % path.duration),
        p = path.at(u),
        speed = c.playing ? p.speed : 0;
      const forces = forceAt(forceRoute, u * forceRoute.length, {
        stationary: c.time >= programDuration,
      });
      if (c.playing) peakG = Math.max(peakG, forces.total);
      if (c.playing) parkTime += dt;
      updatePark(parkTime);
      train.forEach((wagon, i) => {
        const frame = path.at((((u - (i * 3.7) / path.length) % 1) + 1) % 1);
        wagon.position.copy(frame.position);
        wagon.quaternion.copy(frame.quaternion);
      });
      let cameraPosition = p.position
          .clone()
          .addScaledVector(p.up, 1.55)
          .addScaledVector(p.tangent, 1.15),
        quaternion = p.quaternion;
      if (c.camera === "chase") {
        cameraPosition
          .addScaledVector(p.tangent, -(train.length * 3.7 + 4))
          .addScaledVector(p.up, 4);
        desiredCamera.position.copy(cameraPosition);
        desiredCamera.up.copy(p.up);
        desiredCamera.lookAt(p.position.clone().addScaledVector(p.tangent, 4));
        quaternion = desiredCamera.quaternion.clone();
      }
      if (c.camera === "overview") {
        const o = c.orbit;
        cameraPosition = new THREE.Vector3(
          75 + Math.cos(o.yaw) * Math.cos(o.pitch) * o.radius,
          Math.sin(o.pitch) * o.radius,
          75 + Math.sin(o.yaw) * Math.cos(o.pitch) * o.radius,
        );
        desiredCamera.position.copy(cameraPosition);
        desiredCamera.up.set(0, 1, 0);
        desiredCamera.lookAt(75, 0, 75);
        quaternion = desiredCamera.quaternion.clone();
      }
      const fov = c.camera === "overview" ? 50 : 72;
      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      if (!initialized || c.camera === "front") camera.position.copy(cameraPosition);
      else camera.position.lerp(cameraPosition, 1 - Math.exp(-dt / 0.08));
      if (!initialized) camera.quaternion.copy(quaternion);
      else camera.quaternion.slerp(quaternion, 1 - Math.exp(-dt / 0.055));
      initialized = true;
      audio?.ride(
        speed,
        true,
        c.playing ? p.phase : "station",
        building.track?.[0]?.style ?? "steel",
      );
      audio?.rideCheer({
        time: c.time,
        speed: p.speed,
        tangent: p.tangent,
        up: p.up,
        verticalG: forces.vertical,
        phase: p.phase,
        playing: c.playing && c.time < programDuration,
        visible: !document.hidden,
        people: Math.max(1, building.riders.length),
      });
      const photoProgress = lap + u;
      if (seenPhotoSeek !== c.photoSeek) {
        photoPrevious = photoProgress;
        seenPhotoSeek = c.photoSeek;
      }
      const triggerPhoto =
        c.playing &&
        !photoCaptured &&
        isPhotoPoint(building.photoPoint) &&
        crossedPhotoPoint(photoPrevious, photoProgress, building.photoPoint);
      photoRig?.setFlash(triggerPhoto ? 1 : 0);
      weatherScene.update(park.time + parkTime, camera);
      birds.update(park.time + parkTime);
      renderer.render(scene, camera);
      if (triggerPhoto) {
        photoCamera.aspect = camera.aspect;
        photoCamera.updateProjectionMatrix();
        photoCamera.position
          .copy(p.position)
          .addScaledVector(p.right, 7)
          .addScaledVector(p.up, 3)
          .addScaledVector(p.tangent, 6);
        photoCamera.up.copy(p.up);
        photoCamera.lookAt(p.position.clone().addScaledVector(p.up, 0.9));
        renderer.render(scene, photoCamera);
        photoCaptured = photos.capture(renderer.domElement, "Coaster-Grove-Mitfahrt.jpg");
        renderer.render(scene, camera);
      }
      photoPrevious = photoProgress;
      if (now - lastHud > 150) {
        lastHud = now;
        setHud({
          lap: lap + 1,
          speed: Math.round(speed * 3.6),
          forces,
          peakG,
          airtime: forces.vertical < 0.3 && p.up.y > 0.2 && p.speed > 1,
          height: Math.max(0, Math.round(p.position.y - 1.1)),
          progress: c.time / programDuration,
          trackProgress: u,
          phase: p.phase,
        });
      }
      if (c.time >= programDuration && c.playing) {
        c.playing = false;
        setPlaying(false);
        audio?.ride(0, true);
      }
    });
    return () => {
      photos.dispose();
      weatherScene.dispose();
      birds.dispose();
      renderer.setAnimationLoop(null);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerUp);
      renderer.domElement.removeEventListener("wheel", wheel);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      audio?.ride(0, false);
      const geometries = new Set<THREE.BufferGeometry>();
      const sceneMaterials = new Set<THREE.Material>();
      const maps = new Set<THREE.Texture>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          geometries.add(o.geometry);
          for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
            sceneMaterials.add(material);
            for (const value of Object.values(material))
              if (value instanceof THREE.Texture) maps.add(value);
          }
        }
        if (o instanceof THREE.InstancedMesh) o.dispose();
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => sceneMaterials.add(m));
      sceneMaterials.forEach((m) => m.dispose());
      maps.forEach((t) => t.dispose());
      ground.removeFromParent();
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
      {photo && (
        <aside className="ride-photo">
          <img src={photo.url} alt="Dein Foto aus der Mitfahrt" width={180} />
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
      {error && (
        <div className="ride-error">
          <strong>Mitfahrt nicht verfügbar</strong>
          <p>{error}</p>
          <button className="primary" onClick={onClose}>
            Zurück zum Park
          </button>
        </div>
      )}
      <div className="ride-hud">
        <div>
          <strong>{hud.speed}</strong> km/h <span>·</span> <strong>{hud.height}</strong> m
        </div>
        <span>
          {hud.progress >= 0.999
            ? "Zurück an der Station"
            : `Runde ${hud.lap}/${rounds} · ${PHASE_NAMES[hud.phase]} · ${Math.round(hud.progress * 100)} %`}
        </span>
      </div>
      <aside className="gforce-hud" aria-label="G-Kraft-Messung">
        <span className="eyebrow">G-KRAFT · LIVE</span>
        <strong className={hud.forces.total > 4.5 ? "g-high" : ""}>
          {hud.forces.total.toFixed(2)} <small>g</small>
        </strong>
        <div className="gforce-axes">
          {(
            [
              ["Vertikal", hud.forces.vertical],
              ["Seitlich", hud.forces.lateral],
              ["Längs", hud.forces.longitudinal],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <b>
                {value > 0 ? "+" : ""}
                {value.toFixed(2)} g
              </b>
            </div>
          ))}
        </div>
        <span>
          {hud.airtime
            ? "Airtime!"
            : hud.forces.total > 4.5
              ? "Starke Belastung"
              : hud.forces.total > 2
                ? "Ab in den Sitz!"
                : "Entspannte Fahrt"}
        </span>
        <small>Spitze dieser Mitfahrt: {hud.peakG.toFixed(2)} g</small>
        <svg
          viewBox="0 0 240 48"
          aria-label="Vertikales G-Kraft-Profil der gesamten Strecke"
          role="img"
        >
          <line x1="0" y1="36" x2="240" y2="36" stroke="#86a893" strokeDasharray="3 3" />
          <polyline
            fill="none"
            stroke="#f2bd48"
            strokeWidth="2"
            points={forceAnalysis.samples
              .filter(
                (_, i) => i % Math.max(1, Math.floor(forceAnalysis.samples.length / 120)) === 0,
              )
              .map(
                (q) =>
                  `${(q.distance / forceRoute.length) * 240},${Math.max(2, Math.min(46, 42 - q.vertical * 6))}`,
              )
              .join(" ")}
          />
          <line
            x1={hud.trackProgress * 240}
            x2={hud.trackProgress * 240}
            y1="0"
            y2="48"
            stroke="#fff"
          />
        </svg>
        <small>
          Vertikale Last über die Strecke · 1 g im Stand
          <br />
          Spielmodell · bei Pause eingefroren
        </small>
      </aside>
      <input
        className="ride-timeline"
        aria-label="Position auf der Strecke"
        type="range"
        min="0"
        max="1000"
        value={Math.round(hud.progress * 1000)}
        onChange={(e) => {
          const path = compiledPath;
          const wanted = Number(e.target.value) / 1000;
          audio?.rideCheer(null);
          control.current.photoSeek++;
          control.current.time = wanted * path.duration * rounds;
          control.current.playing = false;
          setPlaying(false);
          setHud({ ...hud, progress: wanted, speed: 0 });
        }}
      />
      <div className="ride-controls">
        <button
          className="primary"
          disabled={!!error}
          onClick={() => {
            if (hud.progress >= 0.999) control.current.reset++;
            if (playing) audio?.rideCheer(null);
            control.current.playing = !playing;
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />} {playing ? "Pause" : "Start"}
        </button>
        <button
          className="secondary"
          onClick={() => {
            control.current.reset++;
            control.current.playing = true;
            setPlaying(true);
          }}
          aria-label="Mitfahrt neu starten"
        >
          <RotateCcw size={18} />
        </button>
        <div className="build-modes" aria-label="Mitfahrkamera">
          {[
            ["front", "Vorne"],
            ["chase", "Verfolger"],
            ["overview", "Parkblick"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={mode === id}
              className={mode === id ? "active" : ""}
              onClick={() => {
                control.current.camera = id;
                setMode(id);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="secondary"
          onClick={onMute}
          aria-label={muted ? "Sound einschalten" : "Sound ausschalten"}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
      <p className="ride-caption">
        {mode === "overview"
          ? "Parkblick: ziehen zum Drehen · Mausrad zum Zoomen."
          : "Deine echte Strecke · Gleiche Fahrberechnung wie im Park."}{" "}
        Zeitregler zum Erkunden · Der Park pausiert während der Probefahrt.
      </p>
    </div>
  );
}
