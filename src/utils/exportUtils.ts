import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Message } from '../types';

export async function exportTableToExcel(message: Message): Promise<string | null> {
  const tables = parseTablesFromMarkdown(message.content);
  if (tables.length === 0) return null;

  const wb = XLSX.utils.book_new();
  tables.forEach((table, i) => {
    const ws = XLSX.utils.aoa_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, `Table ${i + 1}`);
  });

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  saveAs(blob, 'table-export.xlsx');
  return url;
}

export function revokeExcelUrl(url: string): void {
  URL.revokeObjectURL(url);
}

export function parseTablesFromMarkdown(text: string): string[][][] {
  const tables: string[][][] = [];
  const lines = text.split('\n');
  let currentTable: string[][] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(cell => cell.trim());

      if (cells.every(cell => /^[-:]+$/.test(cell))) {
        continue;
      }

      currentTable.push(cells);
      inTable = true;
    } else {
      if (inTable && currentTable.length > 0) {
        tables.push(currentTable);
        currentTable = [];
      }
      inTable = false;
    }
  }

  if (inTable && currentTable.length > 0) {
    tables.push(currentTable);
  }

  return tables;
}
