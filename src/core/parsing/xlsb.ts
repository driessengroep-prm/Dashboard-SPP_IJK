import type { Cel, Tabel } from '../types';
import { ParseFout } from './tabel';
import type { ZipArchief } from './zip';

/**
 * Reader for Excel Binary Workbooks (.xlsb, MS-XLSB / BIFF12), no dependencies.
 * Reads only cell values (text, numbers, booleans; formula results), which is all the
 * dashboard needs. Formatting, dates-as-dates and rich text runs are ignored.
 */

// Record types (MS-XLSB 2.3.2)
const BRT_ROW_HDR = 0;
const BRT_CELL_BLANK = 1;
const BRT_CELL_RK = 2;
const BRT_CELL_ERROR = 3;
const BRT_CELL_BOOL = 4;
const BRT_CELL_REAL = 5;
const BRT_CELL_ST = 6;
const BRT_CELL_ISST = 7;
const BRT_FMLA_STRING = 8;
const BRT_FMLA_NUM = 9;
const BRT_FMLA_BOOL = 10;
const BRT_FMLA_ERROR = 11;
// "Short" cell records (12–18) omit the column: it is the previous cell's column + 1
const BRT_SHORT_BLANK = 12;
const BRT_SHORT_ISST = 18;
/** Short record type → the regular cell record type with the same value layout. */
const KORT_NAAR_GEWOON: Record<number, number> = { 12: 1, 13: 2, 14: 3, 15: 4, 16: 5, 17: 6, 18: 7 };
const BRT_SST_ITEM = 19;
const BRT_BUNDLE_SH = 156;

interface BiffRecord {
  type: number;
  data: DataView;
}

/** Splits a BIFF12 stream into records (type and size are 7-bit variable-length integers). */
function* records(bytes: Uint8Array): Generator<BiffRecord> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 0;
  while (p < bytes.length) {
    let type = 0;
    for (let i = 0; i < 2; i++) {
      const b = bytes[p++];
      type |= (b & 0x7f) << (7 * i);
      if (!(b & 0x80)) break;
    }
    let grootte = 0;
    for (let i = 0; i < 4; i++) {
      const b = bytes[p++];
      grootte |= (b & 0x7f) << (7 * i);
      if (!(b & 0x80)) break;
    }
    if (p + grootte > bytes.length) throw new ParseFout('Het .xlsb-bestand is beschadigd.');
    yield { type, data: new DataView(dv.buffer, dv.byteOffset + p, grootte) };
    p += grootte;
  }
}

const utf16 = new TextDecoder('utf-16le');

/** XLWideString: 4-byte character count followed by UTF-16LE characters. Returns the string and bytes used. */
function wideString(dv: DataView, offset: number): [string, number] {
  const n = dv.getUint32(offset, true);
  if (n === 0xffffffff) return ['', 4];
  const start = dv.byteOffset + offset + 4;
  return [utf16.decode(new Uint8Array(dv.buffer, start, n * 2)), 4 + n * 2];
}

/** RkNumber: 30-bit integer or the high 30 bits of a double, optionally divided by 100. */
export function rk(waarde: number): number {
  const x100 = waarde & 1;
  const isInt = waarde & 2;
  let n: number;
  if (isInt) {
    n = waarde >> 2;
  } else {
    const b = new DataView(new ArrayBuffer(8));
    b.setUint32(4, waarde & 0xfffffffc, true);
    n = b.getFloat64(0, true);
  }
  return x100 ? n / 100 : n;
}

