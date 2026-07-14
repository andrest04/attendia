import { createGotenbergDocumentConverter } from '../gotenbergDocumentConverter';

describe('createGotenbergDocumentConverter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('posts the buffer as a multipart file to the LibreOffice route and returns the PDF bytes', async () => {
    const responseBytes = Buffer.from('pdf-bytes');
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(responseBytes.buffer.slice(responseBytes.byteOffset, responseBytes.byteOffset + responseBytes.byteLength)),
      })
    );
    global.fetch = fetchMock as any;

    const converter = createGotenbergDocumentConverter('http://localhost:3010');
    const input = Buffer.from('office-bytes');

    const result = await converter.convertToPdf(input, 'derivadas.pptx');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3010/forms/libreoffice/convert', {
      method: 'POST',
      body: expect.any(FormData),
    });
    expect(result).toEqual(responseBytes);
  });

  it('strips a trailing slash from the configured base URL', async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) })
    );
    global.fetch = fetchMock as any;

    await createGotenbergDocumentConverter('http://localhost:3010/').convertToPdf(Buffer.from('x'), 'guia.docx');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3010/forms/libreoffice/convert', expect.any(Object));
  });

  it('rejects when Gotenberg returns a non-OK status', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 502 })) as any;

    await expect(
      createGotenbergDocumentConverter('http://localhost:3010').convertToPdf(Buffer.from('x'), 'guia.docx')
    ).rejects.toThrow('Gotenberg conversion failed with status 502');
  });

  it('rejects without calling fetch when GOTENBERG_URL is not configured', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    await expect(createGotenbergDocumentConverter(undefined).convertToPdf(Buffer.from('x'), 'guia.docx')).rejects.toThrow(
      'GOTENBERG_URL is not configured'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
