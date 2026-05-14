const ensureSourceTree = () => {
  if (!fs.existsSync(packageSrc)) return;

  try {
    if (fs.existsSync(expectedSrc)) {
      fs.rmSync(expectedSrc, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 500,
      });
    }
  } catch (err) {
    console.log("Failed removing existing src folder:", err.message);
  }

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