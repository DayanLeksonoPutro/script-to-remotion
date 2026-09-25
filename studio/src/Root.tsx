import { Composition, getInputProps } from "remotion";
import { Story } from "./Story";
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

export const RemotionRoot: React.FC = () => {
  const story = loadStory();
  const durationInFrames = Math.max(1, Math.round(story.duration * story.fps));

  return (
    <Composition
      id="Story"
      component={Story}
      durationInFrames={durationInFrames}
      fps={story.fps}
      width={story.width}
      height={story.height}
      defaultProps={story}
    />
  );
};