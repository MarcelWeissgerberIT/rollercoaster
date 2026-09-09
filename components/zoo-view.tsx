import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createWorld } from "../game/scene-world";
import { SPECIES, welfare, type Species } from "../game/zoo";
import type { Park, Building } from "../game/simulation";

export default function ZooView({
  park,
  building: b,
  onClose,
}: {
  park: Park;
  building: Building;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    paused = useRef(false),
    [playing, setPlaying] = useState(true),
    [error, setError] = useState("");
  const focus = useRef<() => void>(() => {});
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
    const n = SPECIES[b.kind as Species].size,
      x = (b.x + (n - 1) / 2) * 5,
      z = (b.y + (n - 1) / 2) * 5;
    orbit.enableDamping = true;
    orbit.minDistance = 3;
    orbit.maxDistance = 300;
    orbit.maxPolarAngle = Math.PI * 0.485;
    focus.current = () => {
      orbit.target.set(x, 1.8, z);
      camera.position.set(x + n * 3.2, n * 2.9, z + n * 3.8);
      orbit.update();
    };
    focus.current();
    const resize = () => {
      renderer.setSize(target.clientWidth, target.clientHeight);
      camera.aspect = target.clientWidth / Math.max(1, target.clientHeight);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(target);
    resize();
    let last = performance.now(),
      time = 0,
      lost = false;
    const loss = (e: Event) => {
      e.preventDefault();
      lost = true;
      setError("Die 3D-Verbindung wurde unterbrochen. Öffne die Zooansicht erneut.");
    };
    renderer.domElement.addEventListener("webglcontextlost", loss);
    renderer.setAnimationLoop((now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (lost || document.hidden) return;
      if (!paused.current) time += dt;
      world.update(time);
      orbit.update();
      renderer.render(world.scene, camera);
    });
    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      orbit.dispose();
      world.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [park, b]);
  return (
    <div className="zoo-view">
      <header>
        <div>
          <small>3D · TIERBEOBACHTUNG</small>
          <h2>{b.name}</h2>
        </div>
        <button className="secondary" onClick={onClose}>
          Zurück zum Park
        </button>
      </header>
      <div className="zoo-view-canvas" ref={host} />
      {error && (
        <p role="alert" className="zoo-view-error">
          {error}
        </p>
      )}
      <footer>
        <span>
          {b.habitat?.count ?? 0} Tiere · Tierwohl {Math.round(welfare(b))}%
        </span>
        <button
          className="secondary"
          onClick={() => {
            paused.current = !paused.current;
            setPlaying(!paused.current);
          }}
        >
          {playing ? "Beobachtung pausieren" : "Beobachtung fortsetzen"}
        </button>
        <button className="secondary" onClick={() => focus.current()}>
          Gehege zentrieren
        </button>
        <small>
          Ziehen: drehen · Rechte Maustaste: verschieben · Mausrad: zoomen · Der Park pausiert.
        </small>
      </footer>
    </div>
  );
}
