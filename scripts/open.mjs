#!/usr/bin/env node
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const studio = path.join(root, "studio");

const slug = process.argv[2];
const props = slug ? `--props=./public/stories/${slug}/story.json` : "";
const cmd = `npx remotion studio ${props}`.trim();
console.log(`> ${cmd}`);
execSync(cmd, { stdio: "inherit", cwd: studio });