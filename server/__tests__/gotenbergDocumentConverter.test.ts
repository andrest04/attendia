import { createGotenbergDocumentConverter } from '../gotenbergDocumentConverter';

describe('createGotenbergDocumentConverter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
    jest.restoreAllMocks();
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
      signal: expect.any(AbortSignal),
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
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 502 })) as any;

    await expect(
      createGotenbergDocumentConverter('http://localhost:3010', 0).convertToPdf(Buffer.from('x'), 'guia.docx')
    ).rejects.toThrow('Gotenberg conversion failed with status 502');
  });

  it('retries a temporary sidecar connection failure and logs the retry', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:3000'))
      .mockResolvedValueOnce({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
    const warnMock = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    global.fetch = fetchMock as any;

    await expect(
      createGotenbergDocumentConverter('http://localhost:3000', 0).convertToPdf(Buffer.from('x'), 'guia.docx')
    ).resolves.toEqual(Buffer.alloc(0));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warnMock).toHaveBeenCalledWith(
      'Gotenberg connection failed; retrying preview (1/5)',
      expect.any(Error)
    );
  });

  it('retries a 503 while the sidecar starts but does not retry permanent conversion errors', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
    global.fetch = fetchMock as any;

    await expect(
      createGotenbergDocumentConverter('http://localhost:3000', 0).convertToPdf(Buffer.from('x'), 'guia.docx')
    ).resolves.toEqual(Buffer.alloc(0));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 400 })) as any;
    await expect(
      createGotenbergDocumentConverter('http://localhost:3000', 0).convertToPdf(Buffer.from('x'), 'guia.docx')
    ).rejects.toThrow('Gotenberg conversion failed with status 400');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('aborts a hung attempt after the per-attempt timeout and retries it like a connection failure', async () => {
    const warnMock = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const hang = (_url: string, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(hang)
      .mockResolvedValueOnce({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
    global.fetch = fetchMock as any;

    await expect(
      createGotenbergDocumentConverter('http://localhost:3000', 0, 20).convertToPdf(Buffer.from('x'), 'guia.docx')
    ).resolves.toEqual(Buffer.alloc(0));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warnMock).toHaveBeenCalledWith('Gotenberg connection failed; retrying preview (1/5)', expect.anything());
  });

  it('gives up with the timeout error once every attempt hangs', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    global.fetch = fetchMock as any;

    await expect(
      createGotenbergDocumentConverter('http://localhost:3000', 0, 10).convertToPdf(Buffer.from('x'), 'guia.docx')
    ).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(fetchMock).toHaveBeenCalledTimes(5);
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
