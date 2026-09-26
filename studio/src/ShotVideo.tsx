import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  staticFile,
  Video,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
} from "remotion";
import type { Shot, ShotBackground, ShotHook, ShotVideo as ShotVideoProps } from "./types";
import { useCaptionFont } from "./fonts";

const FADE_FRAMES = 8;

function resolveSrc(src: string): string {
  return /^https?:\/\//i.test(src) ? src : staticFile(src);
}

function isImageSrc(src: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(src);
}

/** Reads natural pixel size of a still so the card can preserve its aspect ratio. */
function useImageSize(src: string): { width: number; height: number } | null {
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null);

  React.useEffect(() => {
    setSize(null);
    const handle = delayRender("loading screenshot");
    let settled = false;

    const finish = (result: { width: number; height: number } | null) => {
      if (settled) {
        return;
      }
      settled = true;
      if (result) {
        setSize(result);
      }
      continueRender(handle);
    };

    const probe = new window.Image();
    probe.onload = () => {
      const width = probe.naturalWidth || 1080;
      const height = probe.naturalHeight || 1920;
      finish(width && height ? { width, height } : null);
    };
    probe.onerror = () => finish(null);
    probe.src = resolveSrc(src);

    return () => {
      probe.onload = null;
      probe.onerror = null;
      if (!settled) {
        settled = true;
        continueRender(handle);
      }
    };
  }, [src]);

  return size;
}

const Backdrop: React.FC<{ background: ShotBackground }> = ({ background }) => {
  const solid: React.CSSProperties = { backgroundColor: background.color || "#0B0B0F" };
  if (!background.src || background.type === "solid") {
    return <AbsoluteFill style={solid} />;
  }

  const layerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: background.fit,
    filter: background.blur > 0 ? `blur(${background.blur}px)` : undefined,
  };

  const content =
    background.type === "image" || isImageSrc(background.src) ? (
      <Img src={resolveSrc(background.src)} style={layerStyle} />
    ) : (
      <Video src={resolveSrc(background.src)} muted loop style={layerStyle} />
    );

  return (
    <AbsoluteFill style={solid}>
      {content}
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(0, 0, 0, ${Math.min(1, Math.max(0, background.dim))})`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Splits hook text into words and flags the ones covered by an emphasis phrase. */
function emphasizeWords(text: string, emphasis: string[]): boolean[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (emphasis.length === 0) {
    return words.map(() => false);
  }

  // Normalize each word separately so multi-word phrases keep their word
  // boundaries and can match a contiguous run of words in the text.
  const normWord = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const normalizedWords = words.map(normWord);
  const needles = emphasis
    .map((phrase) => phrase.toLowerCase().split(/\s+/).map(normWord).filter(Boolean))
    .filter((parts) => parts.length > 0);

  return words.map((_, index) => {
    for (const parts of needles) {
      if (parts.length === 1) {
        if (normalizedWords[index] === parts[0]) {
          return true;
        }
        continue;
      }
      // Only test the window anchored at this word. Scanning every offset
      // would mark every word of a matching phrase as emphasized.
      let matched = true;
      for (let part = 0; part < parts.length; part += 1) {
        if (normalizedWords[index + part] !== parts[part]) {
          matched = false;
          break;
        }
      }
      if (matched) {
        return true;
      }
    }
    return false;
  });
}

const HookText: React.FC<{ hook: ShotHook; containerRef?: React.RefObject<HTMLDivElement | null> }> = ({
  hook,
  containerRef,
}) => {
  const font = useCaptionFont(hook.font_name);
  const subtextFont = useCaptionFont(hook.subtext_font_name ?? hook.font_name);
  const frame = useCurrentFrame();

  const entrance = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pop =
    hook.animate === "pop"
      ? interpolate(frame, [0, 12], [0.86, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const words = hook.text.split(/\s+/).filter(Boolean);
  const emphasized = emphasizeWords(hook.text, hook.emphasis);

  return (
    <div
      ref={containerRef}
      style={{
        // alignSelf stretch: the parent flex column uses alignItems center,
        // which would otherwise shrink this to fit-content and let long hook
        // lines overflow the canvas instead of wrapping.
        alignSelf: "stretch",
        boxSizing: "border-box",
        maxWidth: "100%",
        opacity: entrance,
        transform: `scale(${pop})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 22,
        padding: "0 8px",
      }}
    >
      <div
        style={{
          // alignSelf stretch: as a flex item in a centered column this would
          // otherwise take its max-content width and overflow the canvas
          // instead of wrapping onto a second line.
          alignSelf: "stretch",
          boxSizing: "border-box",
          overflowWrap: "break-word",
          fontFamily: font.family,
          fontWeight: font.weight,
          fontSize: hook.font_size_px,
          lineHeight: 1.12,
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: -0.5,
          textShadow: "0 6px 26px rgba(0,0,0,0.92), 0 2px 6px rgba(0,0,0,0.75)",
        }}
      >
        {words.map((word, index) => (
          <span
            key={`${word}-${index}`}
            style={{
              color: emphasized[index] ? hook.emphasis_color : hook.color,
              margin: "0 0.18em",
            }}
          >
            {word}
          </span>
        ))}
      </div>
      {hook.subtext ? (
        <div
          style={{
            fontFamily: subtextFont.family,
            fontWeight: subtextFont.weight,
            fontSize: Math.round(hook.font_size_px * 0.32),
            lineHeight: 1.25,
            textAlign: "center",
            color: hook.color,
            opacity: 0.72,
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            borderRadius: 999,
            padding: "10px 26px",
            maxWidth: "100%",
          }}
        >
          {hook.subtext}
        </div>
      ) : null}
    </div>
  );
};

