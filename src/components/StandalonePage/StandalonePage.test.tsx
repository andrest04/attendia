import React from 'react';
import { mount } from 'enzyme';
import StandalonePage, { PageMessageCard, PageNavButton, PageNote, PageTitle } from './StandalonePage';

describe('StandalonePage', () => {
  it('renders the page root with its test id, the brand bar and the content', () => {
    const wrapper = mount(
      <StandalonePage testId="my-page">
        <p data-testid="content">hola</p>
      </StandalonePage>
    );

    expect(wrapper.find('div[data-testid="my-page"]').exists()).toBe(true);
    expect(wrapper.find('nav').exists()).toBe(true);
    expect(wrapper.find('[data-testid="content"]').exists()).toBe(true);
  });

  it('places the start slot before the end slot in the bar', () => {
    const wrapper = mount(
      <StandalonePage testId="my-page" navStart={<span data-testid="start" />} navEnd={<span data-testid="end" />}>
        x
      </StandalonePage>
    );

    const ids = Array.from(
      wrapper
        .find('nav')
        .getDOMNode()
        .querySelectorAll('[data-testid]')
    ).map(node => node.getAttribute('data-testid'));
    expect(ids).toEqual(['start', 'end']);
  });

  it('renders no end container when there are no actions', () => {
    const withoutEnd = mount(<StandalonePage testId="my-page">x</StandalonePage>);
    const withEnd = mount(
      <StandalonePage testId="my-page" navEnd={<span />}>
        x
      </StandalonePage>
    );

    const barChildren = (wrapper: ReturnType<typeof mount>) => wrapper.find('nav').getDOMNode().children.length;
    expect(barChildren(withEnd)).toBe(barChildren(withoutEnd) + 1);
  });

  it('uses a different root class when it must fill the viewport', () => {
    const rootClass = (fill?: boolean) =>
      mount(
        <StandalonePage testId="my-page" fill={fill}>
          x
        </StandalonePage>
      )
        .find('div[data-testid="my-page"]')
        .prop('className');

    expect(rootClass(true)).not.toBe(rootClass(false));
    expect(rootClass(undefined)).toBe(rootClass(false));
  });
});

describe('PageNavButton', () => {
  it('renders an accessible button with its icon and label and calls onClick', () => {
    const onClick = jest.fn();
    const wrapper = mount(
      <PageNavButton onClick={onClick} icon={<i data-testid="icon" />} testId="nav-button">
        Cerrar
      </PageNavButton>
    );

    const button = wrapper.find('button[data-testid="nav-button"]');
    expect(button.prop('type')).toBe('button');
    expect(button.text()).toBe('Cerrar');
    expect(button.find('[data-testid="icon"]').exists()).toBe(true);
    button.simulate('click');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('can be disabled and outlined', () => {
    const wrapper = mount(
      <PageNavButton onClick={jest.fn()} icon={null} testId="nav-button" variant="outlined" disabled>
        Descargar
      </PageNavButton>
    );
    const plain = mount(
      <PageNavButton onClick={jest.fn()} icon={null} testId="nav-button">
        Descargar
      </PageNavButton>
    );

    const button = wrapper.find('button[data-testid="nav-button"]');
    expect(button.prop('disabled')).toBe(true);
    expect(button.prop('className')).not.toBe(plain.find('button').prop('className'));
  });
});

describe('PageTitle', () => {
  it('styles the strong and muted tones differently', () => {
    const titleClass = (tone: 'muted' | 'strong') =>
      mount(<PageTitle tone={tone}>Título</PageTitle>)
        .find('p')
        .prop('className');

    expect(titleClass('strong')).not.toBe(titleClass('muted'));
  });
});

describe('PageMessageCard', () => {
  it('shows the message inside a card with the given test id and width', () => {
    const wrapper = mount(
      <PageMessageCard testId="card" maxWidth={520}>
        Cargando...
      </PageMessageCard>
    );

    const card = wrapper.find('div[data-testid="card"]');
    expect(card.text()).toBe('Cargando...');
    expect(card.prop('style')).toEqual({ maxWidth: 520 });
  });

  it('defaults to a 480px card', () => {
    const wrapper = mount(<PageMessageCard testId="card">x</PageMessageCard>);

    expect(wrapper.find('div[data-testid="card"]').prop('style')).toEqual({ maxWidth: 480 });
  });
});

describe('PageNote', () => {
  it('renders the note with its test id', () => {
    const wrapper = mount(<PageNote testId="note">Algo falló</PageNote>);

    expect(wrapper.find('p[data-testid="note"]').text()).toBe('Algo falló');
  });
});
