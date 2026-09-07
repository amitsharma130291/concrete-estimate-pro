// RFC 4180-style CSV field escaping, shared by every CSV export in the app (current-estimate
// export, catalog export) so there is exactly one correct implementation instead of several
// bare `.join(",")`s with inconsistent edge-case handling.

/** A field is quoted and prefixed with `'` when it begins with one of these characters --
 * standard CSV/formula-injection mitigation (OWASP): a value starting with =, +, -, @, a
 * tab, or a carriage return can otherwise be interpreted as a formula by Excel/Sheets/
 * LibreOffice when the file is opened, e.g. a customer name of `=cmd|'/c calc'!A1`. */
const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function neutralizeFormulaInjection(value: string): string {
  if (value.length > 0 && FORMULA_TRIGGER_CHARS.has(value[0])) {
    return `'${value}`;
  }
  return value;
}

export function csvField(value: string): string {
  const safe = neutralizeFormulaInjection(value);
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function csvRow(fields: string[]): string {
  return fields.map(csvField).join(",");
}

export function toCsv(rows: string[][]): string {
  return rows.map(csvRow).join("\r\n");
}

/** UTF-8 BOM so Excel (Windows in particular) reliably detects the file as UTF-8 instead of
 * guessing a legacy codepage and mangling non-ASCII customer names. */
export const CSV_UTF8_BOM = "﻿";

export function downloadCsv(filename: string, rows: string[][]): void {
  const blob = new Blob([CSV_UTF8_BOM + toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
