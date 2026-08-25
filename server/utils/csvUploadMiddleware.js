const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const allowedMimeTypes = [
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/csv",
    "text/plain",
  ];

  if (
    [".csv", ".xls", ".xlsx"].includes(ext) ||
    allowedMimeTypes.includes(file.mimetype)
  ) {
    cb(null, true);
    return;
  }

  cb(new Error("Only CSV or Excel template files are allowed"));
};

module.exports = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter,
});


