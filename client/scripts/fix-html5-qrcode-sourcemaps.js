const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const nodeModulesRoot = path.join(projectRoot, "node_modules");
const packageRoot = path.join(nodeModulesRoot, "html5-qrcode");
const packageSrc = path.join(packageRoot, "src");
const expectedSrc = path.join(nodeModulesRoot, "src");

if (!fs.existsSync(packageRoot)) {
  process.exit(0);
}

const roots = [
  path.join(packageRoot, "cjs"),
  path.join(packageRoot, "es2015"),
  path.join(packageRoot, "esm"),
  path.join(packageRoot, "lib"),
  path.join(packageRoot, "dist"),
].filter((dir) => fs.existsSync(dir));

const ensureSourceTree = () => {
  if (!fs.existsSync(packageSrc)) return;

  fs.rmSync(expectedSrc, { recursive: true, force: true });
  fs.cpSync(packageSrc, expectedSrc, { recursive: true });
  fs.writeFileSync(
    path.join(expectedSrc, "package.json"),
    JSON.stringify(
      {
        name: "html5-qrcode-src",
        private: true,
      },
      null,
      2
    )
  );
};

const walk = (dir, onFile) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, onFile);
    } else if (entry.isFile()) {
      onFile(fullPath);
    }
  }
};

const stripSourceMapUrls = () => {
  const stripFromFile = (filePath) => {
    if (!filePath.endsWith(".js")) return;
    const original = fs.readFileSync(filePath, "utf8");
    let updated = original.replace(/^\s*\/\/# sourceMappingURL=.*$/gm, "");
    updated = updated.replace(/\/\*# sourceMappingURL=.*?\*\//gs, "");
    updated = updated.replace(/\/\/# sourceMappingURL=data:application\/json$/gm, "");
    updated = updated.replace(/\/\*# sourceMappingURL=.*?\*\//gs, "");
    updated = updated.replace(/\/\/# sourceMappingURL=data:application\/json.*$/gm, "");
    if (updated !== original) fs.writeFileSync(filePath, updated, "utf8");
  };

  roots.forEach((dir) => walk(dir, stripFromFile));
};

const removeSourceMapFiles = () => {
  const removeIfMap = (filePath) => {
    if (!filePath.endsWith(".map")) return;
    console.log("Removing", filePath);
    fs.rmSync(filePath, { force: true });
  };

  roots.forEach((dir) => walk(dir, removeIfMap));
};

// CRA's `source-map-loader` warns when html5-qrcode sourcemaps point at missing TS sources.
// The most reliable way to silence this is to remove third-party sourcemaps.
// We also mirror `html5-qrcode/src` into `node_modules/src` for completeness.
ensureSourceTree();
stripSourceMapUrls();
removeSourceMapFiles();
