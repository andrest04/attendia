module.exports = {
  roots: ['<rootDir>/src', '<rootDir>/server'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    "^.+\\.(css)$": "<rootDir>/jest.transform.js"
  },
  transformIgnorePatterns: ["/node_modules/(?!ssr-window|dom7)"],
  testEnvironment: 'jsdom',
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  snapshotSerializers: ['enzyme-to-json/serializer'],
  setupFiles: ['<rootDir>/src/setupTests.ts'],
  reporters: ['default', 'jest-junit'],

  // We don't need to test the static JSX in the icons folder, so let's exclude it from our test coverage report
  coveragePathIgnorePatterns: ['node_modules', 'src/icons'],
  moduleNameMapper: {
    "^swiper/css$": '<rootDir>/src/__mocks__/fileMock.ts',
    "^swiper/css/pagination$": '<rootDir>/src/__mocks__/fileMock.ts',
    '.+\\.(css|styl|less|sass|scss|png|jpg|ttf|woff|woff2)$': '<rootDir>/src/__mocks__/fileMock.ts',
    "swiper/react": "<rootDir>/src/__mocks__/swiper-react.tsx",
    "swiper/modules": "<rootDir>/src/__mocks__/swiper-modules.ts"
  },
};
