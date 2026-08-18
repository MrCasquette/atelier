import { treaty } from '@elysiajs/eden';
import type { App } from '@echoppe/api';

import { API_BASE } from './api-base';

export const api = treaty<App>(API_BASE, {
  fetch: {
    credentials: 'include',
  },
});

export type { App };
