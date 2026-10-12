import { toolbarButtonClass, useToolbarButtonStyles } from './toolbarButtonStyles';

const classes = {
  toolbarButton: 'base',
  toolbarButtonActive: 'active',
  chipIcon: 'chip',
  chipIconActive: 'chipActive',
} as ReturnType<typeof useToolbarButtonStyles>;

describe('toolbarButtonClass', () => {
  it('returns only the base look for an idle button', () => {
    expect(toolbarButtonClass(classes)).toBe('base');
  });

  it('adds the active tint of the standard button', () => {
    expect(toolbarButtonClass(classes, { active: true })).toBe('base active');
  });

  it('uses the plain-chip pair instead of the standard one for a plain button', () => {
    expect(toolbarButtonClass(classes, { plain: true })).toBe('base chip');
    expect(toolbarButtonClass(classes, { plain: true, active: true })).toBe('base chip chipActive');
  });

  it('keeps the caller class last so it can override', () => {
    expect(toolbarButtonClass(classes, { active: true, className: 'mine' })).toBe('base active mine');
  });
});
