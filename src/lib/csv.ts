// RFC 4180-style CSV field escaping. Extracted so the estimates CSV export (EstimatesTab.tsx)
// is unit-testable and so every future CSV export in the app shares one correct
// implementation instead of a bare `.join(",")`.

export function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function csvRow(fields: string[]): string {
  return fields.map(csvField).join(",");
}

export function toCsv(rows: string[][]): string {
  return rows.map(csvRow).join("\r\n");
}
