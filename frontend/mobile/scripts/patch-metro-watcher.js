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

// Patch deepFreezeAndThrowOnMutationInDev to prevent "property is not configurable" crash in Fabric DEV
const deepFreezeFile = path.resolve(__dirname, '..', 'node_modules', 'react-native', 'Libraries', 'Utilities', 'deepFreezeAndThrowOnMutationInDev.js');
if (fs.existsSync(deepFreezeFile)) {
  let dfContent = fs.readFileSync(deepFreezeFile, 'utf8');
  if (dfContent.includes('Object.defineProperty(object, key, {') && !dfContent.includes('desc.configurable === false')) {
    dfContent = dfContent.replace(
      /if \(hasOwnProperty\.call\(object, key\)\) \{[\s\S]*?Object\.defineProperty\(object, key, \{[\s\S]*?set: throwOnImmutableMutation\.bind\(null, key\),[\s\S]*?\}\);[\s\S]*?\}/,
      `if (hasOwnProperty.call(object, key)) {
        const desc = Object.getOwnPropertyDescriptor(object, key);
        if (desc && desc.configurable === false) continue;
        try {
          Object.defineProperty(object, key, {
            configurable: true,
            get: identity.bind(null, object[key]),
            set: throwOnImmutableMutation.bind(null, key),
          });
        } catch {}
      }`
    );
    fs.writeFileSync(deepFreezeFile, dfContent, 'utf8');
    console.log('[patch-metro-watcher] Applied non-configurable property safety patch to deepFreezeAndThrowOnMutationInDev.js');
  }
}
