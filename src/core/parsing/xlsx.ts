import ExcelJS from 'exceljs';
import type { Cel, Tabel } from '../types';
import { ParseFout, vindKoprij } from './tabel';

type Invoer = ArrayBuffer | Uint8Array;

/** Converts an exceljs cell value (rich text, hyperlink, formula, …) to a plain value. */
export function naarCel(v: ExcelJS.CellValue): Cel {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('hyperlink' in v && 'text' in v) {
      const t = (v as { text: unknown }).text;
      if (typeof t === 'string') return t;
      if (t && typeof t === 'object' && 'richText' in t) {
        return (t as ExcelJS.CellRichTextValue).richText.map((x) => x.text).join('');
      }
      return null;
    }
    if ('result' in v) return naarCel((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ('error' in v) return null;
  }
  return null;
}

function werkbladNaarTabel(ws: ExcelJS.Worksheet): Tabel {
  const tabel: Tabel = [];
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const rij: Cel[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      rij[colNumber - 1] = naarCel(cell.value);
    });
    for (let i = 0; i < rij.length; i++) if (rij[i] === undefined) rij[i] = null;
    tabel[rowNumber - 1] = rij;
  });
  for (let i = 0; i < tabel.length; i++) if (!tabel[i]) tabel[i] = [];
  return tabel;
}

export async function laadWerkboek(invoer: Invoer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  try {
    // exceljs accepts an ArrayBuffer in the browser and a Buffer/Uint8Array in Node
    await wb.xlsx.load(invoer as ArrayBuffer);
  } catch {
    throw new ParseFout('Het bestand kon niet als .xlsx worden gelezen.');
  }
  return wb;
}

/**
 * Reads the preferred worksheet. When it does not exist, falls back to the first
 * worksheet that contains the required header cell; with `eersteAlsTerugval` (exports
 * without a header row) to the first worksheet that contains any data.
 */
export async function leesWerkblad(
  invoer: Invoer,
  werkblad: string | null,
  verplichteKop: string | readonly string[],
  opties: { eersteAlsTerugval?: boolean } = {},
): Promise<Tabel> {
  const wb = await laadWerkboek(invoer);
  const voorkeur = werkblad ? wb.getWorksheet(werkblad) : undefined;
  if (voorkeur) return werkbladNaarTabel(voorkeur);
  const tabellen = wb.worksheets.map(werkbladNaarTabel);
  const metKop = tabellen.find((t) => vindKoprij(t, verplichteKop) >= 0);
  if (metKop) return metKop;
  const metData = tabellen.find((t) => t.some((rij) => rij.some((c) => c !== null && c !== '')));
  if (opties.eersteAlsTerugval && metData) return metData;
  throw new ParseFout(
    `Geen werkblad gevonden met een kolom ${typeof verplichteKop === 'string' ? `"${verplichteKop}"` : verplichteKop.map((k) => `"${k}"`).join(' of ')}.`,
  );
}

/** All cells of all worksheets, used by the demo upload guard. */
export async function leesAlleTabellen(invoer: Invoer): Promise<Tabel[]> {
  const wb = await laadWerkboek(invoer);
  return wb.worksheets.map(werkbladNaarTabel);
}
