/** Minimal CSV writer (RFC 4180): quotes fields with commas, quotes or newlines. */
export function csvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.join(",")];
  for (const r of rows) lines.push(columns.map((c) => csvField(r[c])).join(","));
  // BOM so Excel opens accented names correctly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
