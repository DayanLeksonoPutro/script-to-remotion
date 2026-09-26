import { Composition, getInputProps } from "remotion";
import { Story } from "./Story";
import { ShotVideo } from "./ShotVideo";
import type { Shot, ShotBackground, ShotHook, ShotVideo as ShotVideoProps } from "./types";
import type { Story as StoryProps } from "./types";

// Without --props (studio/render), show a minimal placeholder so the
// composition still registers with valid dimensions.
function sampleStory(): StoryProps {
  return {
    version: 1,
    subject: "No story loaded — pass --props",
    fps: 30,
    width: 1080,
    height: 1920,
    duration: 4,
    bgm: null,
    bgm_volume: 0,
    captions: {
      enabled: true,
      mode: "word",
      position: "bottom",
      font_size_px: 88,
      text_color: "#FFFFFF",
      active_color: "#FFD93D",
      dim_color: "#9E9E9E",
      font_name: "UTM Kabel KT.ttf",
    },
    scenes: [
      {
        index: 0,
        narration: "Jalankan: npx remotion studio --props=./public/stories/<slug>/story.json",
        audio: "",
        audio_start: 0,
        audio_duration: 0,
        start: 0,
        end: 4,
        video: null,
        keyword: "",
        captions: [
          { text: "Jalankan", start: 0.2, end: 0.9 },
          { text: "render", start: 0.9, end: 1.6 },
          { text: "dengan", start: 1.6, end: 2.1 },
          { text: "--props", start: 2.1, end: 3.0 },
        ],
      },
    ],
  };
}

function loadStory(): StoryProps {
  const inputProps = getInputProps() as StoryProps | null;
  if (inputProps && Array.isArray(inputProps.scenes) && inputProps.scenes.length > 0) {
    return inputProps;
  }
  return sampleStory();
}

const DEFAULT_BACKGROUND: ShotBackground = {
  type: "solid",
  src: null,
  color: "#0B0B0F",
  blur: 0,
  dim: 0.45,
  fit: "cover",
};

const DEFAULT_HOOK: ShotHook = {
  enabled: false,
  text: "",
  emphasis: [],
  subtext: "",
  position: "top",
  font_size_px: 96,
  color: "#FFFFFF",
  emphasis_color: "#FFD93D",
  font_name: "BeVietnamPro-Bold.ttf",
  subtext_font_name: "BeVietnamPro-Medium.ttf",
  animate: "pop",
};

function sampleShotVideo(): ShotVideoProps {
  return {
    version: 1,
    subject: "No shot.json loaded — pass --props",
    fps: 30,
    width: 1080,
    height: 1920,
    bgm: null,
    bgm_volume: 0,
    background: DEFAULT_BACKGROUND,
    hook: DEFAULT_HOOK,
    shots: [
      {
        index: 0,
        image: "",
        start: 0,
        end: 4,
        zoom: 1,
        caption: "Jalankan: node scripts/render-shot.mjs <slug>",
      },
    ],
  };
}

/** Fills every field so a partial shot.json still renders instead of crashing. */
function loadShotVideo(): ShotVideoProps {
  const raw = getInputProps() as Partial<ShotVideoProps> | null;
  if (!raw || !Array.isArray(raw.shots) || raw.shots.length === 0) {
    return sampleShotVideo();
  }
  const shots: Shot[] = raw.shots.map((shot, index) => {
    const start = Number(shot?.start ?? index * 3);
    const end = Number(shot?.end ?? start + 3);
    return {
      index: Number(shot?.index ?? index),
      image: String(shot?.image ?? ""),
      start,
      end: end > start ? end : start + 3,
      zoom: Number(shot?.zoom ?? 1) || 1,
      caption: String(shot?.caption ?? ""),
    };
  });
  return {
    version: 1,
    subject: String(raw.subject ?? "screenshot-video"),
    fps: Number(raw.fps ?? 30) || 30,
    width: Number(raw.width ?? 1080) || 1080,
    height: Number(raw.height ?? 1920) || 1920,
    bgm: raw.bgm ?? null,
    bgm_volume: Number(raw.bgm_volume ?? 0.2),
    background: { ...DEFAULT_BACKGROUND, ...(raw.background ?? {}) },
    hook: { ...DEFAULT_HOOK, ...(raw.hook ?? {}) },
    shots,
  };
}

export const RemotionRoot: React.FC = () => {
  const story = loadStory();
  const durationInFrames = Math.max(1, Math.round(story.duration * story.fps));

  const shotVideo = loadShotVideo();
  const shotDurationInFrames = Math.max(
    1,
    Math.round(shotVideo.shots.reduce((maxEnd, shot) => Math.max(maxEnd, shot.end), 0) * shotVideo.fps),
  );

  return (
    <>
      <Composition
        id="Story"
        component={Story}
        durationInFrames={durationInFrames}
        fps={story.fps}
        width={story.width}
        height={story.height}
        defaultProps={story}
      />
      <Composition
        id="ShotVideo"
        component={ShotVideo}
        durationInFrames={shotDurationInFrames}
        fps={shotVideo.fps}
        width={shotVideo.width}
        height={shotVideo.height}
        defaultProps={shotVideo}
      />
    </>
  );
};