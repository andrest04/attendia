import {
  AttentionReportInput,
  ReportMeta,
  buildAttentionReportModel,
  buildReportFilename,
  exportAttentionReport,
  exportAttentionReportPdf,
  exportAttentionReportXlsx,
} from './exportAttentionReport';

const mockPdfSave = jest.fn();
const mockAutoTable = jest.fn();
const mockXlsxWriteFile = jest.fn();
const mockAoaToSheet = jest.fn(() => ({}));
const mockBookAppendSheet = jest.fn();
const mockBookNew = jest.fn(() => ({}));

jest.mock('jspdf', () => ({
  __esModule: true,
  jsPDF: jest.fn().mockImplementation(() => ({
    setFontSize: jest.fn(),
    text: jest.fn(),
    save: mockPdfSave,
    lastAutoTable: { finalY: 40 },
  })),
}));

jest.mock('jspdf-autotable', () => ({
  __esModule: true,
  default: mockAutoTable,
}));

jest.mock('xlsx', () => ({
  __esModule: true,
  writeFile: mockXlsxWriteFile,
  utils: {
    book_new: mockBookNew,
    aoa_to_sheet: mockAoaToSheet,
    book_append_sheet: mockBookAppendSheet,
  },
}));

const fixture: AttentionReportInput = {
  source: 'mock',
  groupAttention: 72,
  attentionThreshold: 60,
  timeline: [
    { time: '10:00', value: 68 },
    { time: '10:05', value: 74 },
  ],
  participants: [
    { identity: 'student-alice', index: 88, level: 'high', multiface: false },
    { identity: 'student-dave', index: 35, level: 'low', multiface: true },
  ],
  proctoringAlerts: [{ id: 'a1', identity: 'student-dave', kind: 'multiface', detectedAt: '10:22', confidence: 0.91 }],
};

// Fixed date so filename assertions are deterministic (Jest runs under TZ=utc).
const meta: ReportMeta = { sessionName: 'Matemáticas — Grupo A', date: new Date('2026-06-02T10:00:00Z') };

beforeEach(() => jest.clearAllMocks());

describe('buildReportFilename', () => {
  const day = new Date('2026-06-02T10:00:00Z');

  it('slugifies the session name and stamps the date', () => {
    expect(buildReportFilename({ sessionName: 'Matemáticas 101', date: day }, 'pdf')).toBe(
      'reporte-atencion-matematicas-101-2026-06-02.pdf'
    );
  });

  it('uses the .xlsx extension for the Excel format', () => {
    expect(buildReportFilename({ sessionName: 'Matemáticas 101', date: day }, 'xlsx')).toBe(
      'reporte-atencion-matematicas-101-2026-06-02.xlsx'
    );
  });

  it('strips accents and collapses separators in the room name', () => {
    expect(buildReportFilename({ sessionName: 'Matemáticas — Grupo A', date: day }, 'pdf')).toBe(
      'reporte-atencion-matematicas-grupo-a-2026-06-02.pdf'
    );
  });

  it('falls back to a stable slug when the session name is blank', () => {
    expect(buildReportFilename({ sessionName: '   ', date: day }, 'pdf')).toBe(
      'reporte-atencion-class-session-2026-06-02.pdf'
    );
  });
});

describe('buildAttentionReportModel', () => {
  it('summarizes the session and flags a mocked source', () => {
    const model = buildAttentionReportModel(fixture);
    expect(model.title).toBe('Reporte de atención');
    expect(model.summary).toContainEqual(['Fuente de datos', 'Datos simulados (pipeline CV pendiente)']);
    expect(model.summary).toContainEqual(['Atención grupal', 72]);
    expect(model.summary).toContainEqual(['Umbral', 60]);
  });

  it('distinguishes a live source', () => {
    const model = buildAttentionReportModel({ ...fixture, source: 'live' });
    expect(model.summary).toContainEqual(['Fuente de datos', 'En vivo']);
  });

  it('builds a students table with Spanish level labels and Sí/No multiface flags', () => {
    const table = buildAttentionReportModel(fixture).tables.find(t => t.title === 'Estudiantes')!;
    expect(table.head).toEqual(['Participante', 'Índice', 'Nivel', 'Múltiples rostros']);
    expect(table.rows).toContainEqual(['student-alice', 88, 'Alto', 'No']);
    expect(table.rows).toContainEqual(['student-dave', 35, 'Bajo', 'Sí']);
  });

  it('builds a timeline table', () => {
    const table = buildAttentionReportModel(fixture).tables.find(t => t.title === 'Evolución temporal')!;
    expect(table.rows).toContainEqual(['10:00', 68]);
    expect(table.rows).toContainEqual(['10:05', 74]);
  });

  it('builds a proctoring table with a localized kind and a percentage confidence', () => {
    const table = buildAttentionReportModel(fixture).tables.find(t => t.title === 'Alertas de proctoring')!;
    expect(table.rows).toContainEqual(['student-dave', 'Múltiples rostros', '10:22', '91%']);
  });
});

describe('exportAttentionReportPdf', () => {
  it('renders one table per section and saves a named .pdf', async () => {
    await exportAttentionReportPdf(fixture, meta);
    expect(mockAutoTable).toHaveBeenCalledTimes(3);
    expect(mockPdfSave).toHaveBeenCalledWith('reporte-atencion-matematicas-grupo-a-2026-06-02.pdf');
  });
});

describe('exportAttentionReportXlsx', () => {
  it('appends one sheet per section (summary + 3 tables) and writes a named .xlsx', async () => {
    await exportAttentionReportXlsx(fixture, meta);
    expect(mockBookAppendSheet).toHaveBeenCalledTimes(4);
    expect(mockXlsxWriteFile).toHaveBeenCalledWith(
      expect.anything(),
      'reporte-atencion-matematicas-grupo-a-2026-06-02.xlsx'
    );
  });
});

describe('exportAttentionReport', () => {
  it('dispatches to the PDF exporter', async () => {
    await exportAttentionReport('pdf', fixture, meta);
    expect(mockPdfSave).toHaveBeenCalledWith('reporte-atencion-matematicas-grupo-a-2026-06-02.pdf');
    expect(mockXlsxWriteFile).not.toHaveBeenCalled();
  });

  it('dispatches to the Excel exporter', async () => {
    await exportAttentionReport('xlsx', fixture, meta);
    expect(mockXlsxWriteFile).toHaveBeenCalledWith(
      expect.anything(),
      'reporte-atencion-matematicas-grupo-a-2026-06-02.xlsx'
    );
    expect(mockPdfSave).not.toHaveBeenCalled();
  });
});
