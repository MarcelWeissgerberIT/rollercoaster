import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Volume2, VolumeX } from "lucide-react";
import { createWorld } from "../game/scene-world";
import { SPECIES, welfare, type Species } from "../game/zoo";
import { animalPose, ANIMAL_NAMES } from "../game/zoo-motion";
import type { ParkAudio } from "../game/audio";
import type { Park, Building } from "../game/simulation";

export default function ZooView({
  park,
  building: b,
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
    paused = useRef(false),
    clock = useRef(0),
    chosen = useRef(-1),
    [animal, setAnimal] = useState(-1),
    [playing, setPlaying] = useState(true),
    [error, setError] = useState(""),
    [lastCall, setLastCall] = useState("");
  const focus = useRef<(index: number) => void>(() => {}),
    call = useRef<() => void>(() => {});
  const species = b.kind as Species,
    count = b.habitat?.count ?? 0;
  useEffect(() => {
    const target = host.current;
    if (!target) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError("Die Zooansicht benötigt WebGL 2. Du kannst den Zoo in der Parkansicht verwalten.");
      return;
    }
    target.appendChild(renderer.domElement);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    const world = createWorld(park),
      camera = new THREE.PerspectiveCamera(55, 1, 0.1, 800),
      orbit = new OrbitControls(camera, renderer.domElement);
    const n = SPECIES[species].size,
      x = (b.x + (n - 1) / 2) * 5,
      z = (b.y + (n - 1) / 2) * 5;
    orbit.enableDamping = true;
    orbit.minDistance = 2;
    orbit.maxDistance = 300;
    orbit.maxPolarAngle = Math.PI * 0.485;
    clock.current = 0;
    focus.current = (index) => {
      if (index >= 0 && index < count) {
        const p = animalPose(b, index, park.time + clock.current),
          height = species === "giraffe" ? 2.6 : species === "zebra" ? 1.4 : 1,
          distance = species === "giraffe" ? 8 : species === "zebra" ? 6 : 4;
        orbit.target.set(p.x * 5, height, p.y * 5);
        camera.position.set(p.x * 5 + distance, height + distance * 0.4, p.y * 5 + distance);
      } else {
        orbit.target.set(x, 1.8, z);
        camera.position.set(x + n * 3.2, n * 2.9, z + n * 3.8);
      }
      orbit.update();
    };
    focus.current(chosen.current);
    const resize = () => {
      renderer.setSize(target.clientWidth, target.clientHeight);
      camera.aspect = target.clientWidth / Math.max(1, target.clientHeight);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(target);
    resize();
    audio?.observeAnimals(true);
    let last = performance.now(),
      time = 0,
      nextCall = 0.8,
      calls = 0,
      lost = false;
    const source = new THREE.Vector3(),
      local = new THREE.Vector3();
    const sound = () => {
      if (!count || paused.current || lost || document.hidden) return false;
      const index = chosen.current >= 0 ? chosen.current : calls % count,
        p = animalPose(b, index, park.time + time);
      source.set(p.x * 5, species === "giraffe" ? 4 : 1.4, p.y * 5);
      camera.updateMatrixWorld();
      local.copy(source).applyMatrix4(camera.matrixWorldInverse);
      const pan = Math.max(-1, Math.min(1, local.x / Math.max(6, Math.abs(local.z) * 0.65))),
        gain = 1 / (1 + source.distanceTo(camera.position) / 24);
      const played = audio?.animalCall(species, gain, pan, b.id + calls);
      if (played) {
        calls++;
        setLastCall(p.name);
      }
      return !!played;
    };
    call.current = () => {
      if (sound()) nextCall = time + 6;
    };
    const loss = (e: Event) => {
      e.preventDefault();
      lost = true;
      audio?.stopAnimalCall();
      setError("Die 3D-Verbindung wurde unterbrochen. Öffne die Zooansicht erneut.");
    };
    renderer.domElement.addEventListener("webglcontextlost", loss);
    renderer.setAnimationLoop((now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (lost || document.hidden) return;
      if (!paused.current) time += dt;
      clock.current = time;
      world.update(time);
      orbit.update();
      if (!paused.current && time >= nextCall)
        nextCall = time + (sound() ? 6 + ((b.id + calls) % 4) : 0.5);
      renderer.render(world.scene, camera);
    });
    return () => {
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("webglcontextlost", loss);
      audio?.observeAnimals(false);
      observer.disconnect();
      orbit.dispose();
      world.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      call.current = () => {};
      focus.current = () => {};
    };
  }, [park, b, audio, species, count]);
  return (
    <div className="zoo-view">
      <header>
        <div>
          <small>3D · TIERBEOBACHTUNG</small>
          <h2>{b.name}</h2>
        </div>
        <div className="zoo-view-tools">
          <button className="secondary" onClick={onMute}>
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            {muted ? "Sound einschalten" : "Sound ausschalten"}
          </button>
          <button className="secondary" onClick={onClose}>
            Zurück zum Park
          </button>
        </div>
      </header>
      <div className="zoo-view-canvas" ref={host} />
      {error && (
        <p role="alert" className="zoo-view-error">
          {error}
        </p>
      )}
      <footer>
        <span>
          {count} Tiere · Tierwohl {Math.round(welfare(b))}%
        </span>
        <label className="zoo-focus">
          Tier ansehen
          <select
            aria-label="Tier aus der Nähe ansehen"
            value={animal}
            onChange={(e) => {
              const index = Number(e.target.value);
              chosen.current = index;
              setAnimal(index);
              focus.current(index);
            }}
          >
            <option value={-1}>Ganzes Gehege</option>
            {ANIMAL_NAMES[species].slice(0, count).map((name, i) => (
              <option key={i} value={i}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary"
          onClick={() => {
            paused.current = !paused.current;
            if (paused.current) audio?.stopAnimalCall();
            setPlaying(!paused.current);
          }}
        >
          {playing ? "Beobachtung pausieren" : "Beobachtung fortsetzen"}
        </button>
        <button className="secondary" onClick={() => focus.current(chosen.current)}>
          Ansicht zentrieren
        </button>
        <button
          className="secondary"
          disabled={muted || !playing || !count || !!error}
          onClick={() => call.current()}
        >
          Tierlaut anhören
        </button>
        <small>
          Ziehen: drehen · Rechte Maustaste: verschieben · Mausrad: zoomen · Der Park pausiert.
          {lastCall && !muted && <> · Letzter Tierlaut: {lastCall}</>}
        </small>
      </footer>
    </div>
  );
}
