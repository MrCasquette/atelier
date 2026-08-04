import { ref, computed } from 'vue';
import { api } from '@/lib/api';
import type { ApiData } from '@/types/api';

// Types inférés depuis Eden
type MeResponse = ApiData<ReturnType<typeof api.auth.me.get>>;
type User = MeResponse['user'];
type Role = MeResponse['role'];

interface AuthState {
  user: User | null;
  role: Role | null;
  loading: boolean;
  error: string | null;
}

const state = ref<AuthState>({
  user: null,
  role: null,
  loading: true,
  error: null,
});

export function useAuth() {
  const isAuthenticated = computed(() => !!state.value.user);
  const isOwner = computed(() => state.value.user?.isOwner ?? false);

  async function checkAuth(): Promise<boolean> {
    state.value.loading = true;
    state.value.error = null;

    try {
      const { data, error } = await api.auth.me.get();

      if (error) {
        state.value.user = null;
        state.value.role = null;
        return false;
      }

      state.value.user = data.user;
      state.value.role = data.role;
      return true;
    } catch {
      state.value.user = null;
      state.value.role = null;
      return false;
    } finally {
      state.value.loading = false;
    }
  }

  async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    state.value.loading = true;
    state.value.error = null;

    try {
      const { error } = await api.auth.login.post({ email, password });

      if (error) {
        const errorMessage = typeof error.value === 'object' && error.value && 'message' in error.value
          ? String(error.value.message)
          : 'Erreur de connexion';
        state.value.error = errorMessage;
        return { success: false, error: errorMessage };
      }

      // Fetch full user data after login
      await checkAuth();
      return { success: true };
    } catch {
      const errorMessage = 'Erreur de connexion';
      state.value.error = errorMessage;
      return { success: false, error: errorMessage };
    } finally {
      state.value.loading = false;
    }
  }

  async function logout(): Promise<void> {
    try {
      await api.auth.logout.post();
    } finally {
      state.value.user = null;
      state.value.role = null;
      state.value.error = null;
    }
  }

  return {
    user: computed(() => state.value.user),
    role: computed(() => state.value.role),
    loading: computed(() => state.value.loading),
    error: computed(() => state.value.error),
    isAuthenticated,
    isOwner,
    checkAuth,
    login,
    logout,
  };
}
