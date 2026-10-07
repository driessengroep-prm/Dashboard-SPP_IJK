import { ParseFout } from './tabel';

/**
 * Minimal ZIP reader (no dependencies): lists the entries of a ZIP archive and inflates them
 * with the platform's DecompressionStream ('deflate-raw'; browsers and Node 18+). Only what
 * Office files need: stored (0) and deflate (8) entries, no encryption, no ZIP64.
 */
export interface ZipArchief {
  namen: string[];
  lees(naam: string): Promise<Uint8Array | null>;
}

const EOCD = 0x06054b50;
const CENTRAAL = 0x02014b50;
const LOKAAL = 0x04034b50;

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stroom = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stroom).arrayBuffer());
}

export function openZip(invoer: ArrayBuffer | Uint8Array): ZipArchief {
  const bytes = invoer instanceof Uint8Array ? invoer : new Uint8Array(invoer);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fout = () => new ParseFout('Het bestand is geen geldig Excel-bestand.');

  // End of central directory: the last 22+ bytes (a comment may follow)
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (dv.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw fout();
  const aantal = dv.getUint16(eocd + 10, true);
  let pos = dv.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const items = new Map<string, { methode: number; grootte: number; lokaal: number }>();

  for (let n = 0; n < aantal; n++) {
    if (pos + 46 > bytes.length || dv.getUint32(pos, true) !== CENTRAAL) throw fout();
    const methode = dv.getUint16(pos + 10, true);
    const grootte = dv.getUint32(pos + 20, true);
    const naamLen = dv.getUint16(pos + 28, true);
    const extraLen = dv.getUint16(pos + 30, true);
    const commentaarLen = dv.getUint16(pos + 32, true);
    const lokaal = dv.getUint32(pos + 42, true);
    const naam = decoder.decode(bytes.subarray(pos + 46, pos + 46 + naamLen));
    items.set(naam, { methode, grootte, lokaal });
    pos += 46 + naamLen + extraLen + commentaarLen;
  }

  return {
    namen: [...items.keys()],
    async lees(naam) {
      const it = items.get(naam);
      if (!it) return null;
      if (dv.getUint32(it.lokaal, true) !== LOKAAL) throw fout();
      const start = it.lokaal + 30 + dv.getUint16(it.lokaal + 26, true) + dv.getUint16(it.lokaal + 28, true);
      const data = bytes.subarray(start, start + it.grootte);
      if (it.methode === 0) return data;
      if (it.methode === 8) {
        try {
          return await inflate(data);
        } catch {
          throw fout();
        }
      }
      throw new ParseFout('Het bestand gebruikt een niet-ondersteunde compressie.');
    },
  };
}

export const isZip = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  return u.length > 4 && u[0] === 0x50 && u[1] === 0x4b && u[2] === 0x03 && u[3] === 0x04;
};
