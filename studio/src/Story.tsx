import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  staticFile,
  Video,
  useCurrentFrame,
  interpolate,
  delayRender,
  continueRender,
} from "remotion";
import type { CaptionConfig, Scene, Story as StoryProps } from "./types";
import { useCaptionFont } from "./fonts";

let fontPromise: Promise<FontFace> | null = null;

function loadCaptionFont(): Promise<FontFace> {
  if (!fontPromise) {
    const face = new FontFace(
      "CaptionFont",
      `url(${staticFile("/fonts/BeVietnamPro-Bold.ttf")}) format("truetype")`,
      { weight: "800" },
    );
    fontPromise = face.load().then((loaded) => {
      document.fonts.add(loaded);
      return loaded;
    });
  }
  return fontPromise;
}

const CaptionFontProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = React.useState(false);
  const [handle] = React.useState(() => delayRender("loading caption font"));
  React.useEffect(() => {
    loadCaptionFont()
      .then(() => setReady(true))
      .finally(() => continueRender(handle));
  }, [handle]);
  if (!ready) {
    return null;
  }
  return <>{children}</>;
};

function sceneFrameDuration(scene: Scene, fps: number): number {
  return Math.max(1, Math.round((scene.end - scene.start) * fps));
}

const MediaFill: React.FC<{ scene: Scene; fps: number }> = ({ scene, fps }) => {
  const { video } = scene;
  if (!video) {
    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(160deg, #1b2a4a 0%, #22305c 45%, #12203f 100%)`,
        }}
      />
    );
  }

  const coverStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };

  const isImage = /\.(jpe?g|png|webp)$/i.test(video.url);
  if (isImage) {
    return <Img src={staticFile(video.url)} style={coverStyle} />;
  }

  const startFrom = Math.max(0, Math.round(video.start_from * fps));
  const materialFrames = Math.max(1, Math.round(video.duration * fps));
  if (startFrom >= materialFrames - 1) {
    return <Video src={staticFile(video.url)} muted style={coverStyle} />;
  }
  return <Video src={staticFile(video.url)} muted startFrom={startFrom} style={coverStyle} />;
};

const SceneFill: React.FC<{ scene: Scene; fps: number }> = ({ scene, fps }) => {
  const frame = useCurrentFrame();
  const totalFrames = sceneFrameDuration(scene, fps);
  const fadeIn = interpolate(frame, [0, Math.min(totalFrames, fps * 0.45)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [Math.max(0, totalFrames - fps * 0.45), totalFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <MediaFill scene={scene} fps={fps} />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const WordCaptions: React.FC<{
  captions: Scene["captions"];
  config: CaptionConfig;
  fps: number;
}> = ({ captions, config, fps }) => {
  const font = useCaptionFont(config.font_name);
  const frame = useCurrentFrame();
  const time = frame / fps;

  let activeIndex = -1;
  for (let i = 0; i < captions.length; i += 1) {
    if (time >= captions[i].start && time < captions[i].end) {
      activeIndex = i;
      break;
    }
  }

  const isSentence = config.mode === "sentence";
  const containerPosition: React.CSSProperties =
    config.position === "top"
      ? { top: "10%", flexDirection: "column" }
      : config.position === "center"
        ? { top: "50%", transform: "translateY(-50%)", flexDirection: "column" }
        : { bottom: "12%", flexDirection: "column" };

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 4%",
        ...containerPosition,
      }}
    >
      <div
        style={{
          background: "rgba(0, 0, 0, 0.66)",
          borderRadius: 18,
          padding: "18px 34px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          maxWidth: "96%",
        }}
      >
        {captions.map((cue, index) => {
          let color = config.dim_color;
          if (index === activeIndex) {
            color = config.active_color;
          } else if (isSentence ? index < activeIndex : index < activeIndex) {
            color = config.text_color;
          }
          const opacity = index === activeIndex ? 1 : index < activeIndex ? 0.9 : 0.45;
          return (
            <span
              key={index}
style={{
                fontFamily: font.family,
                fontSize: config.font_size_px,
                fontWeight: font.weight,
                lineHeight: 1.25,
                textAlign: "center",
                margin: "0 6px",
                color,
                opacity,
                textShadow: "0 2px 10px rgba(0,0,0,0.95), 0 -2px 4px rgba(0,0,0,0.6)",
              }}
            >
              {cue.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const SceneSequence: React.FC<{
  scene: Scene;
  config: CaptionConfig;
  fps: number;
}> = ({ scene, config, fps }) => {
  const startFrame = Math.round(scene.start * fps);
  const totalFrames = sceneFrameDuration(scene, fps);
  const audioOffset = Math.max(0, Math.round((scene.audio_start - scene.start) * fps));

  return (
    <Sequence
      from={startFrame}
      durationInFrames={totalFrames}
      name={`Scene ${scene.index}`}
      premountFor={Math.round(fps * 0.5)}
    >
      <SceneFill scene={scene} fps={fps} />
      <Sequence from={audioOffset}>
        {scene.audio ? <Audio src={staticFile(scene.audio)} /> : null}
        {config.enabled && scene.captions.length > 0 ? (
          <WordCaptions captions={scene.captions} config={config} fps={fps} />
        ) : null}
      </Sequence>
    </Sequence>
  );
};

export const Story: React.FC<StoryProps> = ({
  fps,
  width,
  height,
  bgm,
  bgm_volume,
  captions,
  scenes,
}) => {
  const durationInFrames = Math.max(
    1,
    scenes.reduce((maxEnd, scene) => Math.max(maxEnd, scene.end), 0) * fps,
  );

  return (
    <CaptionFontProvider>
      <AbsoluteFill style={{ width, height, backgroundColor: "#000" }}>
      {scenes.map((scene) => (
        <SceneSequence
          key={scene.index}
          scene={scene}
          config={captions}
          fps={fps}
        />
      ))}
      {bgm ? <Audio src={staticFile(bgm)} volume={bgm_volume} loop /> : null}
      </AbsoluteFill>
    </CaptionFontProvider>
  );
};