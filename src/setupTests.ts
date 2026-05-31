import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import 'isomorphic-fetch';

configure({ adapter: new Adapter() });

// Mocks the Fullscreen API. This is needed for ToggleFullScreenButton.test.tsx.
Object.defineProperty(document, 'fullscreenEnabled', { value: true, writable: true });

class LocalStorage {
  store = {} as { [key: string]: string };

  getItem(key: string) {
    return this.store[key] ? this.store[key] : null;
  }

  setItem(key: string, value: string) {
    this.store[key] = value;
  }

  clear() {
    this.store = {} as { [key: string]: string };
  }
}

Object.defineProperty(window, 'localStorage', { value: new LocalStorage() });

// jsdom does not implement canvas drawing APIs. Mock the tiny subset used by
// the pre-join lighting check so tests stay quiet and deterministic.
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: jest.fn(() => ({
    drawImage: jest.fn(),
    getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(32 * 32 * 4) })),
  })),
});

// This is to suppress the "Platform browser has already been set." warnings from the video-processors library
jest.mock('@twilio/video-processors', () => ({}));