/** Centered screenshot card: contain-fit, rounded corners, drop shadow, Ken Burns zoom. */
const ShotCard: React.FC<{
  shot: Shot;
  fps: number;
  width: number;
  height: number;
  maxWidth: number;
  maxHeight: number;
}> = ({ shot, fps, width, maxWidth, maxHeight }) => {
  const size = useImageSize(shot.image);
  const frame = useCurrentFrame();
  const totalFrames = Math.max(1, Math.round((shot.end - shot.start) * fps));

  const zoomEnd = shot.zoom > 0 ? shot.zoom : 1;
  const scale = interpolate(frame, [0, totalFrames], [1, zoomEnd], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const aspect = size && size.height > 0 ? size.width / size.height : 0.5625;
  let cardWidth = maxWidth;
  let cardHeight = cardWidth / aspect;
  if (cardHeight > maxHeight) {
    cardHeight = maxHeight;
    cardWidth = cardHeight * aspect;
  }

  return (
    <div
      style={{
        width: cardWidth,
        height: cardHeight,
        maxWidth: `${maxWidth}px`,
        maxHeight: `${maxHeight}px`,
        borderRadius: Math.round(width * 0.028),
        overflow: "hidden",
        backgroundColor: "#000",
        boxShadow: `0 ${Math.round(width * 0.03)}px ${Math.round(width * 0.09)}px rgba(0, 0, 0, 0.62), 0 0 0 1px rgba(255,255,255,0.10)`,
      }}
    >
      <Img
        src={resolveSrc(shot.image)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      />
    </div>
  );
};

const CaptionBar: React.FC<{ caption: string; fontName?: string }> = ({ caption, fontName }) => {
  const font = useCaptionFont(fontName);
  if (!caption) {
    return null;
  }
  return (
    <div
      style={{
        fontFamily: font.family,
        fontWeight: font.weight,
        fontSize: 40,
        lineHeight: 1.3,
        textAlign: "center",
        color: "#FFFFFF",
        opacity: 0.85,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        borderRadius: 16,
        padding: "14px 28px",
        maxWidth: "100%",
      }}
    >
      {caption}
    </div>
  );
};

const ShotSequence: React.FC<{
  shot: Shot;
  hook: ShotHook;
  hookBelow: boolean;
  fps: number;
  width: number;
  height: number;
  isLast: boolean;
}> = ({ shot, hook, hookBelow, fps, width, height, isLast }) => {
  const frame = useCurrentFrame();
  const totalFrames = Math.max(1, Math.round((shot.end - shot.start) * fps));
  const hookRef = React.useRef<HTMLDivElement | null>(null);
  const [measuredHookHeight, setMeasuredHookHeight] = React.useState(0);

  React.useLayoutEffect(() => {
    const measured = hookRef.current?.offsetHeight ?? 0;
    setMeasuredHookHeight(measured);
  }, [hook.text, hook.subtext, hook.font_size_px, hook.enabled, hook.position]);

  const fadeIn = interpolate(frame, [0, FADE_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = isLast
    ? interpolate(
        frame,
        [Math.max(0, totalFrames - FADE_FRAMES), totalFrames],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : interpolate(
        frame,
        [Math.max(0, totalFrames - FADE_FRAMES), totalFrames],
        [1, 0.35],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );

  const sidePadding = Math.round(width * 0.06);
  const topPadding = Math.round(height * 0.055);
  const bottomPadding = Math.round(height * 0.035);
  const gap = Math.round(height * 0.022);

  const hasHook = hook.enabled && hook.text.trim().length > 0;
  // Measured hook height keeps the card as large as possible for short hooks.
  // Falls back to a conservative 30% reserve on the very first layout pass.
  const hookZone = hasHook ? measuredHookHeight || Math.round(height * 0.3) : 0;
  const captionZone = shot.caption ? Math.round(height * 0.1) : 0;
  const maxWidth = width - sidePadding * 2;
  const reserved =
    topPadding +
    bottomPadding +
    captionZone +
    gap * (hasHook ? 2 : 0) +
    (shot.caption ? gap : 0);
  const maxHeight = Math.max(120, height - reserved - hookZone);

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: `${topPadding}px ${sidePadding}px ${bottomPadding}px`,
        }}
      >
        {hasHook && !hookBelow ? <HookText hook={hook} containerRef={hookRef} /> : null}
        {hasHook ? <div style={{ height: gap, flexShrink: 0 }} /> : null}
        <div
          style={{
            flex: 1,
            width: "100%",
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ShotCard
            shot={shot}
            fps={fps}
            width={width}
            height={height}
            maxWidth={maxWidth}
            maxHeight={maxHeight}
          />
        </div>
        {hasHook ? <div style={{ height: gap, flexShrink: 0 }} /> : null}
        {hasHook && hookBelow ? <HookText hook={hook} containerRef={hookRef} /> : null}
        {captionZone > 0 ? (
          <>
            <div style={{ height: gap, flexShrink: 0 }} />
            <CaptionBar caption={shot.caption} fontName={hook.subtext_font_name ?? hook.font_name} />
          </>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const ShotVideo: React.FC<ShotVideoProps> = ({
  fps,
  width,
  height,
  bgm,
  bgm_volume,
  background,
  hook,
  shots,
}) => {
  return (
    <AbsoluteFill style={{ width, height, backgroundColor: background.color || "#0B0B0F" }}>
      <Backdrop background={background} />
      {shots.map((shot, index) => {
        const startFrame = Math.round(shot.start * fps);
        const durationInFrames = Math.max(1, Math.round((shot.end - shot.start) * fps));
        return (
          <Sequence
            key={shot.index}
            from={startFrame}
            durationInFrames={durationInFrames}
            name={`Shot ${shot.index}`}
            premountFor={Math.round(fps * 0.5)}
          >
            <ShotSequence
              shot={shot}
              hook={hook}
              hookBelow={hook.position === "bottom"}
              fps={fps}
              width={width}
              height={height}
              isLast={index === shots.length - 1}
            />
          </Sequence>
        );
      })}
      {bgm ? <Audio src={staticFile(bgm)} volume={bgm_volume} loop /> : null}
    </AbsoluteFill>
  );
};
