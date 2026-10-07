/** CSV with spreadsheet-formula neutralization: a cell that would start a formula (even after whitespace) is prefixed with '. */
export function neutralizeCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  s = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  if (/^[\s]*[=+\-@]/.test(s) || /^[\t\r]/.test(s)) s = `'${s}`;
  return s;
}
export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map((c) => `"${neutralizeCell(c).replace(/"/g, '""')}"`).join(",")).join("\r\n") + "\r\n";
}
