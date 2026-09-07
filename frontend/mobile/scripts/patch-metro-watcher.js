const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '..', 'node_modules', '@expo', 'metro-file-map', 'build', 'watchers', 'FallbackWatcher.js');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  if (content.includes("(error.code === 'EPERM' && platform === 'win32')")) {
    content = content.replace(
      "(error.code === 'EPERM' && platform === 'win32')",
      "((error.code === 'EPERM' || error.code === 'UNKNOWN' || error.code === 'EBUSY') && platform === 'win32')"
    );
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[patch-metro-watcher] Applied Windows UNKNOWN error suppression patch to FallbackWatcher.js');
  }
}
