import type { RouteObject } from 'react-router'

/**
 * 客製化新增的路由，會被展開進上游的 appRoutes（掛鉤點 T4）。
 *
 * 注意：上游的「Start Page」選單是從 @shared/types 的 PAGES 常數產生的，
 * 這裡新增的路由不會自動出現在那個選單裡。若某個新頁面要能被設為起始頁，
 * 屆時得另外評估，不在骨架階段處理。
 */
export const customRoutes: RouteObject[] = []
