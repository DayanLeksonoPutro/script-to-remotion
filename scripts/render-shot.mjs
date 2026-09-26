#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const studio = path.join(root, "studio");

const slug = process.argv[2];
const stillIndex = process.argv.indexOf("--still");
const stillFrame = stillIndex !== -1 ? process.argv[stillIndex + 1] : null;
if (!slug) {
  console.error("usage: node scripts/render-shot.mjs <slug> [--still <frame>]");
  process.exit(1);
}

const jobDir = path.join(studio, "public", "stories", slug);
const shotFile = path.join(jobDir, "shot.json");
if (!existsSync(shotFile)) {
  console.error(`shot.json not found: ${shotFile}`);
  console.error("skill screenshot-video menulis file ini; cek nama slug.");
  process.exit(1);
}

const shot = JSON.parse(readFileSync(shotFile, "utf8"));
const missing = (shot.shots ?? []).filter((s) => !s.image || !existsSync(path.join(studio, "public", s.image)));
if (missing.length > 0) {
  console.error(`screenshot tidak ditemukan di studio/public:`);
  for (const s of missing) {
    console.error(`  - ${s.image}`);
  }
  process.exit(1);
}

const outDir = path.join(root, "out", slug);
mkdirSync(outDir, { recursive: true });

const props = `./public/stories/${slug}/shot.json`;

if (stillFrame !== null) {
  const still = path.join(outDir, "preview.png");
  const cmd = [
    `npx remotion still`,
    `src/index.ts`,
    `ShotVideo`,
    `--props="${props}"`,
    `--frame=${stillFrame}`,
    `"${still}"`,
  ].join(" ");
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: studio });
  console.log(`\ndone: ${still}`);
  process.exit(0);
}

const output = path.join(outDir, "final.mp4");
const cmd = [
  `npx remotion render`,
  `src/index.ts`,
  `ShotVideo`,
  `--props="${props}"`,
  `--codec=h264`,
  `"${output}"`,
].join(" ");
console.log(`> ${cmd}`);
execSync(cmd, { stdio: "inherit", cwd: studio });
console.log(`\ndone: ${output}`);
