const multer = require("multer");
const path = require("path");
const fs = require("fs");
const configuredUploadPath =
  process.env.AFMC_IMAGE_UPLOAD_PATH || "/var/www/AFMCIMAGES";
const uploadPath = path.resolve(configuredUploadPath);
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
  let itemName = req.body.itemName || "image";
  // sanitize item name
  itemName = itemName
    .trim()
    .replace(/\s+/g, "_")     // spaces → _
    .replace(/[^\w.-]/g, ""); // remove special chars
  const ext = path.extname(file.originalname); // .jpg, .png
    const finalName = `${itemName}_${Date.now()}${ext}`;

  cb(null, finalName);
}

});

const fileFilter = (req, file, cb) => {
  const extname = path.extname(file.originalname).toLowerCase() === ".jpg";
  const mimetype = file.mimetype === "image/jpeg";

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Only JPG image files are allowed."));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter,
});

const publicBaseUrl =
  process.env.AFMC_IMAGE_PUBLIC_BASE_URL ||
  "https://afmc.globalsparkteksolutions.com/AFMCIMAGES";

upload.uploadPath = uploadPath;
upload.publicBaseUrl = publicBaseUrl.replace(/\/+$/, "");

module.exports = upload;


