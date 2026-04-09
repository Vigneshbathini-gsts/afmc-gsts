const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const nodeModulesRoot = path.join(projectRoot, "node_modules");
const packageSrc = path.join(nodeModulesRoot, "html5-qrcode", "src");
const expectedSrc = path.join(nodeModulesRoot, "src");

if (!fs.existsSync(packageSrc)) {
  process.exit(0);
}

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
