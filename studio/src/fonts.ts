import React from "react";
import { continueRender, delayRender, staticFile } from "remotion";

export type FontSpec = {
  file: string;
  family: string;
  weight: number;
};

export const FONT_MAP: Record<string, FontSpec> = {
  "BeVietnamPro-Bold.ttf": { file: "BeVietnamPro-Bold.ttf", family: "Be Vietnam Pro", weight: 700 },
  "BeVietnamPro-Medium.ttf": {
    file: "BeVietnamPro-Medium.ttf",
    family: "Be Vietnam Pro",
    weight: 500,
  },
  "Charm-Bold.ttf": { file: "Charm-Bold.ttf", family: "Charm", weight: 700 },
  "Charm-Regular.ttf": { file: "Charm-Regular.ttf", family: "Charm", weight: 400 },
  "MicrosoftYaHeiBold.ttc": {
    file: "MicrosoftYaHeiBold.ttc",
    family: "Microsoft YaHei",
    weight: 700,
  },
  "MicrosoftYaHeiNormal.ttc": {
    file: "MicrosoftYaHeiNormal.ttc",
    family: "Microsoft YaHei",
    weight: 400,
  },
  "STHeitiLight.ttc": { file: "STHeitiLight.ttc", family: "STHeiti", weight: 300 },
  "STHeitiMedium.ttc": { file: "STHeitiMedium.ttc", family: "STHeiti", weight: 500 },
};

export const DEFAULT_FONT: FontSpec = {
  file: "UTM Kabel KT.ttf",
  family: "UTM Kabel KT",
  weight: 400,
};

const loadedFonts = new Map<string, Promise<FontFace | null>>();

function loadFont(spec: FontSpec): Promise<FontFace | null> {
  const cached = loadedFonts.get(spec.file);
  if (cached) {
    return cached;
  }
  const pending: Promise<FontFace | null> = new FontFace(
    spec.family,
    `url(${staticFile(`fonts/${encodeURIComponent(spec.file)}`)})`,
    { weight: String(spec.weight) },
  )
    .load()
    .then((face) => {
      document.fonts.add(face);
      return face;
    })
    .catch((error) => {
      console.warn(`[fonts] failed to load "${spec.file}":`, error);
      return null;
    });
  loadedFonts.set(spec.file, pending);
  return pending;
}

export function resolveFont(fontName: string | undefined): FontSpec {
  if (fontName && FONT_MAP[fontName]) {
    return FONT_MAP[fontName];
  }
  return DEFAULT_FONT;
}

/**
 * Ensure the caption font is registered with the document before the first
 * frame renders. Blocks rendering until the font file is fetched.
 */
export function useCaptionFont(fontName: string | undefined): FontSpec {
  const spec = resolveFont(fontName);
  const handleRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (handleRef.current !== null) {
      continueRender(handleRef.current);
    }
    const handle = delayRender(`loading font ${spec.file}`);
    handleRef.current = handle;
    let active = true;
    loadFont(spec).then(() => {
      if (active && handleRef.current === handle) {
        continueRender(handle);
        handleRef.current = null;
      }
    });
    return () => {
      active = false;
      if (handleRef.current === handle) {
        continueRender(handle);
        handleRef.current = null;
      }
    };
  }, [spec.file]);

  return spec;
}