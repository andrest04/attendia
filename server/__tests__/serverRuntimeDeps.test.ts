import fs from 'fs';
import os from 'os';
import path from 'path';

const { findServerRoots, collectPackageDirs, copyPackages } = require('../../scripts/server-runtime-deps');

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function installPackage(dir: string, manifest: { [key: string]: any }) {
  write(path.join(dir, 'package.json'), JSON.stringify(manifest));
  write(path.join(dir, 'index.js'), 'module.exports = {};');
}

describe('server-runtime-deps', () => {
  let app: string;
  let out: string;
  const nm = (...parts: string[]) => path.join(app, 'node_modules', ...parts);
  const rel = (dirs: string[]) => dirs.map(dir => path.relative(app, dir));

  beforeEach(() => {
    app = fs.mkdtempSync(path.join(os.tmpdir(), 'server-deps-app-'));
    out = fs.mkdtempSync(path.join(os.tmpdir(), 'server-deps-out-'));
  });

  afterEach(() => {
    fs.rmSync(app, { recursive: true, force: true });
    fs.rmSync(out, { recursive: true, force: true });
  });

  it('reads the package roots from the compiled server requires, ignoring builtins and relative paths', () => {
    write(
      path.join(app, 'server-build', 'index.js'),
      [
        'const express = require("express");',
        'const fs = require("fs");',
        'const util = require("node:util");',
        'const local = require("./local");',
        'const token = require("@twilio-labs/plugin-rtc/src/serverless/functions/token");',
      ].join('\n')
    );
    write(path.join(app, 'server-build', 'nested', 'a.js'), "const admin = require('firebase-admin/app');");

    expect(findServerRoots(path.join(app, 'server-build'))).toEqual([
      '@twilio-labs/plugin-rtc',
      'express',
      'firebase-admin',
    ]);
  });

  it('collects the dependency closure with Node resolution, without following leaf packages', () => {
    installPackage(nm('express'), { dependencies: { 'body-parser': '*', debug: '*' } });
    installPackage(nm('body-parser'), { dependencies: { debug: '*' } });
    installPackage(nm('debug'), {});
    // A nested copy shadows the hoisted one for its parent only.
    installPackage(nm('body-parser', 'node_modules', 'debug'), {});
    installPackage(nm('@twilio-labs', 'plugin-rtc'), { dependencies: { '@oclif/command': '*' } });
    installPackage(nm('@oclif', 'command'), {});
    installPackage(nm('react'), {});

    expect(rel(collectPackageDirs(app, ['@twilio-labs/plugin-rtc', 'express']))).toEqual([
      'node_modules/@twilio-labs/plugin-rtc',
      'node_modules/body-parser',
      'node_modules/body-parser/node_modules/debug',
      'node_modules/debug',
      'node_modules/express',
    ]);
  });

  it('copies optional and peer dependencies only when installed', () => {
    installPackage(nm('a'), { optionalDependencies: { gone: '*' }, peerDependencies: { b: '*' } });
    installPackage(nm('b'), {});

    expect(rel(collectPackageDirs(app, ['a']))).toEqual(['node_modules/a', 'node_modules/b']);
  });

  it('fails when a required dependency is not installed', () => {
    installPackage(nm('a'), { dependencies: { missing: '*' } });

    expect(() => collectPackageDirs(app, ['a'])).toThrow('missing (required from node_modules/a)');
  });

  it('copies only the collected packages, skipping nested node_modules that were not collected', () => {
    installPackage(nm('express'), { dependencies: { debug: '*' } });
    installPackage(nm('express', 'node_modules', 'debug'), {});
    installPackage(nm('express', 'node_modules', 'unused'), {});
    installPackage(nm('react'), {});

    copyPackages(app, collectPackageDirs(app, ['express']), out);

    expect(fs.existsSync(path.join(out, 'node_modules', 'express', 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'node_modules', 'express', 'node_modules', 'debug', 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'node_modules', 'express', 'node_modules', 'unused'))).toBe(false);
    expect(fs.existsSync(path.join(out, 'node_modules', 'react'))).toBe(false);
  });
});
