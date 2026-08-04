<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { ref, watch, onBeforeUnmount, nextTick } from 'vue';
import Modal from './Modal.vue';
import Button from './Button.vue';
import MediaBrowserModal from '@/components/organisms/MediaBrowserModal.vue';
import { type Media, getMediaUrl } from '@/composables/media';

const props = withDefaults(
  defineProps<{
    content: string;
    placeholder?: string;
    disabled?: boolean;
    minHeight?: string;
    onChange?: (_html: string) => void;
  }>(),
  {
    placeholder: 'Écrivez votre contenu...',
    disabled: false,
    minHeight: '150px',
    onChange: undefined,
  }
);

function createExtensions() {
  return [
    StarterKit.configure({
      heading: {
        levels: [2, 3, 4],
      },
      // Désactiver si inclus dans StarterKit v3
      link: false,
      underline: false,
    }),
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-blue-600 underline',
      },
    }),
    Image.configure({
      HTMLAttributes: {
        class: 'max-w-full h-auto rounded',
      },
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Underline.configure({}),
  ];
}

const editor = useEditor(
  {
    content: props.content,
    editable: !props.disabled,
    extensions: createExtensions(),
    onUpdate: ({ editor }) => {
      props.onChange?.(editor.getHTML());
    },
  },
);

watch(
  () => props.content,
  (value) => {
    if (editor.value && editor.value.getHTML() !== value) {
      editor.value.commands.setContent(value, { emitUpdate: false });
    }
  }
);

watch(
  () => props.disabled,
  (disabled) => {
    editor.value?.setEditable(!disabled);
  }
);

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy();
    editor.value = undefined;
  }
});

// Modal states
const showLinkModal = ref(false);
const showImageModal = ref(false);
const showMediaBrowser = ref(false);
const linkUrl = ref('');
const imageUrl = ref('');
const imageTab = ref<'url' | 'media'>('media');

// HTML mode
const showHtmlMode = ref(false);
const htmlContent = ref('');

function toggleHtmlMode() {
  if (showHtmlMode.value) {
    // Quitter le mode HTML : appliquer les changements
    if (editor.value) {
      editor.value.commands.setContent(htmlContent.value, { emitUpdate: true });
    }
    showHtmlMode.value = false;
  } else {
    // Entrer en mode HTML
    if (editor.value) {
      htmlContent.value = editor.value.getHTML();
    }
    showHtmlMode.value = true;
  }
}

function updateHtmlContent(value: string) {
  htmlContent.value = value;
}

function openLinkModal() {
  if (!editor.value) return;
  linkUrl.value = editor.value.getAttributes('link').href || '';
  showLinkModal.value = true;
  nextTick(() => {
    const input = document.querySelector('[data-link-input]') as HTMLInputElement;
    input?.focus();
  });
}

function closeLinkModal() {
  showLinkModal.value = false;
  linkUrl.value = '';
  editor.value?.chain().focus().run();
}

function confirmLink() {
  if (!editor.value) return;

  if (linkUrl.value === '') {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run();
  } else {
    editor.value.chain().focus().extendMarkRange('link').setLink({ href: linkUrl.value }).run();
  }
  closeLinkModal();
}

function openImageModal() {
  if (!editor.value) return;
  imageUrl.value = '';
  imageTab.value = 'media';
  showImageModal.value = true;
}

function closeImageModal() {
  showImageModal.value = false;
  imageUrl.value = '';
  editor.value?.chain().focus().run();
}

function confirmImageUrl() {
  if (!editor.value || !imageUrl.value) return;
  editor.value.chain().focus().setImage({ src: imageUrl.value }).run();
  closeImageModal();
}

function openMediaBrowser() {
  showImageModal.value = false;
  showMediaBrowser.value = true;
}

function closeMediaBrowser() {
  showMediaBrowser.value = false;
  editor.value?.chain().focus().run();
}

function handleMediaSelect(media: Media) {
  if (!editor.value) return;
  const url = getMediaUrl(media);
  editor.value.chain().focus().setImage({ src: url, alt: media.alt || media.title || '' }).run();
  showMediaBrowser.value = false;
}
</script>

