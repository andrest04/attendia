import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { act } from 'react-dom/test-utils';
import * as cropUtils from './avatarCropUtils';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import AvatarCropModal from './AvatarCropModal';

jest.mock('react-easy-crop', () => function MockCropper() { return null; });

describe('AvatarCropModal error provenance', () => {
  it('marks a failed image load without changing its translated message', async () => {
    const original = global.Image;
    global.Image = class {
      onerror?: () => void;
      set src(_value: string) { this.onerror?.(); }
    } as any;
    const i18n = createI18n({ detect: false, lng: 'es' });
    try {
      await expect(cropUtils.cropToBudgetedBlob('bad', { x: 0, y: 0, width: 256, height: 256 }, i18n.t.bind(i18n)))
        .rejects.toMatchObject({ translationKey: 'crop.invalidImage', message: i18n.t('teacherProfile:crop.invalidImage') });
    } finally {
      global.Image = original;
    }
  });

  it.each(['known', 'unknown'])('preserves %s crop errors through the modal', async kind => {
    const onError = jest.fn();
    const error = kind === 'known'
      ? new cropUtils.AvatarCropError('crop.invalidImage', 'same text')
      : new Error('same text');
    const crop = jest.spyOn(cropUtils, 'cropToBudgetedBlob').mockRejectedValue(error);
    const wrapper = mount(<I18nextProvider i18n={createI18n({ detect: false, lng: 'es' })}>
      <AvatarCropModal imageSrc="photo" isSaving={false} onCancel={jest.fn()} onConfirm={jest.fn()} onError={onError} />
    </I18nextProvider>);
    try {
      act(() => { (wrapper.find('MockCropper').prop('onCropComplete') as any)({}, { x: 0, y: 0, width: 256, height: 256 }); });
      wrapper.update();
      await act(async () => { wrapper.find('[data-testid="avatar-crop-confirm"]').first().prop('onClick')!({} as any); await Promise.resolve(); });
      expect(onError).toHaveBeenCalledWith(kind === 'known' ? error : { message: 'same text' });
    } finally {
      wrapper.unmount();
      crop.mockRestore();
    }
  });
});

describe('AvatarCropModal accessibility', () => {
  let wrapper: ReactWrapper;
  afterEach(() => wrapper.unmount());

  it.each([
    ['es', 'Ajustar foto', 'Cancelar', 'Listo'],
    ['en', 'Adjust photo', 'Cancel', 'Done'],
  ])('associates the dialog and zoom slider with their visible labels in %s', (language, title, cancel, done) => {
    const onCancel = jest.fn();
    wrapper = mount(
      <I18nextProvider i18n={createI18n({ detect: false, lng: language })}>
        <AvatarCropModal imageSrc="photo" isSaving={false} onCancel={onCancel} onConfirm={jest.fn()} onError={jest.fn()} />
      </I18nextProvider>
    );
    const dialog = document.querySelector('[role="dialog"]')!;
    const slider = dialog.querySelector('[role="slider"]')!;
    const titleId = dialog.getAttribute('aria-labelledby');
    const sliderId = slider.getAttribute('aria-labelledby');
    expect(sliderId && document.getElementById(sliderId)?.textContent).toBe('Zoom');
    expect(titleId && document.getElementById(titleId)?.textContent).toBe(title);
    expect(slider.getAttribute('aria-valuenow')).toBe('1');
    expect(slider.getAttribute('aria-valuemin')).toBe('1');
    expect(slider.getAttribute('aria-valuemax')).toBe('3');
    const buttons = Array.from(dialog.querySelectorAll('button'));
    expect(buttons.map(button => button.textContent)).toEqual([cancel, done]);
    expect(buttons[1].disabled).toBe(true);
    buttons[0].click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
