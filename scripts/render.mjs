#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const studio = path.join(root, "studio");

const slug = process.argv[2];
if (!slug) {
  console.error("usage: node scripts/render.mjs <slug>");
  process.exit(1);
}

const storyFile = path.join(studio, "public", "stories", slug, "story.json");
if (!existsSync(storyFile)) {
  console.error(`story not found: ${storyFile}`);
  console.error("jalankan pipeline dulu, atau cek nama slug.");
  process.exit(1);
}

const outDir = path.join(root, "out", slug);
mkdirSync(outDir, { recursive: true });

const props = `./public/stories/${slug}/story.json`;
const output = path.join(outDir, "final.mp4");
const cmd = [
  `npx remotion render`,
  `src/index.ts`,
  `Story`,
  `--props="${props}"`,
  `--codec=h264`,
  `"${output}"`,
].join(" ");
console.log(`> ${cmd}`);
execSync(cmd, { stdio: "inherit", cwd: studio });
console.log(`\ndone: ${output}`);