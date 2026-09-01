import { packager } from '@electron/packager';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const outputDirectory = path.join(projectRoot, 'release');
const targetDirectory = path.join(outputDirectory, 'local-pdf-cbt-win32-x64');
const bundledPaths = ['/electron', '/dist', '/package.json'];
const require = createRequire(import.meta.url);

// Packager skips existing output with a successful result. Do not report it as a new build.
if (existsSync(targetDirectory)) {
  console.error(
    `패키지 출력이 이미 있습니다: ${targetDirectory}\n기존 폴더를 보관하거나 정리한 뒤 다시 실행해주세요. 자동으로 덮어쓰지 않습니다.`,
  );
  process.exit(1);
}

// Only application files are bundled; user documents and development files stay out.
const paths = await packager({
  dir: projectRoot,
  name: 'local-pdf-cbt',
  platform: 'win32',
  arch: 'x64',
  out: outputDirectory,
  asar: true,
  overwrite: false,
  prune: false,
  // Use the checksums shipped with the pinned Electron package, including cached builds.
  download: { checksums: require('electron/checksums.json') },
  ignore: (filePath) => {
    if (!filePath) return false;
    const normalizedPath = filePath.replaceAll('\\', '/');
    return !bundledPaths.some(
      (allowed) =>
        normalizedPath === allowed || normalizedPath.startsWith(`${allowed}/`),
    );
  },
});

if (paths.length !== 1) {
  throw new Error('Windows x64 패키지가 생성되지 않았습니다.');
}
console.log(`Local package: ${paths.join(', ')}`);
