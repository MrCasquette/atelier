import { ref } from 'vue';
import { api } from '@/lib/api';
import type { Role, RoleWithPermissions, PermissionFormData, RoleFormData } from './types';

export function useRoles() {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  const roles = ref<Role[]>([]);
  const resources = ref<string[]>([]);
  const loading = ref(true);
  const saving = ref(false);

  // ---------------------------------------------------------------------------
  // API - ROLES
  // ---------------------------------------------------------------------------
  async function loadRoles() {
    loading.value = true;
    const { data } = await api.roles.get();
    if (data) roles.value = data;
    loading.value = false;
  }

  async function loadResources() {
    const { data } = await api.roles.resources.get();
    if (data) resources.value = data.resources;
  }

  async function loadRoleWithPermissions(id: string): Promise<RoleWithPermissions | null> {
    const { data, error } = await api.roles({ id }).get();
    if (error || !data) return null;
    return data as RoleWithPermissions;
  }

  async function createRole(formData: RoleFormData): Promise<Role | null> {
    saving.value = true;
    const { data, error } = await api.roles.post({
      name: formData.name,
      description: formData.description,
      scope: formData.scope,
    });
    saving.value = false;

    if (!error && data) {
      await loadRoles();
      return data;
    }
    return null;
  }

  async function updateRole(id: string, formData: RoleFormData): Promise<boolean> {
    saving.value = true;
    const { error } = await api.roles({ id }).put({
      name: formData.name,
      description: formData.description,
      scope: formData.scope,
    });
    saving.value = false;

    if (!error) {
      await loadRoles();
      return true;
    }
    return false;
  }

  async function deleteRole(id: string): Promise<boolean> {
    const { error } = await api.roles({ id }).delete();
    if (!error) {
      await loadRoles();
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // API - PERMISSIONS
  // ---------------------------------------------------------------------------
  async function updatePermissions(roleId: string, permissions: PermissionFormData[]): Promise<boolean> {
    saving.value = true;
    const { error } = await api.roles({ id: roleId }).permissions.put({
      permissions: permissions.map((p) => ({
        resource: p.resource,
        canCreate: p.canCreate,
        canRead: p.canRead,
        canUpdate: p.canUpdate,
        canDelete: p.canDelete,
        selfOnly: p.selfOnly,
      })),
    });
    saving.value = false;
    return !error;
  }

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------
  return {
    // State
    roles,
    resources,
    loading,
    saving,

    // API - Roles
    loadRoles,
    loadResources,
    loadRoleWithPermissions,
    createRole,
    updateRole,
    deleteRole,

    // API - Permissions
    updatePermissions,
  };
}
