// Copies into <outDir>/node_modules ONLY the packages the compiled server can load, for the
// runtime Docker image. `dependencies` in package.json is mostly the React client (already
// compiled into build/), so `npm ci --omit=dev` alone weighs ~1.1 GB, and pushing a layer that
// big to ACR times out on its final commit. The roots are read from the require() calls in
// the compiled server, so a new server import is picked up without editing a list here.
//
// Usage: node scripts/server-runtime-deps.js <appDir> <serverBuildDir> <outDir>
const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');

// Packages copied WITHOUT their own dependencies. The server only requires two self-contained
// files of plugin-rtc (src/serverless/functions/{token,recordingrules}.js, whose only require
// is the auth-handler asset server/bootstrap-globals.ts provides); its declared dependencies
// are the Twilio CLI (oclif, @twilio/cli-core, ...), which the server never loads.
const LEAF_PACKAGES = new Set(['@twilio-labs/plugin-rtc']);

const REQUIRE_CALL = /require\(\s*["']([^"']+)["']\s*\)/g;

function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

function isBareSpecifier(specifier) {
  return !specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('node:');
}

function listJsFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJsFiles(file);
    return entry.name.endsWith('.js') ? [file] : [];
  });
}

/** Package names the compiled server requires directly (builtins excluded). */
function findServerRoots(serverBuildDir) {
  const builtins = new Set(builtinModules);
  const roots = new Set();
  for (const file of listJsFiles(serverBuildDir)) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(REQUIRE_CALL)) {
      if (!isBareSpecifier(match[1])) continue;
      const name = packageName(match[1]);
      if (!builtins.has(name)) roots.add(name);
    }
  }
  return [...roots].sort();
}

// Node's lookup: <dir>/node_modules/<name>, walking up from the requiring package to appDir.
function resolvePackageDir(name, fromDir, appDir) {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (dir === appDir || dir === path.dirname(dir)) return undefined;
  }
}

/** Every installed package directory reachable from the roots (absolute paths, sorted). */
function collectPackageDirs(appDir, roots) {
  const seen = new Set();
  const missing = [];
  const visit = (name, fromDir, optional) => {
    const packageDir = resolvePackageDir(name, fromDir, appDir);
    if (!packageDir) {
      if (!optional) missing.push(`${name} (required from ${path.relative(appDir, fromDir) || '.'})`);
      return;
    }
    if (seen.has(packageDir)) return;
    seen.add(packageDir);
    if (LEAF_PACKAGES.has(name)) return;
    const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
    Object.keys(manifest.dependencies || {}).forEach(dep => visit(dep, packageDir, false));
    // Optional and peer dependencies may legitimately be absent; copy them only when installed.
    Object.keys({ ...manifest.optionalDependencies, ...manifest.peerDependencies }).forEach(dep =>
      visit(dep, packageDir, true)
    );
  };
  roots.forEach(root => visit(root, appDir, false));
  if (missing.length) throw new Error(`Server dependencies are not installed:\n${missing.join('\n')}`);
  return [...seen].sort();
}

function copyPackages(appDir, packageDirs, outDir) {
  for (const packageDir of packageDirs) {
    // A package's nested node_modules is skipped: whatever the server needs from it is in
    // packageDirs on its own and is copied to the same relative path.
    fs.cpSync(packageDir, path.join(outDir, path.relative(appDir, packageDir)), {
      recursive: true,
      filter: source =>
        source === packageDir || path.relative(packageDir, source).split(path.sep)[0] !== 'node_modules',
    });
  }
}

function main([appDir, serverBuildDir, outDir]) {
  if (!appDir || !serverBuildDir || !outDir) {
    throw new Error('Usage: node scripts/server-runtime-deps.js <appDir> <serverBuildDir> <outDir>');
  }
  const app = path.resolve(appDir);
  const roots = findServerRoots(path.resolve(serverBuildDir));
  const packageDirs = collectPackageDirs(app, roots);
  copyPackages(app, packageDirs, path.resolve(outDir));
  console.log(`server roots: ${roots.join(' ')}`);
  console.log(`copied ${packageDirs.length} packages to ${path.resolve(outDir)}`);
}

module.exports = { findServerRoots, collectPackageDirs, copyPackages };

if (require.main === module) main(process.argv.slice(2));
