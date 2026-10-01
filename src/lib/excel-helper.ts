import * as XLSX from 'xlsx';

/**
 * Export arbitrary JSON objects array to Excel (.xlsx) file and trigger instant browser download.
 */
export function exportToExcel(data: Record<string, any>[], sheetName: string, fileName: string): void {
  if (!data || data.length === 0) {
    throw new Error('No data available to export');
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Data');

  // Auto-fit column widths
  const colWidths = Object.keys(data[0] || {}).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...data.map((row) => (row[key] ? String(row[key]).length : 0))
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Parses uploaded Excel or CSV file into typed Javascript objects.
 */
export async function parseExcelFile<T = any>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<T>(worksheet, { defval: '' });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}
