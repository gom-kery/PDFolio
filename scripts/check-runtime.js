const [major, minor] = process.versions.node.split('.').map(Number);

if (major !== 24 || minor < 19) {
  console.error(
    `Node.js 24.19 이상인 24 LTS가 필요합니다. 현재: ${process.versions.node}. README의 실행 환경 안내를 확인해주세요.`,
  );
  process.exit(1);
}
