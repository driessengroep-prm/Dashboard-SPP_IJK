import type { DataSource } from './types';

/**
 * Build mode (VITE_APP_MODE):
 * - demo:   public GitHub Pages demo, bundled fictitious data, only `.example` addresses accepted
 * - lokaal: single offline HTML file for the real exports; no bundled data,
 *           no network access (enforced by CSP), nothing stored
 */
export const APP_MODE: 'demo' | 'lokaal' = import.meta.env.VITE_APP_MODE === 'lokaal' ? 'lokaal' : 'demo';
export const IS_DEMO = APP_MODE === 'demo';
export const IS_LOKAAL = APP_MODE === 'lokaal';

export async function maakDataSource(): Promise<DataSource> {
  const { BrowserDataSource } = await import('./BrowserDataSource');
  if (IS_DEMO) {
    const { laadGebundeldeDemoData } = await import('./gebundeldeDemoData');
    return new BrowserDataSource({ gebundeld: laadGebundeldeDemoData, alleenFictief: true });
  }
  return new BrowserDataSource({ alleenFictief: false });
}
