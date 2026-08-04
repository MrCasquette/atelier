<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

// Sélecteur de date générique (popover calendrier). Sortie ISO : `YYYY-MM-DD`, ou
// `YYYY-MM-DDTHH:mm` si `time`. Aucune dépendance métier — utilisable pour tout champ `date`.
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_PER_GRID = 42;

const props = withDefaults(
  defineProps<{
    modelValue: string;
    time?: boolean;
    placeholder?: string;
    disabled?: boolean;
  }>(),
  {
    time: false,
    placeholder: 'Sélectionner une date',
    disabled: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const isOpen = ref(false);
const root = ref<HTMLElement | null>(null);
const currentMonth = ref(new Date());

const pad2 = (n: number) => String(n).padStart(2, '0');
const toISODate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const datePart = computed(() => props.modelValue.split('T')[0] ?? '');
const timePart = computed(() => props.modelValue.split('T')[1] ?? '');

const selectedDate = computed(() =>
  datePart.value ? new Date(`${datePart.value}T00:00:00`) : null,
);

const displayValue = computed(() => {
  if (!datePart.value) return '';
  const [y, m, d] = datePart.value.split('-').map(Number);
  const date = new Date(y, m - 1, d).toLocaleDateString('fr-FR');
  return props.time && timePart.value ? `${date} à ${timePart.value}` : date;
});

type CalendarDay = { date: Date; isCurrentMonth: boolean };

const days = computed<CalendarDay[]>(() => {
  const year = currentMonth.value.getFullYear();
  const month = currentMonth.value.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  const result: CalendarDay[] = [];
  for (let i = 0; i < startOffset; i++) {
    result.push({ date: new Date(year, month, -startOffset + i + 1), isCurrentMonth: false });
  }
  for (let day = 1; day <= lastDay.getDate(); day++) {
    result.push({ date: new Date(year, month, day), isCurrentMonth: true });
  }
  for (let day = 1; result.length < DAYS_PER_GRID; day++) {
    result.push({ date: new Date(year, month + 1, day), isCurrentMonth: false });
  }
  return result;
});

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function emitValue(date: string, time: string) {
  emit('update:modelValue', props.time ? `${date}T${time || '00:00'}` : date);
}

function selectDay(day: CalendarDay) {
  emitValue(toISODate(day.date), timePart.value);
  if (!props.time) isOpen.value = false;
}

function updateTime(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  if (datePart.value) emitValue(datePart.value, value);
}

function toggle() {
  if (props.disabled) return;
  if (!isOpen.value && selectedDate.value) currentMonth.value = new Date(selectedDate.value);
  isOpen.value = !isOpen.value;
}

function shiftMonth(delta: number) {
  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() + delta,
    1,
  );
}

const handleClickOutside = (event: MouseEvent) => {
  if (root.value && !root.value.contains(event.target as Node)) isOpen.value = false;
};
onMounted(() => document.addEventListener('mousedown', handleClickOutside));
onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside));
</script>

<template>
  <div
    ref="root"
    class="relative"
  >
    <button
      type="button"
      :disabled="disabled"
      :class="[
        'w-full flex items-center justify-between border border-gray-300 rounded px-2.5 py-1.5 text-sm text-left bg-white transition focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        disabled && 'bg-gray-100 cursor-not-allowed opacity-60',
      ]"
      @click="toggle"
    >
      <span :class="displayValue ? 'text-gray-900' : 'text-gray-400'">
        {{ displayValue || placeholder }}
      </span>
      <svg
        class="w-4 h-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </button>

    <div
      v-if="isOpen"
      class="absolute z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
    >
      <div class="mb-3 flex items-center justify-between">
        <button
          type="button"
          class="rounded p-1 hover:bg-gray-100"
          aria-label="Mois précédent"
          @click="shiftMonth(-1)"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <span class="text-sm font-semibold capitalize">
          {{ currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }}
        </span>
        <button
          type="button"
          class="rounded p-1 hover:bg-gray-100"
          aria-label="Mois suivant"
          @click="shiftMonth(1)"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      <div class="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-400">
        <div
          v-for="label in WEEKDAY_LABELS"
          :key="label"
        >
          {{ label }}
        </div>
      </div>

      <div class="grid grid-cols-7 gap-1">
        <button
          v-for="(day, index) in days"
          :key="index"
          type="button"
          class="h-8 w-8 rounded text-sm transition-colors"
          :class="[
            selectedDate && isSameDay(day.date, selectedDate)
              ? 'bg-blue-600 font-medium text-white hover:bg-blue-700'
              : day.isCurrentMonth
                ? 'text-gray-700 hover:bg-blue-50'
                : 'text-gray-300 hover:bg-gray-50',
          ]"
          @click="selectDay(day)"
        >
          {{ day.date.getDate() }}
        </button>
      </div>

      <div
        v-if="time"
        class="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3"
      >
        <label class="text-sm text-gray-600">Heure</label>
        <input
          type="time"
          :value="timePart"
          :disabled="!datePart"
          class="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          @input="updateTime"
        />
      </div>
    </div>
  </div>
</template>
