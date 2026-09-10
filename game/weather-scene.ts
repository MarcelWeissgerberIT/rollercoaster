import * as THREE from "three";
import type { Park } from "./simulation";
import { mapWidth, mapHeight } from "./grid";
import { parkWeather, weatherDrop, weatherDropCount } from "./weather";

type WeatherLights = { ambient?: THREE.HemisphereLight; sun?: THREE.DirectionalLight };
/** Feed absolute simulation/preview time. Repeating a paused frame produces
 * identical rain, clouds and lighting, including a newly opened 3D view. */
export function createWeatherScene(scene: THREE.Scene, park: Park, lights: WeatherLights = {}) {
  const root = new THREE.Group();
  root.name = "park-weather";
  const width = mapWidth(park),
    height = mapHeight(park),
    count = weatherDropCount(width, height),
    positions = new Float32Array(count * 6),
    geometry = new THREE.BufferGeometry(),
    rainMaterial = new THREE.LineBasicMaterial({
      color: "#dfedf6",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
    cloudGeometry = new THREE.SphereGeometry(1, 10, 7),
    cloudMaterial = new THREE.MeshStandardMaterial({
      color: "#edf1ec",
      roughness: 1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
    clouds: THREE.Group[] = [],
    sunBase = lights.sun?.intensity ?? 2.3,
    ambientBase = lights.ambient?.intensity ?? 2.8,
    initialFog =
      scene.fog instanceof THREE.Fog ? { near: scene.fog.near, far: scene.fog.far } : undefined;
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const rain = new THREE.LineSegments(geometry, rainMaterial);
  rain.name = "weather-rain";
  rain.frustumCulled = false;
  root.add(rain);
  for (let i = 0; i < 7; i++) {
    const cloud = new THREE.Group();
    cloud.name = `weather-cloud-${i}`;
    for (let j = 0; j < 4; j++) {
      const part = new THREE.Mesh(cloudGeometry, cloudMaterial);
      part.scale.set(13 + j * 2, 3.2 + (j % 2) * 2, 7 + (j % 3));
      part.position.set((j - 1.5) * 10, (j % 2) * 1.7, (j % 2) * 3);
      cloud.add(part);
    }
    root.add(cloud);
    clouds.push(cloud);
  }
  scene.add(root);
  let lastTime = NaN;
  function update(time = park.time, _camera?: THREE.Camera) {
    const at = Number.isFinite(time) ? Math.max(0, time) : 0,
      weather = parkWeather(park, at);
    if (!(scene.background instanceof THREE.Color))
      scene.background = new THREE.Color(weather.skyColor);
    else scene.background.set(weather.skyColor);
    if (scene.fog) scene.fog.color.set(weather.fogColor);
    if (scene.fog instanceof THREE.Fog && initialFog) {
      scene.fog.near = initialFog.near * (1 - weather.rain * 0.25);
      scene.fog.far = initialFog.far * (1 - weather.rain * 0.18);
    }
    if (lights.sun) lights.sun.intensity = sunBase * weather.light;
    if (lights.ambient) lights.ambient.intensity = ambientBase * (1 - weather.rain * 0.13);
    root.userData.weather = weather;
    rain.visible = weather.rain > 0.015;
    rainMaterial.opacity = weather.rain * 0.5;
    cloudMaterial.opacity = weather.cloud * 0.64;
    clouds.forEach((cloud, i) => {
      const span = width * 5 + 100;
      cloud.position.set(
        ((i * 57.7 + at * 0.045) % span) - 40,
        73 + (i % 3) * 7,
        ((i * 43.3) % (height * 5 + 70)) - 25,
      );
      cloud.visible = weather.cloud > 0.08;
    });
    if (rain.visible && at !== lastTime) {
      for (let i = 0; i < count; i++) {
        const d = weatherDrop(i, at, width, height, weather.wind),
          index = i * 6;
        positions[index] = d.x * 5;
        positions[index + 1] = d.z * 5;
        positions[index + 2] = d.y * 5;
        positions[index + 3] = d.tail.x * 5;
        positions[index + 4] = d.tail.z * 5;
        positions[index + 5] = d.tail.y * 5;
      }
      geometry.attributes.position.needsUpdate = true;
    }
    lastTime = at;
    return weather;
  }
  update(park.time);
  return {
    root,
    update,
    dispose() {
      scene.remove(root);
      geometry.dispose();
      cloudGeometry.dispose();
      rainMaterial.dispose();
      cloudMaterial.dispose();
    },
  };
}
