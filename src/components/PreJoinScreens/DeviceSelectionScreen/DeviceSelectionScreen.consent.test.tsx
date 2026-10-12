/**
 * Consent-flow integration tests for DeviceSelectionScreen.
 *
 * These cover the student attention-consent gate that is active when
 * REACT_APP_ENABLE_ATTENTION_CV === 'true'. They live in a separate file
 * so they can reset process.env per-test without colliding with the
 * baseline DeviceSelectionScreen tests.
 */
import React from 'react';
import { shallow } from 'enzyme';
import DeviceSelectionScreen from './DeviceSelectionScreen';
import { useAppState } from '../../../state';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import * as attentionConsent from '../../../classSession/attentionConsent';
import AttentionConsentModal from '../AttentionConsentModal';
import { setImmediate } from 'timers';

const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;

const mockConnect = jest.fn();
const mockChatConnect = jest.fn(() => Promise.resolve());
const mockGetToken = jest.fn(() => Promise.resolve({ token: 'mockToken' }));

jest.mock('../../../hooks/useChatContext/useChatContext', () => () => ({ connect: mockChatConnect }));
jest.mock('../../../hooks/useVideoContext/useVideoContext');
jest.mock('../../../state');
jest.mock('../../../classSession/attentionConsent');
jest.mock('../AttentionConsentModal', () => {
  // Simple stub: renders a div with data attributes so we can assert on it without
  // needing MUI Dialog to be fully wired up under shallow().
  return function MockAttentionConsentModal({ open, onAccept, onDecline }: any) {
    if (!open) return null;
    return (
      <div data-testid="consent-modal">
        <button data-cy-consent-accept onClick={onAccept}>
          Aceptar
        </button>
        <button data-cy-consent-decline onClick={onDecline}>
          Volver
        </button>
      </div>
    );
  };
});

const mockHasConsent = attentionConsent.hasConsent as jest.Mock;
const mockSaveConsent = attentionConsent.saveConsent as jest.Mock;

function defaultVideoContextImpl() {
  return {
    connect: mockConnect,
    isAcquiringLocalTracks: false,
    isConnecting: false,
    localTracks: [],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAppState.mockImplementation(() => ({ getToken: mockGetToken, isFetching: false }));
  mockUseVideoContext.mockImplementation(defaultVideoContextImpl);
  mockHasConsent.mockReturnValue(false);
  mockSaveConsent.mockImplementation(() => {});
});

// ─── Flag OFF ─────────────────────────────────────────────────────────────────

describe('flag OFF (REACT_APP_ENABLE_ATTENTION_CV is not "true")', () => {
  beforeEach(() => {
    delete process.env.REACT_APP_ENABLE_ATTENTION_CV;
  });

  it('does not render the consent modal at all', () => {
    const wrapper = shallow(<DeviceSelectionScreen name="Ana Estudiante" roomName="sala-fisica" setStep={() => {}} />);
    expect(wrapper.find(AttentionConsentModal).exists()).toBe(false);
  });

  it('clicking the join button calls getToken immediately (no consent gate)', done => {
    const wrapper = shallow(<DeviceSelectionScreen name="Ana Estudiante" roomName="sala-fisica" setStep={() => {}} />);
    wrapper.find('[data-cy-join-now]').simulate('click');
    expect(mockGetToken).toHaveBeenCalledWith('Ana Estudiante', 'sala-fisica');
    setImmediate(() => {
      expect(mockConnect).toHaveBeenCalledWith('mockToken');
      done();
    });
  });
});

// ─── Flag ON + student, no prior consent ─────────────────────────────────────

