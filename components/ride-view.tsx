import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Pause, Play, RotateCcw, X, Volume2, VolumeX } from "lucide-react";
import { type Building, type Park, CATALOG, COASTER_TYPES } from "../game/simulation";
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
export default function RideView({ park, building, audio, muted, onMute, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null),
    control = useRef({ playing: true, time: 0, camera: "front", reset: 0 });
  const [playing, setPlaying] = useState(true),
    [mode, setMode] = useState("front"),
    [error, setError] = useState("");
  const [hud, setHud] = useState({ speed: 0, height: 0, progress: 0 });
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
    scene.add(new THREE.HemisphereLight("#e6faff", "#597340", 2.7));
    const sun = new THREE.DirectionalLight("#fff0d0", 2.5);
    sun.position.set(40, 100, -40);
    scene.add(sun);
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
    const ground = mesh(cube, "#7caa49", 72.5, -0.6, 72.5, 155, 1, 155);
    const tileGeometry = new THREE.BoxGeometry(4.96, 0.12, 4.96);
    for (const type of ["path", "queue", "water"] as const) {
      const tiles = park.tiles.flatMap((row, y) =>
        row.flatMap((t, x) => (t === type ? [{ x, y }] : [])),
      );
      const instances = new THREE.InstancedMesh(
        tileGeometry,
        mat(type === "water" ? "#47a6bf" : type === "queue" ? "#8eafc0" : "#dfc28d"),
        tiles.length,
      );
      const matrix = new THREE.Matrix4();
      tiles.forEach((t, i) => {
        matrix.makeTranslation(t.x * 5, 0.01, t.y * 5);
        instances.setMatrixAt(i, matrix);
      });
      scene.add(instances);
    }
    const trees = park.buildings.filter((b) => b.kind === "tree" || b.kind === "pine");
    for (const [geometry, color, height, radius, offset] of [
      [cylinder, "#795831", 4, 0.35, 2],
      [cone, "#286b45", 6, 2.3, 6],
      [cone, "#348653", 4, 1.7, 8],
    ] as const) {
      const instances = new THREE.InstancedMesh(geometry, mat(color), trees.length),
        matrix = new THREE.Matrix4(),
        q = new THREE.Quaternion();
      trees.forEach((b, i) => {
        matrix.compose(
          new THREE.Vector3(b.x * 5, offset, b.y * 5),
          q,
          new THREE.Vector3(radius, height, radius),
        );
        instances.setMatrixAt(i, matrix);
      });
      scene.add(instances);
    }
    for (const b of park.buildings) {
      if (["tree", "pine", "coaster"].includes(b.kind)) continue;
      const n = CATALOG[b.kind].size,
        x = (b.x + (n - 1) / 2) * 5,
        z = (b.y + (n - 1) / 2) * 5;
      if (["burger", "drink", "toilet"].includes(b.kind)) {
        mesh(cube, "#fff0c6", x, 1.7, z, 3.8, 3.4, 3.8);
        mesh(cone, b.kind === "burger" ? "#dc5c37" : "#e7b62c", x, 4.3, z, 3.5, 2, 3.5).rotation.y =
          Math.PI / 4;
      } else if (b.kind === "flowers") mesh(cylinder, "#e9aa45", x, 0.25, z, 1, 0.5, 1);
      else if (b.kind === "bench") mesh(cube, "#b38038", x, 0.6, z, 2, 0.35, 0.6);
      else if (b.kind === "wheel") {
        const group = new THREE.Group();
        group.position.set(x, 10, z);
        scene.add(group);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(8, 0.2, 6, 48), mat("#da5938"));
        group.add(rim);
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5;
          mesh(
            cube,
            "#f2d886",
            Math.sin(a) * 4,
            Math.cos(a) * 4,
            0,
            0.12,
            8,
            0.12,
            group,
          ).rotation.z = -a;
          mesh(cube, "#d95b39", Math.sin(a) * 8, Math.cos(a) * 8, 0, 1.4, 1.5, 1.4, group);
        }
        mesh(cube, "#177779", x - 3, 4.5, z, 1, 11, 1).rotation.z = -0.25;
        mesh(cube, "#177779", x + 3, 4.5, z, 1, 11, 1).rotation.z = 0.25;
      } else if (b.kind === "drop") {
        mesh(cube, "#248b93", x, 10, z, 1.4, 20, 1.4);
        mesh(cylinder, "#df6444", x, 12, z, 3, 1, 3);
      } else {
        mesh(cylinder, "#e1ad43", x, 0.6, z, n * 1.3, 1.2, n * 1.3);
        mesh(cylinder, "#247c7a", x, 3, z, 0.3, 6, 0.3);
        mesh(cone, "#d86242", x, 6, z, n * 1.6, 2, n * 1.6);
      }
    }
    const path = makeRidePath(building.track!);
    const color = COASTER_TYPES[building.track?.[0]?.style ?? "steel"].color;
    const railGeometry = (offset: number) =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(
          path.points.slice(0, -1).map((p, i) => p.clone().addScaledVector(path.rights[i], offset)),
          true,
          "centripetal",
        ),
        path.count,
        0.11,
        6,
        true,
      );
    for (const side of [-0.58, 0.58]) scene.add(new THREE.Mesh(railGeometry(side), mat(color)));
    const ties = new THREE.InstancedMesh(
      cube,
      mat(building.track?.[0]?.style === "wood" ? "#82582f" : "#384e50"),
      Math.ceil(path.length / 0.8),
    );
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < ties.count; i++) {
      const p = path.at(i / ties.count);
      matrix.compose(p.position, p.quaternion, new THREE.Vector3(1.5, 0.13, 0.22));
      ties.setMatrixAt(i, matrix);
    }
    scene.add(ties);
    for (let d = 0; d < path.length; d += 5) {
      const p = path.at(d / path.length);
      if (p.position.y < 1.5) continue;
      for (const side of [-1, 1]) {
        const foot = p.position.clone().addScaledVector(p.right, side * 0.8);
        mesh(cylinder, "#6a8681", foot.x, p.position.y / 2, foot.z, 0.15, p.position.y, 0.15);
        mesh(cube, "#c4bfac", foot.x, 0.12, foot.z, 0.8, 0.24, 0.8);
      }
    }
    const station = path.at(0),
      platform = new THREE.Group();
    platform.position.copy(station.position);
    platform.quaternion.copy(station.quaternion);
    scene.add(platform);
    mesh(cube, "#e1cf9c", 2, -0.25, 0, 2.3, 0.3, 8, platform);
    for (const z of [-3, 3]) mesh(cube, "#267b7e", 3, 1.5, z, 0.18, 3, 0.18, platform);
    mesh(cube, color, 2, 3.1, 0, 2.7, 0.25, 8, platform);
    const cart = new THREE.Group();
    scene.add(cart);
    for (const x of [-0.4, 0.4]) {
      mesh(cube, "#f2e4b8", x, 0.7, 0.25, 0.65, 0.15, 0.6, cart);
      mesh(cube, "#f2e4b8", x, 1, 0.55, 0.65, 0.6, 0.12, cart);
    }
    mesh(cube, color, 0, 0.28, -1, 1.65, 0.65, 1.8, cart);
    mesh(cube, "#233b3e", 0, 0.72, -0.7, 1.75, 0.1, 0.12, cart);
    for (const x of [-0.72, 0.72])
      mesh(cylinder, "#cbd5d0", x, 0.55, -0.7, 0.055, 0.45, 0.055, cart);
    const resize = () => {
      const w = target.clientWidth,
        h = target.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(target);
    resize();
    let last = performance.now(),
      lastHud = 0,
      prev = path.at(0).position,
      initialized = false,
      lost = false;
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
        return;
      }
      const c = control.current;
      if (c.reset) {
        c.time = 0;
        c.reset = 0;
        initialized = false;
      }
      if (c.playing) c.time = Math.min(path.duration, c.time + dt);
      const u = path.progress(c.time),
        p = path.at(u),
        speed = initialized && dt > 0 ? Math.min(35, p.position.distanceTo(prev) / dt) : 0;
      prev = p.position.clone();
      cart.position.copy(p.position);
      cart.quaternion.copy(p.quaternion);
      cart.visible = true;
      let cameraPosition = p.position.clone().addScaledVector(p.up, 1.35),
        quaternion = p.quaternion;
      if (c.camera === "chase") {
        cameraPosition.addScaledVector(p.tangent, -7).addScaledVector(p.up, 3);
        camera.position.copy(cameraPosition);
        camera.up.copy(p.up);
        camera.lookAt(p.position.clone().addScaledVector(p.tangent, 4));
        quaternion = camera.quaternion.clone();
      }
      if (c.camera === "overview") {
        cameraPosition = new THREE.Vector3(155, 110, 170);
        camera.position.copy(cameraPosition);
        camera.up.set(0, 1, 0);
        camera.lookAt(75, 0, 75);
        quaternion = camera.quaternion.clone();
      }
      camera.position.copy(cameraPosition);
      if (!initialized) camera.quaternion.copy(quaternion);
      else camera.quaternion.slerp(quaternion, 1 - Math.exp(-dt / 0.055));
      initialized = true;
      audio?.ride(c.playing ? speed : 0, true);
      renderer.render(scene, camera);
      if (now - lastHud > 150) {
        lastHud = now;
        setHud({
          speed: Math.round(speed * 3.6),
          height: Math.max(0, Math.round(p.position.y - 1.1)),
          progress: u,
        });
      }
      if (c.time >= path.duration && c.playing) {
        c.playing = false;
        setPlaying(false);
        audio?.ride(0, true);
      }
    });
    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      audio?.ride(0, false);
      const geometries = new Set<THREE.BufferGeometry>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) geometries.add(o.geometry);
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
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
            : `${Math.round(hud.progress * 100)} % der Strecke`}
        </span>
      </div>
      <div className="ride-controls">
        <button
          className="primary"
          disabled={!!error}
          onClick={() => {
            if (hud.progress >= 0.999) control.current.reset++;
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
        Deine gebaute Strecke als 3D-Probefahrt. Der Park pausiert während der Mitfahrt.
      </p>
    </div>
  );
}
