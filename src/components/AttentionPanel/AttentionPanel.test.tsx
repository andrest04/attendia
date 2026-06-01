import React from 'react';
import { mount } from 'enzyme';
import AttentionPanel from './AttentionPanel';
import useChatContext from '../../hooks/useChatContext/useChatContext';
import { useAttention } from '../AttentionProvider';

jest.mock('../../hooks/useChatContext/useChatContext');
jest.mock('../AttentionProvider');

const mockSetIsAttentionPanelOpen = jest.fn();
const mockSetEnabled = jest.fn();

const mockUseChatContext = useChatContext as jest.Mock<any>;
const mockUseAttention = useAttention as jest.Mock<any>;

// Default mock: panel open, analysis enabled
mockUseChatContext.mockImplementation(() => ({
  isAttentionPanelOpen: true,
  setIsAttentionPanelOpen: mockSetIsAttentionPanelOpen,
  setIsChatWindowOpen: jest.fn(),
}));

const defaultSelf = {
  index: 76,
  components: { eyes: 80, posture: 75, head: 70 },
  capture: 'active' as const,
  lighting: 'ok' as const,
};

mockUseAttention.mockImplementation(() => ({
  self: defaultSelf,
  enabled: true,
  setEnabled: mockSetEnabled,
  attentionLevel: (score: number) => {
    if (score <= 40) return 'low';
    if (score <= 70) return 'medium';
    return 'high';
  },
}));

