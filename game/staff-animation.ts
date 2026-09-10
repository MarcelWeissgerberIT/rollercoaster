/** Articulated work poses shared by the park canvas and 3D. Metres, facing -Z. */
export type StaffAction =
  | "idle"
  | "walk"
  | "carry"
  | "sweep"
  | "empty"
  | "deposit"
  | "feed"
  | "water"
  | "inspect"
  | "greet"
  | "admit"
  | "guide"
  | "console";
export type StaffMotion = {
  id: number;
  post?: "control" | "entry" | "exit";
  role: "cleaner" | "keeper" | "operator";
  action: StaffAction;
  time: number;
  heading: number;
  distance?: number;
  progress?: number;
  carried?: number;
  hideBag?: boolean;
};
export type V3 = [number, number, number];
export type StaffPart = {
  id: string;
  color: string;
  a: V3;
  b?: V3;
  size: V3;
  shape: "round" | "box";
};
const mix = (a: V3, b: V3, t: number): V3 => a.map((n, i) => n + (b[i] - n) * t) as V3;
export const staffYaw = (heading: number) => Math.atan2(-Math.cos(heading), -Math.sin(heading));

export function staffPose(m: StaffMotion): StaffPart[] {
  const parts: StaffPart[] = [];
  const put = (id: string, color: string, a: V3, size: V3, shape: StaffPart["shape"] = "round") =>
    parts.push({ id, color, a, size, shape });
  const limb = (id: string, color: string, a: V3, b: V3, r: number) =>
    parts.push({ id, color, a, b, size: [r, r, r], shape: "round" });
  const appearanceId = m.id + (m.post === "entry" ? 1 : m.post === "exit" ? 2 : 0);
  const skin = ["#e6b48e", "#b57d59", "#825339", "#f1cba8"][Math.abs(appearanceId) % 4],
    hair = ["#4a3227", "#282b29", "#916942", "#684333"][Math.abs(appearanceId) % 4],
    shirt = m.role === "cleaner" ? "#268996" : m.role === "keeper" ? "#67834e" : "#3e6689",
    pants = m.role === "keeper" ? "#685d42" : "#34485a",
    hat = m.role === "keeper" ? "#c7b277" : m.role === "cleaner" ? "#efe3b9" : "#304e71",
    walk = m.action === "walk" || m.action === "carry",
    phase = (m.distance === undefined ? m.time * 8 : m.distance * 9) + m.id * 1.7,
    beat = Math.sin(m.time * 5),
    progress = Math.max(0, Math.min(1, m.progress ?? 0)),
    working = ["sweep", "feed", "water", "empty", "deposit", "inspect"].includes(m.action),
    bend =
      m.action === "sweep"
        ? 0.23
        : m.action === "feed"
          ? 0.16
          : m.action === "empty"
            ? Math.sin(progress * Math.PI) * 0.3
            : working
              ? 0.08
              : 0,
    bounce = walk ? Math.abs(Math.cos(phase)) * 0.025 : Math.sin(m.time * 1.6 + m.id) * 0.006,
    hip: V3 = [0, 0.84 + bounce, 0],
    neck: V3 = [0, 1.37 + bounce - bend * 0.3, -bend],
    head: V3 = [0, neck[1] + 0.22, neck[2] - 0.01];
  limb("torso", shirt, [0, hip[1] + 0.07, 0], [0, neck[1] - 0.09, neck[2]], 0.185);
  put("shirt-shoulders", shirt, [0, neck[1] - 0.135, neck[2] + 0.008], [0.235, 0.125, 0.135]);
  put("hip", pants, hip, [0.185, 0.13, 0.125]);
  put("belt", "#303b36", [0, hip[1] + 0.085, -0.015], [0.192, 0.028, 0.14]);
  put("buckle", "#e0c57c", [0, hip[1] + 0.085, -0.156], [0.032, 0.027, 0.01], "box");
  limb("neck", skin, [0, neck[1] - 0.04, neck[2]], head, 0.055);
  put("head", skin, head, [0.139, 0.174, 0.132]);
  put("hair", hair, [0, head[1] + 0.055, head[2] + 0.064], [0.146, 0.124, 0.098]);
  put("cap", hat, [0, head[1] + 0.155, head[2] + 0.007], [0.159, 0.058, 0.146]);
  put(
    "brim",
    hat,
    [0, head[1] + 0.132, head[2] - 0.126],
    [m.role === "keeper" ? 0.218 : 0.155, 0.019, 0.125],
  );
  put("nose", skin, [0, head[1] - 0.018, head[2] - 0.132], [0.026, 0.037, 0.035]);
  put("mouth", "#8d5947", [0, head[1] - 0.077, head[2] - 0.124], [0.034, 0.009, 0.006]);
  put("badge", "#f6dd8c", [-0.098, neck[1] - 0.18, neck[2] - 0.175], [0.039, 0.046, 0.018], "box");
  const hands: V3[] = [];
  for (const side of [-1, 1]) {
    put(`ear${side}`, skin, [side * 0.14, head[1] - 0.01, head[2]], [0.029, 0.045, 0.025]);
    put(
      `eye${side}`,
      "#faf5e4",
      [side * 0.052, head[1] + 0.02, head[2] - 0.124],
      [0.03, 0.022, 0.012],
    );
    put(
      `pupil${side}`,
      "#263430",
      [side * 0.052, head[1] + 0.02, head[2] - 0.136],
      [0.012, 0.015, 0.006],
    );
    const gait = walk ? Math.sin(phase + (side > 0 ? Math.PI : 0)) : 0,
      lift = walk ? Math.max(0, Math.cos(phase + (side > 0 ? Math.PI : 0))) : 0,
      knee: V3 = [side * 0.104, 0.46 + lift * 0.035, -gait * 0.14 - 0.025],
      ankle: V3 = [side * 0.105, 0.11 + lift * 0.115, -gait * 0.25];
    limb(`thigh${side}`, pants, [side * 0.105, hip[1], 0], knee, 0.08);
    put(`knee${side}`, pants, knee, [0.061, 0.065, 0.06]);
    limb(`shin${side}`, pants, knee, ankle, 0.059);
    put(
      `shoe${side}`,
      "#263435",
      [side * 0.105, ankle[1] - 0.045, ankle[2] - 0.064],
      [0.081, 0.067, 0.139],
    );
    put(
      `sole${side}`,
      "#c2bea8",
      [side * 0.105, ankle[1] - 0.09, ankle[2] - 0.064],
      [0.081, 0.018, 0.14],
    );
    const shoulder: V3 = [side * 0.21, neck[1] - 0.095, neck[2]],
      elbow: V3 = [side * 0.267, hip[1] + 0.27, neck[2] + gait * 0.09],
      hand: V3 = [side * 0.278, hip[1] + 0.1, gait * 0.19];
    if (m.action === "sweep") {
      elbow[1] -= 0.08;
      elbow[2] = -0.24;
      Object.assign(
        hand,
        side > 0 ? [0.2 + beat * 0.13, 0.7, -0.39] : [0.12 + beat * 0.12, 1.02, -0.28],
      );
    } else if (m.action === "empty" || m.action === "deposit") {
      const reach = Math.sin(progress * Math.PI);
      elbow[2] = -0.23;
      Object.assign(hand, [side * 0.19, 0.9 + reach * 0.4, -0.35 - reach * 0.08]);
    } else if (m.action === "feed") {
      elbow[2] = -0.22;
      Object.assign(
        hand,
        side > 0
          ? [0.25, 0.85 + beat * 0.1, -0.45 - Math.max(0, beat) * 0.17]
          : [-0.25, 0.8, -0.16],
      );
    } else if (m.action === "water") {
      elbow[2] = -0.25;
      Object.assign(hand, [side * 0.22, 0.94 + beat * 0.018, -0.41]);
    } else if (m.action === "inspect") {
      elbow[2] = -0.18;
      Object.assign(hand, [side * 0.18, 1.12 + (side > 0 ? beat * 0.035 : 0), -0.35]);
    } else if (m.action === "greet" && side > 0) {
      Object.assign(elbow, [0.33, 1.22, -0.12]);
      Object.assign(hand, [0.42 + beat * 0.05, 1.5, -0.22]);
    } else if (m.action === "admit") {
      // Scanner stays in the left hand; the right hand invites the next guests.
      Object.assign(elbow, [side * 0.29, 1.12, -0.18]);
      Object.assign(
        hand,
        side < 0
          ? [-0.23, 1.12, -0.38]
          : [0.4 + Math.sin(progress * Math.PI * 2) * 0.1, 1.18, -0.34],
      );
    } else if (m.action === "guide" && side > 0) {
      Object.assign(elbow, [0.34, 1.13, -0.13]);
      Object.assign(hand, [
        0.47,
        1.16 + Math.sin(progress * Math.PI) * 0.12,
        -0.23 - Math.sin(progress * Math.PI) * 0.14,
      ]);
    } else if (m.action === "console") {
      elbow[2] = -0.25;
      Object.assign(hand, [side * 0.22, 1.05 + (side > 0 ? Math.max(0, beat) * 0.035 : 0), -0.44]);
    } else if ((m.carried ?? 0) > 0 && side < 0) {
      elbow[2] = 0.04;
      hand[1] = 0.93;
      hand[2] = -0.04;
    }
    limb(`sleeve${side}`, shirt, shoulder, mix(shoulder, elbow, 0.56), 0.073);
    limb(`arm${side}`, skin, mix(shoulder, elbow, 0.54), elbow, 0.049);
    limb(`forearm${side}`, skin, elbow, hand, 0.04);
    put(`hand${side}`, skin, hand, [0.049, 0.065, 0.04]);
    hands.push(hand);
  }
  const [left, right] = hands;
  if (m.action === "admit") {
    put(
      "ticket-scanner",
      "#334e59",
      [left[0], left[1] + 0.04, left[2] - 0.04],
      [0.065, 0.085, 0.035],
      "box",
    );
    put(
      "scanner-screen",
      "#a7ddae",
      [left[0], left[1] + 0.07, left[2] - 0.079],
      [0.044, 0.036, 0.008],
      "box",
    );
  }
  if (m.role === "cleaner" || m.action === "sweep") {
    const sweeping = m.action === "sweep",
      reach = (right[1] - 0.065) / Math.max(0.01, left[1] - right[1]),
      tip: V3 = sweeping
        ? (right.map((n, i) => n + (n - left[i]) * reach) as V3)
        : [right[0] + 0.1, 0.11, right[2] - 0.08],
      top: V3 = sweeping
        ? (left.map((n, i) => n + (n - right[i]) * 0.5) as V3)
        : [right[0] - 0.08, 1.5, right[2] + 0.08];
    // During bag handling the broom rests beside the worker, never floats in their hands.
    const handling = m.action === "empty" || m.action === "deposit";
    limb(
      "broom-stick",
      "#9b7844",
      handling ? [0.47, 0.08, 0.2] : tip,
      handling ? [0.47, 1.38, 0.2] : top,
      0.018,
    );
    put("broom-head", "#c8a659", handling ? [0.47, 0.07, 0.2] : tip, [0.15, 0.067, 0.062], "box");
    const bristleTip: V3 = handling ? [0.47, 0.065, 0.2] : tip;
    for (let i = 0; i < 4; i++)
      limb(
        `bristle${i}`,
        "#8d763e",
        [bristleTip[0] - 0.11 + i * 0.065, 0.01, bristleTip[2]],
        [bristleTip[0] - 0.11 + i * 0.065, 0.08, bristleTip[2]],
        0.009,
      );
    if (!m.hideBag && ((m.carried ?? 0) > 0 || m.action === "empty")) {
      const a: V3 = handling
          ? [0, 0.8 + Math.sin(progress * Math.PI) * 0.4, -0.39]
          : [left[0], left[1] - 0.24, left[2]],
        amount = Math.min(1, (m.carried ?? 1) / 8);
      put("bag", "#46554a", a, [0.12 + amount * 0.05, 0.21, 0.125 + amount * 0.05]);
      limb("bag-tie", "#a3ac81", [a[0], a[1] + 0.16, a[2]], [a[0], a[1] + 0.24, a[2]], 0.027);
    }
    if (sweeping)
      for (let i = 0; i < 3; i++)
        put(
          `dust${i}`,
          "#c8b788",
          [tip[0] + Math.sin(m.time * 7 + i) * 0.14, 0.05 + (i % 2) * 0.055, tip[2] + i * 0.045],
          [0.017, 0.015, 0.023],
        );
  }
  if (m.role === "keeper" && m.action !== "sweep") {
    if (m.action === "inspect")
      put("clipboard", "#aa8556", [-0.04, 1.03, -0.36], [0.16, 0.2, 0.025], "box");
    else {
      const bucket: V3 = [left[0], left[1] - 0.2, left[2]];
      put("bucket", "#718d81", bucket, [0.125, 0.16, 0.115]);
      limb(
        "bucket-handle",
        "#acb8a6",
        [left[0] - 0.1, bucket[1] + 0.15, left[2]],
        [left[0], left[1], left[2]],
        0.012,
      );
      if (m.action === "feed")
        for (let i = 0; i < 3; i++) {
          const f = (m.time * 1.6 + i * 0.29) % 1;
          put(
            `food${i}`,
            "#d0ad62",
            [right[0] + i * 0.022, right[1] - f * f * 0.7, right[2] - f * 0.4],
            [0.026, 0.018, 0.025],
          );
        }
      if (m.action === "water") {
        put("watering-can", "#799687", [right[0], right[1] - 0.09, right[2]], [0.13, 0.13, 0.12]);
        limb(
          "spout",
          "#799687",
          [right[0], right[1] - 0.03, right[2] - 0.05],
          [right[0], right[1] - 0.08, right[2] - 0.28],
          0.035,
        );
        for (let i = 0; i < 5; i++) {
          const f = (m.time * 1.8 + i * 0.19) % 1;
          put(
            `water${i}`,
            "#9bdaee",
            [right[0], right[1] - 0.08 - f * 0.75, right[2] - 0.28 - f * 0.12],
            [0.011, 0.032, 0.011],
          );
        }
      }
    }
  }
  if (m.role === "operator") {
    put("radio", "#263c44", [0.14, neck[1] - 0.13, neck[2] - 0.17], [0.035, 0.057, 0.023], "box");
    if (m.action === "inspect")
      put("checklist", "#e8dfba", [-0.08, 1.06, -0.36], [0.135, 0.14, 0.018], "box");
  }
  return parts;
}
