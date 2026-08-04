// EyeDropper API (Chromium) — absente des lib DOM par défaut. Déclaration ambiante minimale
// pour un usage typé sans cast (`window.EyeDropper?`).
interface EyeDropperResult {
  sRGBHex: string;
}
interface EyeDropperInstance {
  open(options?: { signal?: AbortSignal }): Promise<EyeDropperResult>;
}
interface EyeDropperConstructor {
  new (): EyeDropperInstance;
}

declare global {
  interface Window {
    EyeDropper?: EyeDropperConstructor;
  }
}

export {};
