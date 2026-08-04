<script setup lang="ts">
import ChannelSlider from '@/components/atoms/ChannelSlider.vue';
import type { ColorMetadata } from '@/composables/options/useOptionsCatalog';
import { formatHex, formatHex8, hsv, oklch, parse, rgb } from 'culori';
import { computed, ref, watch } from 'vue';

// Picker multi-mode. Contrat = couleur oklch canonique (`ColorMetadata`, SSOT). Chaque mode est un
// ÉDITEUR différent lisant/écrivant la même valeur oklch :
//  · picker : carré saturation/valeur + teinte (interne en HSV) ;
//  · hex    : champ hex validé par regex ;
//  · rgba / oklch : sliders par canal + saisie numérique inline (précision).
// Aperçu de la couleur toujours visible. Saisie pipette écran (EyeDropper) disponible partout.
const props = defineProps<{ modelValue: ColorMetadata }>();
const emit = defineEmits<{ 'update:modelValue': [value: ColorMetadata] }>();

type Mode = 'picker' | 'hex' | 'rgba' | 'oklch';
const modes: { value: Mode; label: string }[] = [
  { value: 'picker', label: 'Picker' },
  { value: 'hex', label: 'HEX' },
  { value: 'rgba', label: 'RGBA' },
  { value: 'oklch', label: 'OKLCH' },
];
const mode = ref<Mode>('picker');

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
function approxEqual(a: ColorMetadata, b: ColorMetadata): boolean {
  return (
    Math.abs(a.l - b.l) < 1e-3 &&
    Math.abs(a.c - b.c) < 1e-3 &&
    Math.abs(a.h - b.h) < 0.5 &&
    Math.abs(a.alpha - b.alpha) < 1e-2
  );
}

let lastEmitted: ColorMetadata | null = null;
function emitOklch(next: ColorMetadata) {
  const rounded: ColorMetadata = {
    l: round(next.l, 4),
    c: round(next.c, 4),
    h: round(next.h, 2),
    alpha: round(next.alpha, 2),
  };
  lastEmitted = rounded;
  emit('update:modelValue', rounded);
}

// --- Mode PICKER : état HSV interne (source pendant l'interaction au carré) ---
const hue = ref(0);
const sat = ref(0);
const val = ref(1);
const alpha = ref(1);

function syncFromModel(m: ColorMetadata) {
  const c = hsv({ mode: 'oklch', l: m.l, c: m.c, h: m.h, alpha: m.alpha });
  if (!c) return;
  if (c.h !== undefined) hue.value = c.h; // garde la teinte si gris
  sat.value = c.s ?? 0;
  val.value = c.v ?? 0;
  alpha.value = m.alpha;
}
function emitFromHsv() {
  const c = oklch({ mode: 'hsv', h: hue.value, s: sat.value, v: val.value, alpha: alpha.value });
  if (!c) return;
  emitOklch({ l: c.l, c: c.c ?? 0, h: c.h ?? 0, alpha: alpha.value });
}

watch(
  () => props.modelValue,
  (m) => {
    if (lastEmitted && approxEqual(m, lastEmitted)) return; // écho de notre propre émission
    syncFromModel(m);
  },
  { immediate: true },
);
// À l'ouverture du mode picker, refléter la valeur courante dans l'état HSV.
watch(mode, (m) => {
  if (m === 'picker') syncFromModel(props.modelValue);
});

// --- Rendu / aperçu ---
const cssColor = computed(
  () =>
    `oklch(${props.modelValue.l} ${props.modelValue.c} ${props.modelValue.h} / ${props.modelValue.alpha})`,
);
const opaqueCss = computed(
  () => `oklch(${props.modelValue.l} ${props.modelValue.c} ${props.modelValue.h})`,
);
const hueCss = computed(() => `hsl(${hue.value} 100% 50%)`);

