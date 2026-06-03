import { AttentionData, AttentionLevel, ProctoringAlert } from '../../AttentionProvider/types';

export type ExportFormat = 'pdf' | 'xlsx';

/**
 * The slice of the attention snapshot needed to render the exportable report.
 * Kept narrow so the shell can pass its already-destructured context fields.
 */
export type AttentionReportInput = Pick<
  AttentionData,
  'source' | 'groupAttention' | 'attentionThreshold' | 'timeline' | 'participants' | 'proctoringAlerts'
>;

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

const levelLabel: Record<AttentionLevel, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const proctoringKindLabel: Record<ProctoringAlert['kind'], string> = {
  multiface: 'Múltiples rostros',
  absent: 'Sin presencia',
  away: 'Ausente',
};

const REPORT_TITLE = 'Reporte de atención';
const PDF_FILENAME = 'reporte-atencion.pdf';
const XLSX_FILENAME = 'reporte-atencion.xlsx';
const EXCEL_SHEET_NAME_MAX = 31;

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
export async function exportAttentionReportPdf(data: AttentionReportInput): Promise<void> {
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

  doc.save(PDF_FILENAME);
}

/** Generates and downloads the report as a real .xlsx workbook (one sheet per section). SheetJS is loaded on demand. */
export async function exportAttentionReportXlsx(data: AttentionReportInput): Promise<void> {
  const model = buildAttentionReportModel(data);
  const XLSX: any = await import('xlsx');

  const workbook = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.aoa_to_sheet([[model.title], [], ...model.summary]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

  model.tables.forEach(table => {
    const sheet = XLSX.utils.aoa_to_sheet([table.head, ...table.rows]);
    XLSX.utils.book_append_sheet(workbook, sheet, table.title.slice(0, EXCEL_SHEET_NAME_MAX));
  });

  XLSX.writeFile(workbook, XLSX_FILENAME);
}

/** Dispatches to the PDF or Excel exporter. */
export function exportAttentionReport(format: ExportFormat, data: AttentionReportInput): Promise<void> {
  return format === 'pdf' ? exportAttentionReportPdf(data) : exportAttentionReportXlsx(data);
}
