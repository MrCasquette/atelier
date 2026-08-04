import { ref, computed, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface UsePaginationOptions {
  defaultLimit?: number;
  syncWithUrl?: boolean;
}

export function usePagination<T>(
  fetchFn: (_page: number, _limit: number) => Promise<PaginatedResponse<T>>,
  options: UsePaginationOptions = {}
) {
  const { defaultLimit = 20, syncWithUrl = true } = options;

  const route = useRoute();
  const router = useRouter();

  const data: Ref<T[]> = ref([]);
  const meta: Ref<PaginationMeta> = ref({
    total: 0,
    page: 1,
    limit: defaultLimit,
    totalPages: 0,
  });
  const loading = ref(false);
  const error: Ref<string | null> = ref(null);

  const page = computed({
    get: () => meta.value.page,
    set: (value: number) => {
      meta.value.page = value;
      if (syncWithUrl) {
        router.replace({
          query: { ...route.query, page: value > 1 ? String(value) : undefined },
        });
      }
      fetch();
    },
  });

  async function fetch() {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetchFn(meta.value.page, meta.value.limit);
      data.value = response.data;
      meta.value = response.meta;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors du chargement';
      data.value = [];
    } finally {
      loading.value = false;
    }
  }

  function setPage(newPage: number) {
    page.value = newPage;
  }

  function refresh() {
    return fetch();
  }

  // Init from URL if syncWithUrl is enabled
  if (syncWithUrl && route.query.page) {
    const urlPage = parseInt(route.query.page as string, 10);
    if (!isNaN(urlPage) && urlPage > 0) {
      meta.value.page = urlPage;
    }
  }

  return {
    data,
    meta,
    page,
    loading,
    error,
    fetch,
    refresh,
    setPage,
  };
}