// --- Mode HEX ---
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const hexValue = computed(() => {
  const c = { mode: 'oklch' as const, ...props.modelValue };
  return (props.modelValue.alpha < 1 ? formatHex8(c) : formatHex(c)) ?? '#000000';
});
function onHexChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const raw = input.value.trim();
  const parsed = HEX_RE.test(raw) ? oklch(parse(raw)) : undefined;
  if (!parsed) {
    input.value = hexValue.value; // saisie invalide → revert
    return;
  }
  emitOklch({ l: parsed.l, c: parsed.c ?? 0, h: parsed.h ?? 0, alpha: parsed.alpha ?? 1 });
}

// --- Mode RGBA ---
const rgbView = computed(() => {
  const c = rgb({ mode: 'oklch', ...props.modelValue });
  const to255 = (n?: number) => Math.round(clamp01(n ?? 0) * 255);
  return { r: to255(c?.r), g: to255(c?.g), b: to255(c?.b) };
});
function setRgb(channel: 'r' | 'g' | 'b', value: number) {
  const next = { ...rgbView.value, [channel]: value };
  const c = oklch({
    mode: 'rgb',
    r: clamp01(next.r / 255),
    g: clamp01(next.g / 255),
    b: clamp01(next.b / 255),
    alpha: props.modelValue.alpha,
  });
  if (c) emitOklch({ l: c.l, c: c.c ?? 0, h: c.h ?? 0, alpha: props.modelValue.alpha });
}

// --- Mode OKLCH (édition directe des canaux) ---
function setOklch(channel: keyof ColorMetadata, value: number) {
  emitOklch({ ...props.modelValue, [channel]: value });
}

// --- Carré saturation / valeur (mode picker) ---
const squareRef = ref<HTMLElement | null>(null);
function updateFromSquare(event: PointerEvent) {
  const el = squareRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  sat.value = clamp01((event.clientX - rect.left) / rect.width);
  val.value = 1 - clamp01((event.clientY - rect.top) / rect.height);
  emitFromHsv();
}
function onSquareDown(event: PointerEvent) {
  squareRef.value?.setPointerCapture(event.pointerId);
  updateFromSquare(event);
}
function onSquareMove(event: PointerEvent) {
  if (event.buttons !== 1) return;
  updateFromSquare(event);
}
function onHue(event: Event) {
  hue.value = Number((event.target as HTMLInputElement).value);
  emitFromHsv();
}
function onPickerAlpha(event: Event) {
  alpha.value = Number((event.target as HTMLInputElement).value);
  emitFromHsv();
}

// --- Pipette écran (EyeDropper) ---
const canEyedrop = typeof window !== 'undefined' && !!window.EyeDropper;
async function pickFromScreen() {
  if (!window.EyeDropper) return;
  try {
    const { sRGBHex } = await new window.EyeDropper().open();
    const c = oklch(parse(sRGBHex));
    if (c) emitOklch({ l: c.l, c: c.c ?? 0, h: c.h ?? 0, alpha: c.alpha ?? 1 });
  } catch {
    // Sélection annulée — rien à faire.
  }
}
</script>

