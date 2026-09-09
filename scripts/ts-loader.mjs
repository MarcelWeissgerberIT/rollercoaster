import { readFileSync } from "node:fs";
import ts from "typescript";
const root = new URL("../", import.meta.url),
  cache = new Map();
export function moduleURL(file) {
  if (cache.has(file)) return cache.get(file);
  let source = ts.transpileModule(readFileSync(new URL(file, root), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  source = source.replace(
    /from ['"](\.[^'"]+|three)['"]/g,
    (_, dep) =>
      `from '${dep === "three" ? import.meta.resolve("three") : moduleURL(new URL(dep + ".ts", new URL(file, root)).pathname.slice(root.pathname.length))}'`,
  );
  const url = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  cache.set(file, url);
  return url;
}