describe('AttentionPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseChatContext.mockImplementation(() => ({
      isAttentionPanelOpen: true,
      setIsAttentionPanelOpen: mockSetIsAttentionPanelOpen,
      setIsChatWindowOpen: jest.fn(),
    }));
    mockUseAttention.mockImplementation(() => ({
      self: defaultSelf,
      enabled: true,
      setEnabled: mockSetEnabled,
      attentionLevel: (score: number) => {
        if (score <= 40) return 'low';
        if (score <= 70) return 'medium';
        return 'high';
      },
    }));
  });

  describe('when the panel is open and analysis is enabled', () => {
    it('renders the attention index number', () => {
      const wrapper = mount(<AttentionPanel />);
      const indexEl = wrapper.find('[data-testid="attention-index"]');
      expect(indexEl.text()).toBe('76');
    });

    it('renders the level chip with the correct label', () => {
      const wrapper = mount(<AttentionPanel />);
      // Chip renders nested spans; find the root div with the testid and read its text
      const chip = wrapper.find('[data-testid="attention-level-chip"]').first();
      // index 76 > 70 → 'high' → 'Alta'
      expect(chip.text()).toBe('Alta');
    });

    it('renders the three component bars with correct labels', () => {
      const wrapper = mount(<AttentionPanel />);
      const text = wrapper.text();
      expect(text).toContain('Ojos');
      expect(text).toContain('Postura');
      expect(text).toContain('Orientación');
    });

    it('renders the capture status chip', () => {
      const wrapper = mount(<AttentionPanel />);
      const captureChip = wrapper.find('[data-testid="capture-status"]').first();
      expect(captureChip.text()).toBe('Análisis activo');
    });

    it('renders the lighting status chip as "ok"', () => {
      const wrapper = mount(<AttentionPanel />);
      const lightingChip = wrapper.find('[data-testid="lighting-status"]').first();
      expect(lightingChip.text()).toBe('Iluminación ok');
    });

    it('does NOT render the lighting alert when lighting is ok', () => {
      const wrapper = mount(<AttentionPanel />);
      expect(wrapper.find('[data-testid="lighting-alert"]').exists()).toBe(false);
    });

    it('renders the lighting alert when lighting is low', () => {
      mockUseAttention.mockImplementationOnce(() => ({
        self: { ...defaultSelf, lighting: 'low' as const },
        enabled: true,
        setEnabled: mockSetEnabled,
        attentionLevel: () => 'high',
      }));
      const wrapper = mount(<AttentionPanel />);
      expect(wrapper.find('[data-testid="lighting-alert"]').exists()).toBe(true);
    });

    it('shows "Iluminación baja" chip when lighting is low', () => {
      mockUseAttention.mockImplementationOnce(() => ({
        self: { ...defaultSelf, lighting: 'low' as const },
        enabled: true,
        setEnabled: mockSetEnabled,
        attentionLevel: () => 'high',
      }));
      const wrapper = mount(<AttentionPanel />);
      const lightingChip = wrapper.find('[data-testid="lighting-status"]').first();
      expect(lightingChip.text()).toBe('Iluminación baja');
    });

    it('shows "Análisis inactivo" chip when capture is inactive', () => {
      mockUseAttention.mockImplementationOnce(() => ({
        self: { ...defaultSelf, capture: 'inactive' as const },
        enabled: true,
        setEnabled: mockSetEnabled,
        attentionLevel: () => 'high',
      }));
      const wrapper = mount(<AttentionPanel />);
      const captureChip = wrapper.find('[data-testid="capture-status"]').first();
      expect(captureChip.text()).toBe('Análisis inactivo');
    });

    it('does NOT render the disabled message when enabled', () => {
      const wrapper = mount(<AttentionPanel />);
      expect(wrapper.find('[data-testid="attention-disabled"]').exists()).toBe(false);
    });

    it('calls setIsAttentionPanelOpen(false) when the close button is clicked', () => {
      const wrapper = mount(<AttentionPanel />);
      wrapper
        .find('[aria-label="Cerrar panel"]')
        .first()
        .simulate('click');
      expect(mockSetIsAttentionPanelOpen).toHaveBeenCalledWith(false);
    });
  });

  describe('when analysis is disabled (enabled = false)', () => {
    beforeEach(() => {
      mockUseAttention.mockImplementation(() => ({
        self: defaultSelf,
        enabled: false,
        setEnabled: mockSetEnabled,
        attentionLevel: () => 'high',
      }));
    });

    it('renders the disabled message', () => {
      const wrapper = mount(<AttentionPanel />);
      expect(wrapper.find('[data-testid="attention-disabled"]').exists()).toBe(true);
    });

    it('does NOT render the index number', () => {
      const wrapper = mount(<AttentionPanel />);
      expect(wrapper.find('[data-testid="attention-index"]').exists()).toBe(false);
    });

    it('does NOT render the level chip', () => {
      const wrapper = mount(<AttentionPanel />);
      expect(wrapper.find('[data-testid="attention-level-chip"]').exists()).toBe(false);
    });
  });

  describe('the analysis toggle switch', () => {
    it('calls setEnabled(false) when toggled off', () => {
      const wrapper = mount(<AttentionPanel />);
      const switchEl = wrapper.find('[data-testid="attention-toggle"]').find('input');
      switchEl.simulate('change', { target: { checked: false } });
      expect(mockSetEnabled).toHaveBeenCalledWith(false);
    });

    it('calls setEnabled(true) when toggled on', () => {
      mockUseAttention.mockImplementationOnce(() => ({
        self: defaultSelf,
        enabled: false,
        setEnabled: mockSetEnabled,
        attentionLevel: () => 'low',
      }));
      const wrapper = mount(<AttentionPanel />);
      const switchEl = wrapper.find('[data-testid="attention-toggle"]').find('input');
      switchEl.simulate('change', { target: { checked: true } });
      expect(mockSetEnabled).toHaveBeenCalledWith(true);
    });
  });

  describe('panel visibility', () => {
    it('marks the panel hidden when isAttentionPanelOpen is false', () => {
      mockUseChatContext.mockImplementationOnce(() => ({
        isAttentionPanelOpen: false,
        setIsAttentionPanelOpen: mockSetIsAttentionPanelOpen,
        setIsChatWindowOpen: jest.fn(),
      }));
      const wrapper = mount(<AttentionPanel />);
      const aside = wrapper.find('aside').first();
      expect(aside.prop('aria-hidden')).toBe(true);
    });

    it('marks the panel visible when isAttentionPanelOpen is true', () => {
      const wrapper = mount(<AttentionPanel />);
      const aside = wrapper.find('aside').first();
      expect(aside.prop('aria-hidden')).toBe(false);
    });
  });

  describe('embedded mode', () => {
    it('does not render close button in embedded mode', () => {
      const wrapper = mount(<AttentionPanel embedded isVisible />);
      expect(wrapper.find('[aria-label="Cerrar panel"]').exists()).toBe(false);
    });

    it('uses isVisible prop in embedded mode', () => {
      const wrapper = mount(<AttentionPanel embedded isVisible={false} />);
      const aside = wrapper.find('[data-testid="attention-panel"]').first();
      expect(aside.prop('aria-hidden')).toBe(true);
    });

    it('renders content in embedded mode even when legacy drawer flag is false', () => {
      mockUseChatContext.mockImplementationOnce(() => ({
        isAttentionPanelOpen: false,
        setIsAttentionPanelOpen: mockSetIsAttentionPanelOpen,
        setIsChatWindowOpen: jest.fn(),
      }));
      const wrapper = mount(<AttentionPanel embedded isVisible />);
      expect(wrapper.find('[data-testid="attention-index"]').exists()).toBe(true);
    });
  });
});
