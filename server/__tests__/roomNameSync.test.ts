import { slugifyTitle } from '../classes';
import { toClassSessionRoomName } from '../../src/components/PreJoinScreens/classSessionTypes';

/**
 * Contract test for the second hand-mirrored helper (the first is the [Profesor]
 * suffix, see teacherSuffixSync.test.ts). The server derives a class's room name from its
 * title; the client derives the join code/link from the SAME title in the prejoin flow.
 * If the two slugifiers ever disagree, a teacher would share a code that does not match
 * the room the server created. Server and client cannot share a module (the server is
 * compiled separately), so this test pins them to identical behavior instead.
 */
describe('class title → room name slug stays in sync between server and client', () => {
  const titles = [
    'Matemáticas 101',
    '  Álgebra   Lineal 2024!  ',
    'Física: Ondas y Sonido',
    'ÑANDÚ & Cía.',
    'ya-es-un-slug',
    '---borde---',
    'Clase #3 (tarde)',
    'ΑΒΓ',
    '日本語',
    '',
    '   ',
    '!!!',
  ];

  titles.forEach(title => {
    it(`produces the same slug for ${JSON.stringify(title)}`, () => {
      expect(slugifyTitle(title)).toBe(toClassSessionRoomName(title));
    });
  });

  it('falls back to the same placeholder when nothing usable remains', () => {
    expect(slugifyTitle('!!!')).toBe('class-session');
    expect(toClassSessionRoomName('!!!')).toBe('class-session');
  });
});
