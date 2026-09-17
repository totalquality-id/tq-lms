export type ReportTable = {
  title: string;
  columns: string[];
  rows: (string | number)[][];
};

/**
 * CSV dengan pemisah titik koma dan BOM UTF-8: bentuk yang langsung terbuka
 * rapi di Excel berlokal Indonesia, tanpa langkah impor manual. Pemisah koma
 * akan memecah angka desimal berformat Indonesia ke kolom yang salah.
 */
export function toCsv(table: ReportTable) {
  const escape = (value: string | number) => {
    const text = String(value ?? "");
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    table.columns.map(escape).join(";"),
    ...table.rows.map((row) => row.map(escape).join(";")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}
