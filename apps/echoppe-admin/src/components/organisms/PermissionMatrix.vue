<script setup lang="ts">
import { computed } from 'vue';
import {
  RESOURCE_GROUPS,
  RESOURCE_LABELS,
  type PermissionFormData,
} from '@/composables/roles';

const props = defineProps<{
  permissions: PermissionFormData[];
  readonly?: boolean;
  showSelfOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:permissions', permissions: PermissionFormData[]): void;
}>();

// Transformer en Map pour acces rapide
const permissionMap = computed(() => {
  const map = new Map<string, PermissionFormData>();
  for (const p of props.permissions) {
    map.set(p.resource, p);
  }
  return map;
});

function getPermission(resource: string): PermissionFormData {
  return (
    permissionMap.value.get(resource) || {
      resource,
      canCreate: false,
      canRead: false,
      canUpdate: false,
      canDelete: false,
      selfOnly: false,
      locked: false,
    }
  );
}

function isLocked(resource: string): boolean {
  return getPermission(resource).locked;
}

function togglePermission(resource: string, action: keyof PermissionFormData) {
  if (props.readonly || isLocked(resource)) return;
  if (action === 'resource' || action === 'locked') return;

  const current = getPermission(resource);
  const updated: PermissionFormData = {
    ...current,
    resource,
    [action]: !current[action],
  };

  const newPermissions = props.permissions.filter((p) => p.resource !== resource);

  // N'ajouter que si au moins une permission est true
  if (updated.canCreate || updated.canRead || updated.canUpdate || updated.canDelete) {
    newPermissions.push(updated);
  }

  emit('update:permissions', newPermissions);
}

function toggleAll(resource: string, value: boolean) {
  if (props.readonly || isLocked(resource)) return;

  const newPermissions = props.permissions.filter((p) => p.resource !== resource);

  if (value) {
    newPermissions.push({
      resource,
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: true,
      selfOnly: getPermission(resource).selfOnly,
      locked: false,
    });
  }

  emit('update:permissions', newPermissions);
}

function hasAllPermissions(resource: string): boolean {
  const p = getPermission(resource);
  return p.canCreate && p.canRead && p.canUpdate && p.canDelete;
}
</script>

<template>
  <div class="space-y-6">
    <div
      v-for="group in RESOURCE_GROUPS"
      :key="group.name"
      class="bg-white rounded-lg shadow p-4"
    >
      <h3 class="text-lg font-semibold text-gray-900 mb-4">
        {{ group.name }}
      </h3>

      <div class="overflow-x-auto">
        <table class="min-w-full">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-2 px-3 text-sm font-medium text-gray-500">
                Ressource
              </th>
              <th class="text-center py-2 px-3 text-sm font-medium text-gray-500 w-16">
                Tout
              </th>
              <th class="text-center py-2 px-3 text-sm font-medium text-gray-500 w-16">
                Creer
              </th>
              <th class="text-center py-2 px-3 text-sm font-medium text-gray-500 w-16">
                Lire
              </th>
              <th class="text-center py-2 px-3 text-sm font-medium text-gray-500 w-16">
                Modifier
              </th>
              <th class="text-center py-2 px-3 text-sm font-medium text-gray-500 w-16">
                Supprimer
              </th>
              <th
                v-if="showSelfOnly"
                class="text-center py-2 px-3 text-sm font-medium text-gray-500 w-20"
              >
                Self only
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="resource in group.resources"
              :key="resource"
              class="border-b border-gray-100"
              :class="isLocked(resource) ? 'bg-gray-50' : 'hover:bg-gray-50'"
            >
              <td class="py-2 px-3 text-sm text-gray-900 flex items-center gap-2">
                {{ RESOURCE_LABELS[resource] || resource }}
                <svg
                  v-if="isLocked(resource)"
                  class="w-3.5 h-3.5 text-gray-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </td>

              <!-- Locked: affichage statique -->
              <template v-if="isLocked(resource)">
                <td class="py-2 px-3 text-center">
                  <span
                    v-if="hasAllPermissions(resource)"
                    class="text-green-600"
                  >
                    <svg
                      class="w-4 h-4 mx-auto"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </span>
                  <span
                    v-else
                    class="text-gray-300"
                  >-</span>
                </td>
                <td class="py-2 px-3 text-center">
                  <span
                    v-if="getPermission(resource).canCreate"
                    class="text-green-600"
                  >
                    <svg
                      class="w-4 h-4 mx-auto"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </span>
                  <span
                    v-else
                    class="text-gray-300"
                  >-</span>
                </td>
                <td class="py-2 px-3 text-center">
                  <span
                    v-if="getPermission(resource).canRead"
                    class="text-green-600"
                  >
                    <svg
                      class="w-4 h-4 mx-auto"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </span>
                  <span
                    v-else
                    class="text-gray-300"
                  >-</span>
                </td>
                <td class="py-2 px-3 text-center">
                  <span
                    v-if="getPermission(resource).canUpdate"
                    class="text-green-600"
                  >
                    <svg
                      class="w-4 h-4 mx-auto"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </span>
                  <span
                    v-else
                    class="text-gray-300"
                  >-</span>
                </td>
                <td class="py-2 px-3 text-center">
                  <span
                    v-if="getPermission(resource).canDelete"
                    class="text-green-600"
                  >
                    <svg
                      class="w-4 h-4 mx-auto"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </span>
                  <span
                    v-else
                    class="text-gray-300"
                  >-</span>
                </td>
                <td
                  v-if="showSelfOnly"
                  class="py-2 px-3 text-center"
                >
                  <span
                    v-if="getPermission(resource).selfOnly"
                    class="text-green-600"
                  >
                    <svg
                      class="w-4 h-4 mx-auto"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </span>
                  <span
                    v-else
                    class="text-gray-300"
                  >-</span>
                </td>
              </template>

              <!-- Non locked: checkboxes editables -->
              <template v-else>
                <td class="py-2 px-3 text-center">
                  <input
                    type="checkbox"
                    :checked="hasAllPermissions(resource)"
                    :disabled="readonly"
                    class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                    @change="toggleAll(resource, ($event.target as HTMLInputElement).checked)"
                  />
                </td>
                <td class="py-2 px-3 text-center">
                  <input
                    type="checkbox"
                    :checked="getPermission(resource).canCreate"
                    :disabled="readonly"
                    class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                    @change="togglePermission(resource, 'canCreate')"
                  />
                </td>
                <td class="py-2 px-3 text-center">
                  <input
                    type="checkbox"
                    :checked="getPermission(resource).canRead"
                    :disabled="readonly"
                    class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                    @change="togglePermission(resource, 'canRead')"
                  />
                </td>
                <td class="py-2 px-3 text-center">
                  <input
                    type="checkbox"
                    :checked="getPermission(resource).canUpdate"
                    :disabled="readonly"
                    class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                    @change="togglePermission(resource, 'canUpdate')"
                  />
                </td>
                <td class="py-2 px-3 text-center">
                  <input
                    type="checkbox"
                    :checked="getPermission(resource).canDelete"
                    :disabled="readonly"
                    class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                    @change="togglePermission(resource, 'canDelete')"
                  />
                </td>
                <td
                  v-if="showSelfOnly"
                  class="py-2 px-3 text-center"
                >
                  <input
                    type="checkbox"
                    :checked="getPermission(resource).selfOnly"
                    :disabled="readonly"
                    class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                    @change="togglePermission(resource, 'selfOnly')"
                  />
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
