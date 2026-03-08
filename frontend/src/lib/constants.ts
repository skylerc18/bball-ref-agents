export const MAX_VIDEO_ANGLES = 6;
export const DEFAULT_PLAYBACK_RATE = 1;
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";
