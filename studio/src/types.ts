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