export type PayrollExportRow = Record<string, string | number | boolean | null | undefined>;

function csvCell(value: PayrollExportRow[string]) {
  let text = value == null ? "" : String(value);
  if (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return /[\",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function payrollRowsToCsv(rows: PayrollExportRow[]) {
  if (rows.length === 0) return "";
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return [
    columns.map(csvCell).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n");
}
