// Types menu dérivés du contrat Eden. Le shape stocké (MenuItem récursif) est attaché côté API via
// `t.Unsafe<MenuItem[]>` → Eden expose la vraie récursion (`children: MenuItem[]`).
import type { api } from '@/lib/api';
import type { ApiData, ApiItem } from '@/types/api';

export type MenuListItem = ApiItem<ReturnType<typeof api.content.menus.get>>;
export type MenuDetail = ApiData<ReturnType<typeof api.content.menus.post>>;
export type MenuItem = MenuDetail['items'][number];
export type MenuLink = MenuItem['link'];
export type MenuLinkTarget = MenuLink['target'];
