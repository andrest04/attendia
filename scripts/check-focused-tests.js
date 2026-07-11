const fs = require('fs');
const path = require('path');

const ROOTS = ['src', 'server'];
const TEST_FILE = /\.(test|spec)\.(ts|tsx|js|jsx)$/;
const FOCUSED_TEST = /\b(?:it|test|describe)\.only\s*\(/;

function collect(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(file);
    return TEST_FILE.test(entry.name) ? [file] : [];
  });
}

const focused = ROOTS.flatMap(collect).filter(file => FOCUSED_TEST.test(fs.readFileSync(file, 'utf8')));
if (focused.length) {
  throw new Error(`Focused Jest tests are forbidden in CI:\n${focused.join('\n')}`);
}
