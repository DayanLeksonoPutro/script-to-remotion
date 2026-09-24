import * as fs from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(4);

const macChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
} else if (process.platform === "darwin" && fs.existsSync(macChrome)) {
  // Prefer installed Google Chrome over the bundled Headless Shell download,
  // which is flaky on some systems / Node versions.
  Config.setBrowserExecutable(macChrome);
}