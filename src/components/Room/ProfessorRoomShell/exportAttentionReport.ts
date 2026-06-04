import { AttentionData } from '../../AttentionProvider/types';
import { levelLabel, proctoringKindLabel } from '../../AttentionProvider/attentionLabels';
import { toClassSessionRoomName } from '../../PreJoinScreens/classSessionTypes';

export type ExportFormat = 'pdf' | 'xlsx' | 'csv';

/**
 * The slice of the attention snapshot needed to render the exportable report.
 * Kept narrow so the shell can pass its already-destructured context fields.
 */
export type AttentionReportInput = Pick<
  AttentionData,
  'source' | 'groupAttention' | 'attentionThreshold' | 'timeline' | 'participants' | 'proctoringAlerts'
>;

/**
 * Report metadata used to name the downloaded file. `date` is injectable so the
 * filename stays deterministic under test (the app passes the current date).
 */
export interface ReportMeta {
  /** Human/room session name; slugified into the filename. */
  sessionName: string;
  /** Export date; defaults to now when omitted. */
  date?: Date;
}

export interface ReportTable {
  title: string;
  head: string[];
  rows: Array<Array<string | number>>;
}

/** Format-agnostic report model; the PDF and Excel exporters both render from this. */
export interface AttentionReportModel {
  title: string;
  summary: Array<[string, string | number]>;
  tables: ReportTable[];
}

const REPORT_TITLE = 'Reporte de atención';
const EXCEL_SHEET_NAME_MAX = 31;

/** Local-time YYYY-MM-DD (tests run under TZ=utc, so the day is stable). */
function formatReportDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Builds a descriptive download filename: `reporte-atencion-{sala}-{YYYY-MM-DD}.{ext}`.
 * The session name is slugified via the shared `toClassSessionRoomName` helper
 * (ASCII kebab, accent-stripped, fallback `class-session`) so it is filesystem-safe.
 */
export function buildReportFilename(meta: ReportMeta, format: ExportFormat): string {
  const slug = toClassSessionRoomName(meta.sessionName);
  const day = formatReportDate(meta.date ?? new Date());
  return `reporte-atencion-${slug}-${day}.${format}`;
}

/**
 * Builds a format-agnostic report model from the current attention snapshot.
 * Pure and deterministic — the data source (mock today, CV pipeline later) is
 * reported in the summary so the export stays honest about its origin.
 */
export function buildAttentionReportModel(data: AttentionReportInput): AttentionReportModel {
  return {
    title: REPORT_TITLE,
    summary: [
      ['Fuente de datos', data.source === 'mock' ? 'Datos simulados (pipeline CV pendiente)' : 'En vivo'],
      ['Atención grupal', data.groupAttention],
      ['Umbral', data.attentionThreshold],
    ],
    tables: [
      {
        title: 'Estudiantes',
        head: ['Participante', 'Índice', 'Nivel', 'Múltiples rostros'],
        rows: data.participants.map(p => [p.identity, p.index, levelLabel[p.level], p.multiface ? 'Sí' : 'No']),
      },
      {
        title: 'Evolución temporal',
        head: ['Hora', 'Atención'],
        rows: data.timeline.map(point => [point.time, point.value]),
      },
      {
        title: 'Alertas de proctoring',
        head: ['Participante', 'Tipo', 'Detectado', 'Confianza'],
        rows: data.proctoringAlerts.map(alert => [
          alert.identity,
          proctoringKindLabel[alert.kind],
          alert.detectedAt,
          `${Math.round(alert.confidence * 100)}%`,
        ]),
      },
    ],
  };
}

/** Generates and downloads the report as a PDF. jsPDF + autotable are loaded on demand. */
export async function exportAttentionReportPdf(data: AttentionReportInput, meta: ReportMeta): Promise<void> {
  const model = buildAttentionReportModel(data);
  const jspdfModule: any = await import('jspdf');
  const JsPdf = jspdfModule.jsPDF || jspdfModule.default;
  const autotableModule: any = await import('jspdf-autotable');
  const autoTable = autotableModule.default || autotableModule.autoTable;

  const doc = new JsPdf();
  doc.setFontSize(16);
  doc.text(model.title, 14, 18);

  doc.setFontSize(10);
  model.summary.forEach((entry, index) => doc.text(`${entry[0]}: ${entry[1]}`, 14, 28 + index * 6));

  let startY = 28 + model.summary.length * 6 + 6;
  model.tables.forEach(table => {
    doc.setFontSize(12);
    doc.text(table.title, 14, startY);
    autoTable(doc, {
      head: [table.head],
      body: table.rows,
      startY: startY + 2,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [2, 122, 197] },
      margin: { left: 14, right: 14 },
    });
    const lastTable = doc.lastAutoTable;
    startY = (lastTable && typeof lastTable.finalY === 'number' ? lastTable.finalY : startY + 40) + 10;
  });

  doc.save(buildReportFilename(meta, 'pdf'));
}

/** Generates and downloads the report as a real .xlsx workbook (one sheet per section). SheetJS is loaded on demand. */
export async function exportAttentionReportXlsx(data: AttentionReportInput, meta: ReportMeta): Promise<void> {
  const model = buildAttentionReportModel(data);
  const XLSX: any = await import('xlsx');

  const workbook = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.aoa_to_sheet([[model.title], [], ...model.summary]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

  model.tables.forEach(table => {
    const sheet = XLSX.utils.aoa_to_sheet([table.head, ...table.rows]);
    XLSX.utils.book_append_sheet(workbook, sheet, table.title.slice(0, EXCEL_SHEET_NAME_MAX));
  });

  XLSX.writeFile(workbook, buildReportFilename(meta, 'xlsx'));
}

/** Generates and downloads the report as a plain CSV (participants table). No dependencies. */
export function exportAttentionReportCsv(data: AttentionReportInput, meta: ReportMeta): Promise<void> {
  const model = buildAttentionReportModel(data);
  // Use the participants table as the primary CSV content; prepend a summary header.
  const escapeCsv = (value: string | number): string => {
    const str = String(value);
    return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines: string[] = [];
  lines.push(model.title);
  model.summary.forEach(entry => lines.push(`${escapeCsv(entry[0])},${escapeCsv(entry[1])}`));
  lines.push('');
  model.tables.forEach(table => {
    lines.push(table.title);
    lines.push(table.head.map(escapeCsv).join(','));
    table.rows.forEach(row => lines.push(row.map(escapeCsv).join(',')));
    lines.push('');
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildReportFilename(meta, 'csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return Promise.resolve();
}

/** Dispatches to the PDF, Excel, or CSV exporter. */
export function exportAttentionReport(
  format: ExportFormat,
  data: AttentionReportInput,
  meta: ReportMeta
): Promise<void> {
  if (format === 'pdf') return exportAttentionReportPdf(data, meta);
  if (format === 'csv') return exportAttentionReportCsv(data, meta);
  return exportAttentionReportXlsx(data, meta);
}
