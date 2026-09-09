import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createWorld } from "../game/scene-world";
import type { Park, Point } from "../game/simulation";
type Props = {
  park: Park;
  draft: Point[];
  candidate: Point[];
  error: string | null;
  fit?: { removed: Point[]; added: Point[] };
  follow: boolean;
  onPlace: (p: Point) => void;
  onClose: () => void;
};
export default function BuildView(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    current = useRef(props),
    runtime = useRef<{
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      orbit: OrbitControls;
      ghost: THREE.Group;
      focus: () => void;
    } | null>(null);
  current.current = props;
  const [error, setError] = useState("");
  useEffect(() => {
    const target = host.current;
    if (!target) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError("Die Bauansicht benötigt WebGL 2. Du kannst in der Parkansicht weiterbauen.");
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    target.appendChild(renderer.domElement);
    const world = createWorld(props.park),
      camera = new THREE.PerspectiveCamera(55, 1, 0.1, 800),
      orbit = new OrbitControls(camera, renderer.domElement),
      ghost = new THREE.Group();
    world.scene.add(ghost);
    const grid = new THREE.GridHelper(270, 54, "#9ab790", "#a7c092");
    grid.position.set(132.5, 0.045, 132.5);
    world.scene.add(grid);
    orbit.enableDamping = true;
    orbit.screenSpacePanning = false;
    orbit.minDistance = 8;
    orbit.maxDistance = 500;
    orbit.target.set(75, 0, 75);
    camera.position.set(105, 65, 110);
    const focus = () => {
      const p = current.current,
        points = p.fit
          ? [...p.fit.removed, ...p.fit.added]
          : [...p.draft.slice(-1), ...p.candidate.slice(Math.max(0, p.draft.length - 1))];
      if (!points.length) return;
      const box = new THREE.Box3().setFromPoints(
          points.map((q) => new THREE.Vector3(q.x * 5, (q.z ?? 0) * 5 + 1, q.y * 5)),
        ),
        center = box.getCenter(new THREE.Vector3()),
        radius = box.getSize(new THREE.Vector3()).length() / 2 + 4,
        dir = camera.position.clone().sub(orbit.target).normalize();
      orbit.target.copy(center);
      camera.position
        .copy(center)
        .addScaledVector(
          dir,
          Math.max(
            23,
            (radius * 1.3) /
              Math.sin(
                Math.min(
                  (camera.fov * Math.PI) / 180,
                  2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect),
                ) / 2,
              ),
          ),
        );
      orbit.update();
    };
    runtime.current = { scene: world.scene, camera, orbit, ghost, focus };
    const resize = () => {
      renderer.setSize(target.clientWidth, target.clientHeight);
      camera.aspect = target.clientWidth / Math.max(1, target.clientHeight);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(target);
    resize();
    let start: { x: number; y: number; button: number } | null = null,
      raf = 0;
    const ray = new THREE.Raycaster(),
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      hit = new THREE.Vector3();
    const down = (e: PointerEvent) => (start = { x: e.clientX, y: e.clientY, button: e.button });
    const up = (e: PointerEvent) => {
      if (
        !start ||
        start.button !== 0 ||
        Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4
      ) {
        start = null;
        return;
      }
      start = null;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          1 - ((e.clientY - r.top) / r.height) * 2,
        ),
        camera,
      );
      if (ray.ray.intersectPlane(plane, hit))
        current.current.onPlace({ x: Math.round(hit.x / 5), y: Math.round(hit.z / 5) });
    };
    const keys = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === "f" &&
        !(e.target as HTMLElement).closest("input,textarea,select")
      )
        focus();
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", up);
    window.addEventListener("keydown", keys);
    const animate = () => {
      raf = requestAnimationFrame(animate);
      orbit.update();
      renderer.render(world.scene, camera);
    };
    animate();
    focus();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("keydown", keys);
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", up);
      orbit.dispose();
      world.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      runtime.current = null;
    };
  }, [props.park]);
  useEffect(() => {
    const rt = runtime.current;
    if (!rt) return;
    rt.ghost.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
    });
    rt.ghost.clear();
    const line = (points: Point[], color: string) => {
      if (points.length < 2) return;
      const vertices = points.map((p) => new THREE.Vector3(p.x * 5, (p.z ?? 0) * 5 + 0.7, p.y * 5));
      const curve = new THREE.CatmullRomCurve3(vertices, false, "centripetal");
      const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(
          curve,
          Math.min(2048, Math.max(12, points.length * 2)),
          0.27,
          6,
          false,
        ),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.22,
          transparent: true,
          opacity: 0.85,
        }),
      );
      rt.ghost.add(mesh);
    };
    line(props.draft, "#f2bd48");
    if (props.park.trackEdit) line(props.park.trackEdit.suffix, "#40cbb8");
    const added = props.candidate.slice(Math.max(0, props.draft.length - 1));
    if (props.fit) {
      line(props.fit.removed, "#ee6656");
      line(props.fit.added, "#30d8ba");
    } else line(added, props.error ? "#ee6656" : "#44cba0");
    const end = props.draft.at(-1);
    if (end) {
      const anchor = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 12, 8),
        new THREE.MeshStandardMaterial({ color: "#fff4b8" }),
      );
      anchor.position.set(end.x * 5, (end.z ?? 0) * 5 + 0.7, end.y * 5);
      rt.ghost.add(anchor);
      const points = [new THREE.Vector3(end.x * 5, 0, end.y * 5), anchor.position.clone()];
      rt.ghost.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineDashedMaterial({ color: "#ffffff", dashSize: 0.5, gapSize: 0.4 }),
        ),
      );
    }
    if (props.follow) rt.focus();
  }, [props.draft, props.candidate, props.error, props.follow, props.park, props.fit]);
  return (
    <div className="build3d-shell">
      <div className="build3d-host" ref={host} />
      <div className="build3d-tools">
        <strong>3D-Bauinspektor</strong>
        <button className="secondary" onClick={() => runtime.current?.focus()}>
          Anschluss fokussieren · F
        </button>
        <button className="secondary" onClick={props.onClose}>
          Zur Parkansicht
        </button>
      </div>
      <p className="build3d-help">
        {error ||
          (props.fit
            ? "Umbauvorschau · Rot: ersetzen · Türkis: neuer Verlauf · Ziehen: drehen · Rechts ziehen: verschieben · Rad: zoomen"
            : "Ziehen: frei drehen · Rechts ziehen: verschieben · Rad: zoomen · Klick: Station setzen / Bauteil anfügen")}
      </p>
    </div>
  );
}