<template>
  <div
    :class="[
      'border border-gray-300 rounded overflow-hidden transition',
      'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent',
      disabled && 'bg-gray-100 opacity-60',
    ]"
  >
    <!-- Toolbar -->
    <div
      v-if="editor && !disabled"
      class="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-gray-200 bg-gray-50"
    >
      <!-- Text formatting -->
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          :class="[
            'p-1.5 rounded hover:bg-gray-200 transition',
            editor.isActive('bold') && 'bg-gray-200 text-blue-600',
          ]"
          title="Gras"
          @click="editor.chain().focus().toggleBold().run()"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"
            />
          </svg>
        </button>
        <button
          type="button"
          :class="[
            'p-1.5 rounded hover:bg-gray-200 transition',
            editor.isActive('italic') && 'bg-gray-200 text-blue-600',
          ]"
          title="Italique"
          @click="editor.chain().focus().toggleItalic().run()"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 4h4m-2 0l-4 16m0 0h4"
            />
          </svg>
        </button>
        <button
          type="button"
          :class="[
            'p-1.5 rounded hover:bg-gray-200 transition',
            editor.isActive('underline') && 'bg-gray-200 text-blue-600',
          ]"
          title="Souligné"
          @click="editor.chain().focus().toggleUnderline().run()"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3M4 21h16"
            />
          </svg>
        </button>
        <button
          type="button"
          :class="[
            'p-1.5 rounded hover:bg-gray-200 transition',
            editor.isActive('strike') && 'bg-gray-200 text-blue-600',
          ]"
          title="Barré"
          @click="editor.chain().focus().toggleStrike().run()"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 12H7m10 0a4 4 0 01-4 4H9a4 4 0 01-4-4m12 0a4 4 0 00-4-4H9a4 4 0 00-4 4"
            />
          </svg>
        </button>
      </div>

      <div class="w-px h-5 bg-gray-300 mx-1" />

      <!-- Headings -->
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          :class="[
            'px-1.5 py-1 rounded hover:bg-gray-200 transition text-xs font-semibold',
            editor.isActive('heading', { level: 2 }) && 'bg-gray-200 text-blue-600',
          ]"
          title="Titre 2"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          H2
        </button>
        <button
          type="button"
          :class="[
            'px-1.5 py-1 rounded hover:bg-gray-200 transition text-xs font-semibold',
            editor.isActive('heading', { level: 3 }) && 'bg-gray-200 text-blue-600',
          ]"
          title="Titre 3"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          H3
        </button>
        <button
          type="button"
          :class="[
            'px-1.5 py-1 rounded hover:bg-gray-200 transition text-xs font-semibold',
            editor.isActive('heading', { level: 4 }) && 'bg-gray-200 text-blue-600',
          ]"
          title="Titre 4"
          @click="editor.chain().focus().toggleHeading({ level: 4 }).run()"
        >
          H4
        </button>
      </div>

      <div class="w-px h-5 bg-gray-300 mx-1" />

      <!-- Lists -->
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          :class="[
            'p-1.5 rounded hover:bg-gray-200 transition',
            editor.isActive('bulletList') && 'bg-gray-200 text-blue-600',
          ]"
          title="Liste à puces"
          @click="editor.chain().focus().toggleBulletList().run()"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
            <circle
              cx="2"
              cy="6"
              r="1"
              fill="currentColor"
            />
            <circle
              cx="2"
              cy="12"
              r="1"
              fill="currentColor"
            />
            <circle
              cx="2"
              cy="18"
              r="1"
              fill="currentColor"
            />
          </svg>
        </button>
        <button
          type="button"
          :class="[
            'p-1.5 rounded hover:bg-gray-200 transition',
            editor.isActive('orderedList') && 'bg-gray-200 text-blue-600',
          ]"
          title="Liste numérotée"
          @click="editor.chain().focus().toggleOrderedList().run()"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 6h13M7 12h13M7 18h13"
            />
            <text
              x="2"
              y="8"
              font-size="6"
              fill="currentColor"
            >1</text>
            <text
              x="2"
              y="14"
              font-size="6"
              fill="currentColor"
            >2</text>
            <text
              x="2"
              y="20"
              font-size="6"
              fill="currentColor"
            >3</text>
          </svg>
        </button>
      </div>

      <div class="w-px h-5 bg-gray-300 mx-1" />

      <!-- Alignment -->
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          :class="[
            'p-1.5 rounded hover:bg-gray-200 transition',
            editor.isActive({ textAlign: 'left' }) && 'bg-gray-200 text-blue-600',
          ]"
          title="Aligner à gauche"
          @click="editor.chain().focus().setTextAlign('left').run()"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h10M4 18h14"
            />
          </svg>
        </button>
        <button
          type="button"
          :class="[
            'p-1.5 rounded hover:bg-gray-200 transition',
            editor.isActive({ textAlign: 'center' }) && 'bg-gray-200 text-blue-600',
          ]"
          title="Centrer"
          @click="editor.chain().focus().setTextAlign('center').run()"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M7 12h10M5 18h14"
            />
          </svg>
        </button>
        <button
          type="button"
          :class="[
            'p-1.5 rounded hover:bg-gray-200 transition',
            editor.isActive({ textAlign: 'right' }) && 'bg-gray-200 text-blue-600',
          ]"
          title="Aligner à droite"
          @click="editor.chain().focus().setTextAlign('right').run()"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M10 12h10M6 18h14"
            />
          </svg>
        </button>
      </div>

      <div class="w-px h-5 bg-gray-300 mx-1" />

      <!-- Block elements -->
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          :class="[
            'p-1.5 rounded hover:bg-gray-200 transition',
            editor.isActive('blockquote') && 'bg-gray-200 text-blue-600',
          ]"
          title="Citation"
          @click="editor.chain().focus().toggleBlockquote().run()"
        >
          <svg
            class="w-4 h-4"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>
        </button>
        <button
          type="button"
          :class="[
            'p-1.5 rounded hover:bg-gray-200 transition',
            editor.isActive('codeBlock') && 'bg-gray-200 text-blue-600',
          ]"
          title="Bloc de code"
          @click="editor.chain().focus().toggleCodeBlock().run()"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
        </button>
        <button
          type="button"
          class="p-1.5 rounded hover:bg-gray-200 transition"
          title="Ligne horizontale"
          @click="editor.chain().focus().setHorizontalRule().run()"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 12h16"
            />
          </svg>
        </button>
      </div>

      <div class="w-px h-5 bg-gray-300 mx-1" />

      <!-- Links & Images -->
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          :class="[
            'p-1.5 rounded hover:bg-gray-200 transition',
            editor.isActive('link') && 'bg-gray-200 text-blue-600',
          ]"
          title="Lien"
          @click="openLinkModal"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </button>
        <button
          type="button"
          class="p-1.5 rounded hover:bg-gray-200 transition"
          title="Image"
          @click="openImageModal"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </button>
      </div>

      <div class="flex-1" />

      <!-- Undo/Redo -->
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          :disabled="!editor.can().undo() || showHtmlMode"
          class="p-1.5 rounded hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
          title="Annuler"
          @click="editor.chain().focus().undo().run()"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
        </button>
        <button
          type="button"
          :disabled="!editor.can().redo() || showHtmlMode"
          class="p-1.5 rounded hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
          title="Rétablir"
          @click="editor.chain().focus().redo().run()"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
            />
          </svg>
        </button>
      </div>

      <div class="w-px h-5 bg-gray-300 mx-1" />

      <!-- HTML Mode Toggle -->
      <button
        type="button"
        :class="[
          'p-1.5 rounded hover:bg-gray-200 transition',
          showHtmlMode && 'bg-gray-200 text-blue-600',
        ]"
        title="Code HTML"
        @click="toggleHtmlMode"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
        </svg>
      </button>
    </div>

    <!-- Editor Content -->
    <EditorContent
      v-if="!showHtmlMode"
      :editor="editor"
      :class="[
        'prose prose-sm max-w-none px-3 py-2',
        disabled && 'cursor-not-allowed',
      ]"
      :style="{ minHeight }"
    />

    <!-- HTML Raw Editor -->
    <textarea
      v-else
      :value="htmlContent"
      class="w-full px-3 py-2 font-mono text-sm bg-gray-900 text-gray-100 resize-none focus:outline-none"
      :style="{ minHeight }"
      spellcheck="false"
      @input="updateHtmlContent(($event.target as HTMLTextAreaElement).value)"
    />

    <!-- Link Modal -->
    <Modal
      v-if="showLinkModal"
      title="Insérer un lien"
      size="sm"
      @close="closeLinkModal"
    >
      <form
        class="space-y-4"
        @submit.prevent="confirmLink"
      >
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">URL</label>
          <input
            v-model="linkUrl"
            type="url"
            data-link-input
            placeholder="https://exemple.com"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <p class="text-xs text-gray-500">
          Laissez vide pour supprimer le lien existant.
        </p>
      </form>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            variant="secondary"
            size="md"
            @click="closeLinkModal"
          >
            Annuler
          </Button>
          <Button
            variant="primary"
            size="md"
            @click="confirmLink"
          >
            Confirmer
          </Button>
        </div>
      </template>
    </Modal>

    <!-- Image Modal -->
    <Modal
      v-if="showImageModal"
      title="Insérer une image"
      size="md"
      @close="closeImageModal"
    >
      <!-- Tabs -->
      <div class="flex border-b border-gray-200 -mx-5 -mt-2 px-5 mb-4">
        <button
          type="button"
          :class="[
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition',
            imageTab === 'media'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          ]"
          @click="imageTab = 'media'"
        >
          Médiathèque
        </button>
        <button
          type="button"
          :class="[
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition',
            imageTab === 'url'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          ]"
          @click="imageTab = 'url'"
        >
          URL externe
        </button>
      </div>

      <!-- Media tab -->
      <div
        v-if="imageTab === 'media'"
        class="text-center py-6"
      >
        <p class="text-gray-600 mb-4">
          Sélectionnez une image depuis votre médiathèque
        </p>
        <Button
          variant="primary"
          @click="openMediaBrowser"
        >
          Ouvrir la médiathèque
        </Button>
      </div>

      <!-- URL tab -->
      <form
        v-else
        class="space-y-4"
        @submit.prevent="confirmImageUrl"
      >
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">URL de l'image</label>
          <input
            v-model="imageUrl"
            type="url"
            data-image-input
            placeholder="https://exemple.com/image.jpg"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            size="md"
            @click="closeImageModal"
          >
            Annuler
          </Button>
          <Button
            variant="primary"
            size="md"
            :disabled="!imageUrl"
            @click="confirmImageUrl"
          >
            Insérer
          </Button>
        </div>
      </form>
    </Modal>

    <!-- Media Browser Modal -->
    <MediaBrowserModal
      v-if="showMediaBrowser"
      title="Sélectionner une image"
      accept="images"
      :on-select="handleMediaSelect"
      :on-close="closeMediaBrowser"
    />
  </div>
