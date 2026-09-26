export type WordCue = {
  text: string;
  start: number;
  end: number;
};

export type CaptionConfig = {
  enabled: boolean;
  mode: "word" | "sentence";
  position: "bottom" | "top" | "center";
  font_size_px: number;
  text_color: string;
  active_color: string;
  dim_color: string;
  /** Font file inside studio/public/fonts (e.g. "BeVietnamPro-Bold.ttf"). */
  font_name?: string;
};

export type Scene = {
  index: number;
  narration: string;
  audio: string;
  audio_start: number;
  audio_duration: number;
  start: number;
  end: number;
  video: {
    url: string;
    duration: number;
    start_from: number;
  } | null;
  keyword: string;
  captions: WordCue[];
};

export type Story = {
  version: 1;
  subject: string;
  fps: number;
  width: number;
  height: number;
  duration: number;
  bgm: string | null;
  bgm_volume: number;
  captions: CaptionConfig;
  scenes: Scene[];
};

/** Backdrop behind the centered screenshot. Image/video sources live in studio/public/backgrounds. */
export type ShotBackground = {
  /** solid = plain color, image = still backdrop, video = muted looped clip. */
  type: "solid" | "image" | "video";
  /** publicDir-relative path, e.g. "/backgrounds/dust-01.jpg". Ignored when type is solid. */
  src: string | null;
  color: string;
  /** Gaussian blur px applied to image/video backdrops. Keeps the shot readable. */
  blur: number;
  /** Black scrim opacity 0-1 so the screenshot stays the brightest thing on screen. */
  dim: number;
  /** objectFit for image/video backdrops. */
  fit: "cover" | "contain";
};

export type ShotHook = {
  enabled: boolean;
  text: string;
  /** Phrases rendered in emphasis_color. Matched case/punctuation-insensitively against text. */
  emphasis: string[];
  subtext: string;
  /** top = above the screenshot, bottom = below it. */
  position: "top" | "bottom";
  font_size_px: number;
  color: string;
  emphasis_color: string;
  /** Font file inside studio/public/fonts, resolved by fonts.ts. */
  font_name?: string;
  subtext_font_name?: string;
  /** fade = gentle, pop = scale-in. */
  animate: "fade" | "pop";
};

export type Shot = {
  index: number;
  /** publicDir-relative screenshot path, e.g. "/stories/<slug>/shot/01.png". */
  image: string;
  start: number;
  end: number;
  /** Ken Burns zoom at the end of the shot. 1 = locked off. */
  zoom: number;
  caption: string;
};

export type ShotVideo = {
  version: 1;
  subject: string;
  fps: number;
  width: number;
  height: number;
  bgm: string | null;
  bgm_volume: number;
  background: ShotBackground;
  hook: ShotHook;
  shots: Shot[];
};