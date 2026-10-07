import sppUrl from '../../testdata/fictief/SPP_export_IJK_20261001.xlsx?url';
import hrUrl from '../../testdata/fictief/Lijst_FvB_20261001.xlsx?url';

/**
 * Loads the bundled fictitious exports (static assets of the demo build).
 * Only imported in demo mode, so the local build never contains the demo data.
 */
export async function laadGebundeldeDemoData(): Promise<{ spp: ArrayBuffer; hr: ArrayBuffer }> {
  const [spp, hr] = await Promise.all([fetch(sppUrl), fetch(hrUrl)].map(async (p) => (await p).arrayBuffer()));
  return { spp, hr };
}