<template>
  <div class="space-y-3 w-full max-w-xs">
    <!-- Aperçu + mode + pipette (toujours visibles) -->
    <div class="flex items-center gap-2">
      <div class="relative w-9 h-9 rounded-lg border border-gray-300 overflow-hidden shrink-0">
        <div class="absolute inset-0 checkerboard" />
        <div
          class="absolute inset-0"
          :style="{ backgroundColor: cssColor }"
        />
      </div>
      <select
        v-model="mode"
        class="text-xs border border-gray-300 rounded px-1.5 py-1.5 bg-white cursor-pointer"
        aria-label="Mode d'édition"
      >
        <option
          v-for="m in modes"
          :key="m.value"
          :value="m.value"
        >
          {{ m.label }}
        </option>
      </select>
      <span class="flex-1 min-w-0 truncate text-xs font-mono text-gray-400">{{ hexValue }}</span>
      <button
        v-if="canEyedrop"
        type="button"
        class="p-1.5 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 cursor-pointer shrink-0"
        title="Pipette écran"
        @click="pickFromScreen"
      >
        <svg
          class="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m2 22 1-1h3l9-9" />
          <path d="M3 21v-3l9-9" />
          <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
        </svg>
      </button>
    </div>

    <!-- Mode PICKER : carré SV + teinte + alpha -->
    <div
      v-if="mode === 'picker'"
      class="space-y-2"
    >
      <div
        ref="squareRef"
        class="relative w-full h-40 rounded-lg cursor-crosshair touch-none select-none"
        :style="{ backgroundColor: hueCss }"
        @pointerdown="onSquareDown"
        @pointermove="onSquareMove"
      >
        <div
          class="absolute inset-0 rounded-lg"
          style="background: linear-gradient(to right, #fff, transparent)"
        />
        <div
          class="absolute inset-0 rounded-lg"
          style="background: linear-gradient(to top, #000, transparent)"
        />
        <div
          class="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/30 pointer-events-none"
          :style="{ left: `${sat * 100}%`, top: `${(1 - val) * 100}%`, backgroundColor: opaqueCss }"
        />
      </div>
      <input
        class="hue-slider w-full h-3 appearance-none rounded-full cursor-pointer"
        type="range"
        min="0"
        max="360"
        step="1"
        :value="hue"
        aria-label="Teinte"
        @input="onHue"
      />
      <input
        class="alpha-slider w-full h-3 appearance-none rounded-full cursor-pointer"
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="alpha"
        aria-label="Opacité"
        :style="{ '--stop': opaqueCss }"
        @input="onPickerAlpha"
      />
    </div>

    <!-- Mode HEX -->
    <input
      v-else-if="mode === 'hex'"
      class="w-full px-2.5 py-1.5 text-sm font-mono border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      type="text"
      :value="hexValue"
      spellcheck="false"
      placeholder="#RRGGBB ou #RRGGBBAA"
      @change="onHexChange"
    />

    <!-- Mode RGBA -->
    <div
      v-else-if="mode === 'rgba'"
      class="space-y-2"
    >
      <ChannelSlider
        label="R"
        :min="0"
        :max="255"
        :step="1"
        :model-value="rgbView.r"
        @update:model-value="setRgb('r', $event)"
      />
      <ChannelSlider
        label="G"
        :min="0"
        :max="255"
        :step="1"
        :model-value="rgbView.g"
        @update:model-value="setRgb('g', $event)"
      />
      <ChannelSlider
        label="B"
        :min="0"
        :max="255"
        :step="1"
        :model-value="rgbView.b"
        @update:model-value="setRgb('b', $event)"
      />
      <ChannelSlider
        label="A"
        :min="0"
        :max="1"
        :step="0.01"
        :model-value="modelValue.alpha"
        @update:model-value="setOklch('alpha', $event)"
      />
    </div>

    <!-- Mode OKLCH -->
    <div
      v-else
      class="space-y-2"
    >
      <ChannelSlider
        label="L"
        :min="0"
        :max="1"
        :step="0.001"
        :model-value="modelValue.l"
        @update:model-value="setOklch('l', $event)"
      />
      <ChannelSlider
        label="C"
        :min="0"
        :max="0.4"
        :step="0.001"
        :model-value="modelValue.c"
        @update:model-value="setOklch('c', $event)"
      />
      <ChannelSlider
        label="H"
        :min="0"
        :max="360"
        :step="1"
        :model-value="modelValue.h"
        @update:model-value="setOklch('h', $event)"
      />
      <ChannelSlider
        label="A"
        :min="0"
        :max="1"
        :step="0.01"
        :model-value="modelValue.alpha"
        @update:model-value="setOklch('alpha', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.checkerboard {
  background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0;
}
.hue-slider {
  background: linear-gradient(
    to right,
    hsl(0 100% 50%),
    hsl(60 100% 50%),
    hsl(120 100% 50%),
    hsl(180 100% 50%),
    hsl(240 100% 50%),
    hsl(300 100% 50%),
    hsl(360 100% 50%)
  );
}
.alpha-slider {
  background:
    linear-gradient(to right, transparent, var(--stop)),
    repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 10px 10px;
}
.hue-slider::-webkit-slider-thumb,
.alpha-slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  background: #fff;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
  cursor: pointer;
}
.hue-slider::-moz-range-thumb,
.alpha-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  background: #fff;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
  cursor: pointer;
}
</style>