</template>

<style>
/* Placeholder styling */
.tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}

/* Focus outline on editor */
.tiptap:focus {
  outline: none;
}

/* Prose overrides for editor */
.tiptap {
  min-height: inherit;
}

.tiptap > * + * {
  margin-top: 0.75em;
}

.tiptap ul,
.tiptap ol {
  padding-left: 1.5rem;
}

.tiptap ul {
  list-style-type: disc;
}

.tiptap ol {
  list-style-type: decimal;
}

.tiptap h2 {
  font-size: 1.5em;
  font-weight: 700;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.tiptap h3 {
  font-size: 1.25em;
  font-weight: 600;
  margin-top: 0.75em;
  margin-bottom: 0.5em;
}

.tiptap h4 {
  font-size: 1.1em;
  font-weight: 600;
  margin-top: 0.5em;
  margin-bottom: 0.25em;
}

.tiptap blockquote {
  border-left: 3px solid #d1d5db;
  padding-left: 1rem;
  font-style: italic;
  color: #6b7280;
}

.tiptap pre {
  background: #1f2937;
  color: #f3f4f6;
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  overflow-x: auto;
}

.tiptap code {
  background: #f3f4f6;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
}

.tiptap pre code {
  background: none;
  padding: 0;
}

.tiptap hr {
  border: none;
  border-top: 2px solid #e5e7eb;
  margin: 1.5rem 0;
}

.tiptap img {
  max-width: 100%;
  height: auto;
  border-radius: 0.375rem;
}
</style>