describe('flag ON + student (no [Profesor] suffix) + not yet consented', () => {
  beforeEach(() => {
    process.env.REACT_APP_ENABLE_ATTENTION_CV = 'true';
    mockHasConsent.mockReturnValue(false);
  });

  afterEach(() => {
    delete process.env.REACT_APP_ENABLE_ATTENTION_CV;
  });

  it('shows the consent modal when join button is clicked', () => {
    const wrapper = shallow(<DeviceSelectionScreen name="Ana Estudiante" roomName="sala-fisica" setStep={() => {}} />);
    wrapper.find('[data-cy-join-now]').simulate('click');
    wrapper.update();
    expect(wrapper.find(AttentionConsentModal).prop('open')).toBe(true);
  });

  it('blocks the actual join (getToken not called) until consent is given', () => {
    const wrapper = shallow(<DeviceSelectionScreen name="Ana Estudiante" roomName="sala-fisica" setStep={() => {}} />);
    wrapper.find('[data-cy-join-now]').simulate('click');
    wrapper.update();
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('saves consent and proceeds to join when "Aceptar" is clicked', done => {
    const wrapper = shallow(<DeviceSelectionScreen name="Ana Estudiante" roomName="sala-fisica" setStep={() => {}} />);
    wrapper.find('[data-cy-join-now]').simulate('click');
    wrapper.update();

    // Simulate the modal's onAccept callback
    wrapper.find(AttentionConsentModal).prop('onAccept')();
    wrapper.update();

    expect(mockSaveConsent).toHaveBeenCalledWith('sala-fisica');
    expect(mockGetToken).toHaveBeenCalledWith('Ana Estudiante', 'sala-fisica');
    setImmediate(() => {
      expect(mockConnect).toHaveBeenCalledWith('mockToken');
      done();
    });
  });

  it('closes the modal and does NOT join when "Volver" is clicked', () => {
    const wrapper = shallow(<DeviceSelectionScreen name="Ana Estudiante" roomName="sala-fisica" setStep={() => {}} />);
    wrapper.find('[data-cy-join-now]').simulate('click');
    wrapper.update();

    wrapper.find(AttentionConsentModal).prop('onDecline')();
    wrapper.update();

    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();
    // Modal should be closed
    expect(wrapper.find(AttentionConsentModal).prop('open')).toBe(false);
  });
});

// ─── Flag ON + teacher ────────────────────────────────────────────────────────

describe('flag ON + teacher identity (ends with [Profesor])', () => {
  beforeEach(() => {
    process.env.REACT_APP_ENABLE_ATTENTION_CV = 'true';
    mockHasConsent.mockReturnValue(false);
  });

  afterEach(() => {
    delete process.env.REACT_APP_ENABLE_ATTENTION_CV;
  });

  it('never shows the consent modal for a teacher', () => {
    const wrapper = shallow(
      <DeviceSelectionScreen name="Prof. García [Profesor]" roomName="sala-fisica" setStep={() => {}} />
    );
    wrapper.find('[data-cy-join-now]').simulate('click');
    wrapper.update();
    // Modal should not open
    const modal = wrapper.find(AttentionConsentModal);
    const isOpen = !modal.exists() || modal.prop('open') === false;
    expect(isOpen).toBe(true);
  });

  it('teacher joins immediately without consent prompt', done => {
    const wrapper = shallow(
      <DeviceSelectionScreen name="Prof. García [Profesor]" roomName="sala-fisica" setStep={() => {}} />
    );
    wrapper.find('[data-cy-join-now]').simulate('click');

    expect(mockGetToken).toHaveBeenCalledWith('Prof. García [Profesor]', 'sala-fisica');
    setImmediate(() => {
      expect(mockConnect).toHaveBeenCalledWith('mockToken');
      done();
    });
  });
});

// ─── Already consented (same room) ───────────────────────────────────────────

describe('flag ON + student + already consented for this room', () => {
  beforeEach(() => {
    process.env.REACT_APP_ENABLE_ATTENTION_CV = 'true';
    mockHasConsent.mockReturnValue(true);
  });

  afterEach(() => {
    delete process.env.REACT_APP_ENABLE_ATTENTION_CV;
  });

  it('skips the consent modal and joins immediately', done => {
    const wrapper = shallow(<DeviceSelectionScreen name="Ana Estudiante" roomName="sala-fisica" setStep={() => {}} />);
    wrapper.find('[data-cy-join-now]').simulate('click');
    wrapper.update();

    // Modal should not open
    const modal = wrapper.find(AttentionConsentModal);
    const isOpen = modal.exists() && modal.prop('open') === true;
    expect(isOpen).toBe(false);

    expect(mockGetToken).toHaveBeenCalledWith('Ana Estudiante', 'sala-fisica');
    setImmediate(() => {
      expect(mockConnect).toHaveBeenCalledWith('mockToken');
      done();
    });
  });
});