function leesWerkblad(bytes: Uint8Array, sst: string[]): Tabel {
  const tabel: Tabel = [];
  let rij = 0;
  let vorigeKolom = -1;
  for (const rec of records(bytes)) {
    if (rec.type === BRT_ROW_HDR) {
      rij = rec.data.getUint32(0, true);
      vorigeKolom = -1;
      continue;
    }
    const kort = rec.type >= BRT_SHORT_BLANK && rec.type <= BRT_SHORT_ISST;
    if (!kort && (rec.type < BRT_CELL_BLANK || rec.type > BRT_FMLA_ERROR)) continue;
    const type = kort ? KORT_NAAR_GEWOON[rec.type] : rec.type;
    // Regular cells: column (4) + style (3) + flags (1); short cells: style + flags only
    const kolom = kort ? vorigeKolom + 1 : rec.data.getUint32(0, true);
    vorigeKolom = kolom;
    const data = rec.data;
    const o = kort ? 4 : 8; // offset of the value
    let waarde: Cel = null;
    switch (type) {
      case BRT_CELL_RK:
        waarde = rk(data.getInt32(o, true));
        break;
      case BRT_CELL_BOOL:
      case BRT_FMLA_BOOL:
        waarde = data.getUint8(o) !== 0;
        break;
      case BRT_CELL_REAL:
      case BRT_FMLA_NUM:
        waarde = data.getFloat64(o, true);
        break;
      case BRT_CELL_ST:
      case BRT_FMLA_STRING:
        waarde = wideString(data, o)[0];
        break;
      case BRT_CELL_ISST:
        waarde = sst[data.getUint32(o, true)] ?? null;
        break;
      case BRT_CELL_BLANK:
      case BRT_CELL_ERROR:
      case BRT_FMLA_ERROR:
        waarde = null;
    }
    const r = (tabel[rij] ??= []);
    r[kolom] = waarde;
  }
  for (let i = 0; i < tabel.length; i++) {
    const r = (tabel[i] ??= []);
    for (let k = 0; k < r.length; k++) if (r[k] === undefined) r[k] = null;
  }
  return tabel;
}

function leesSharedStrings(bytes: Uint8Array | null): string[] {
  const sst: string[] = [];
  if (!bytes) return sst;
  for (const { type, data } of records(bytes)) {
    // RichStr: 1 byte flags, then XLWideString (rich-text runs and phonetics follow and are ignored)
    if (type === BRT_SST_ITEM) sst.push(wideString(data, 1)[0]);
  }
  return sst;
}

/** Worksheet targets by relationship id, from xl/_rels/workbook.bin.rels. */
function relaties(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const doel = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && doel) map.set(id, doel.startsWith('/') ? doel.slice(1) : `xl/${doel}`);
  }
  return map;
}

export const isXlsb = (zip: ZipArchief) => zip.namen.includes('xl/workbook.bin');

/** All worksheets of an .xlsb workbook, in workbook order. */
export async function leesXlsb(zip: ZipArchief): Promise<{ naam: string; tabel: Tabel }[]> {
  try {
    const [werkboek, rels, sstBytes] = await Promise.all([
      zip.lees('xl/workbook.bin'),
      zip.lees('xl/_rels/workbook.bin.rels'),
      zip.lees('xl/sharedStrings.bin'),
    ]);
    if (!werkboek || !rels) throw new ParseFout('Het .xlsb-bestand is onvolledig.');
    const doelen = relaties(new TextDecoder().decode(rels));
    const sst = leesSharedStrings(sstBytes);
    const bladen: { naam: string; pad: string }[] = [];
    for (const { type, data } of records(werkboek)) {
      if (type !== BRT_BUNDLE_SH) continue;
      // BrtBundleSh: hsState (4), iTabID (4), strRelID (XLNullableWideString), strName (XLWideString)
      const [relId, n] = wideString(data, 8);
      const [naam] = wideString(data, 8 + n);
      const pad = doelen.get(relId);
      if (pad) bladen.push({ naam, pad });
    }
    const uit: { naam: string; tabel: Tabel }[] = [];
    for (const b of bladen) {
      const bytes = await zip.lees(b.pad);
      if (bytes) uit.push({ naam: b.naam, tabel: leesWerkblad(bytes, sst) });
    }
    return uit;
  } catch (e) {
    if (e instanceof ParseFout) throw e;
    throw new ParseFout('Het bestand kon niet als .xlsb worden gelezen.');
  }
}
