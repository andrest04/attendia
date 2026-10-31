import React from 'react';
import { mount } from 'enzyme';
import { MuiThemeProvider, createTheme } from '@material-ui/core/styles';
import { useDashboardButtonStyles } from './dashboardButtonStyles';

// Renders the hook while mounted (JSS removes its sheet on unmount) and returns the class map
// together with every CSS selector currently attached to the document.
function renderStyles() {
  let classes: Record<string, string> = {};
  const Probe = () => {
    classes = useDashboardButtonStyles();
    return null;
  };
  const wrapper = mount(
    <MuiThemeProvider theme={createTheme()}>
      <Probe />
    </MuiThemeProvider>
  );
  const selectors = Array.from(document.styleSheets).flatMap(sheet =>
    Array.from(sheet.cssRules).map(rule => (rule as CSSStyleRule).selectorText || '')
  );
  wrapper.unmount();
  return { classes, selectors };
}

describe('useDashboardButtonStyles', () => {
  it('exposes the primary, secondary and danger variants', () => {
    expect(Object.keys(renderStyles().classes).sort()).toEqual(['danger', 'primary', 'secondary']);
  });

  it('defines hover, focus and disabled states on every variant', () => {
    const { classes, selectors } = renderStyles();
    Object.values(classes).forEach(className => {
      expect(selectors).toContain(`.${className}:hover:not(:disabled)`);
      expect(selectors).toContain(`.${className}:focus-visible`);
      expect(selectors).toContain(`.${className}:disabled`);
    });
  });
});
