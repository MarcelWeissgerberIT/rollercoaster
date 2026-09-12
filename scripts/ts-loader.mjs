import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";
const root = fileURLToPath(new URL("../", import.meta.url));
const output = mkdtempSync(join(tmpdir(), "coaster-grove-tests-"));
const cache = new Map();
process.on("exit", () => rmSync(output, { recursive: true, force: true }));
/** Native file imports share each dependency once. Nested data URLs duplicated
 * the entire simulation inside every renderer and exhausted memory as it grew. */
export function moduleURL(file) {
  const absolute = resolve(root, file);
  if (cache.has(absolute)) return cache.get(absolute);
  const relative = absolute.slice(root.length),
    target = join(output, relative.replace(/\.(ts|json)$/, ".mjs"));
  const url = pathToFileURL(target).href;
  cache.set(absolute, url);
  mkdirSync(dirname(target), { recursive: true });
  if (file.endsWith(".json")) {
    writeFileSync(target, "export default " + readFileSync(absolute, "utf8"));
    return url;
  }
  let source = ts.transpileModule(readFileSync(absolute, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  source = source.replace(/from ['"](\.[^'"]+|three(?:\/[^'"]+)?)['"]/g, (_, dep) => {
    const dependency = dep.startsWith("three")
      ? import.meta.resolve(dep)
      : moduleURL(resolve(dirname(absolute), dep.endsWith(".json") ? dep : dep + ".ts"));
    return `from '${dependency}'`;
  });
  writeFileSync(target, source);
  return url;
}
