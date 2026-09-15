// Shared image upload validation for every multipart image endpoint.
// Files are kept in memory only long enough to stream them to Cloudinary.
const multer = require('multer');

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB per image
const MAX_WIDTH = 12000;
const MAX_HEIGHT = 12000;

const storage = multer.memoryStorage();

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const getImageSignature = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) return 'image/png';

  // WebP: RIFF....WEBP
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) return 'image/webp';

  return null;
};

const readImageDimensions = (buffer, mime) => {
  try {
    if (mime === 'image/png' && buffer.length >= 24) {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      };
    }

    if (mime === 'image/webp' && buffer.length >= 30) {
      const chunk = buffer.toString('ascii', 12, 16);
      if (chunk === 'VP8X') {
        return {
          width: 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16),
          height: 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16),
        };
      }
    }

    if (mime === 'image/jpeg') {
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xFF) {
          offset += 1;
          continue;
        }
        const marker = buffer[offset + 1];
        offset += 2;

        if (marker === 0xD8 || marker === 0xD9) continue;
        if (offset + 2 > buffer.length) break;

        const segmentLength = buffer.readUInt16BE(offset);
        if (segmentLength < 2 || offset + segmentLength > buffer.length) break;

        const isSOF = [
          0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
          0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
        ].includes(marker);

        if (isSOF && offset + 7 <= buffer.length) {
          return {
            height: buffer.readUInt16BE(offset + 3),
            width: buffer.readUInt16BE(offset + 5),
          };
        }

        offset += segmentLength;
      }
    }
  } catch (_) {
    return null;
  }

  return null;
};

const validateOneFile = (file) => {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    const err = new Error('ملف الصورة غير صالح');
    err.statusCode = 400;
    throw err;
  }

  if (!ALLOWED_MIME.has(file.mimetype)) {
    const err = new Error('مسموح فقط بصور JPEG أو PNG أو WebP');
    err.statusCode = 400;
    throw err;
  }

  if (file.size > MAX_FILE_SIZE) {
    const err = new Error('حجم الصورة أكبر من الحد المسموح (8MB)');
    err.statusCode = 413;
    throw err;
  }

  const detectedMime = getImageSignature(file.buffer);
  if (!detectedMime || detectedMime !== file.mimetype) {
    const err = new Error('محتوى الملف لا يطابق نوع الصورة المعلن');
    err.statusCode = 400;
    throw err;
  }

  const dimensions = readImageDimensions(file.buffer, detectedMime);
  if (dimensions && (dimensions.width > MAX_WIDTH || dimensions.height > MAX_HEIGHT)) {
    const err = new Error('أبعاد الصورة أكبر من الحد المسموح');
    err.statusCode = 400;
    throw err;
  }

  // Never trust an upload filename for filesystem paths.
  file.safeOriginalName = String(file.originalname || 'image')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120) || 'image';
  file.detectedMime = detectedMime;
  file.width = dimensions?.width || null;
  file.height = dimensions?.height || null;

  return file;
};

const validateUploadedImages = (req, res, next) => {
  try {
    const files = [
      ...(Array.isArray(req.files) ? req.files : []),
      ...(req.file ? [req.file] : []),
    ];
    files.forEach(validateOneFile);
    next();
  } catch (err) {
    next(err);
  }
};

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    const err = new Error('مسموح فقط بصور JPEG أو PNG أو WebP');
    err.statusCode = 400;
    return cb(err, false);
  }
  return cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10,
    fields: 50,
    parts: 70,
  },
});

module.exports = upload;
module.exports.validateUploadedImages = validateUploadedImages;
module.exports.MAX_FILE_SIZE = MAX_FILE_SIZE;

// ============================================================
// رفع الفيديو (لفيديو المنتج وفيديو البانر الرئيسي)
// نفس فلسفة رفع الصور: بافر في الميموري بس، بيتبعت مباشرة لـ Cloudinary،
// وفيه تحقق حقيقي من محتوى الملف (magic bytes) مش بس اسم الامتداد.
// ============================================================
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB للفيديو

const ALLOWED_VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

// بيتأكد من نوع الفيديو الحقيقي من أول بايتات الملف (مش بس الـ mimetype المعلن من المتصفح)
const getVideoSignature = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // MP4 / MOV: بياخدوا نفس بنية ISO Base Media File Format — box بعنوان "ftyp" في أول 12 بايت
  if (buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12);
    // العلامات الشائعة لـ QuickTime/.mov
    if (['qt  ', 'moov'].includes(brand)) return 'video/quicktime';
    return 'video/mp4';
  }

  // WebM: EBML header = 1A 45 DF A3
  if (
    buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3
  ) return 'video/webm';

  return null;
};

const videoStorage = multer.memoryStorage();

const videoFileFilter = (req, file, cb) => {
  if (!ALLOWED_VIDEO_MIME.has(file.mimetype)) {
    const err = new Error('مسموح فقط بفيديو MP4 أو WebM أو MOV');
    err.statusCode = 400;
    return cb(err, false);
  }
  return cb(null, true);
};

const validateOneVideo = (file) => {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    const err = new Error('ملف الفيديو غير صالح');
    err.statusCode = 400;
    throw err;
  }

  if (!ALLOWED_VIDEO_MIME.has(file.mimetype)) {
    const err = new Error('مسموح فقط بفيديو MP4 أو WebM أو MOV');
    err.statusCode = 400;
    throw err;
  }

  if (file.size > MAX_VIDEO_SIZE) {
    const err = new Error('حجم الفيديو أكبر من الحد المسموح (100MB)');
    err.statusCode = 413;
    throw err;
  }

  const detectedType = getVideoSignature(file.buffer);
  if (!detectedType) {
    const err = new Error('محتوى الملف لا يطابق نوع فيديو مدعوم');
    err.statusCode = 400;
    throw err;
  }
  // .mov و mp4 بيشاركوا نفس بنية الحاوية، فبنقبل أي نوع منهم لو الـ mimetype المعلن كان mp4/quicktime
  if (detectedType === 'video/webm' && file.mimetype !== 'video/webm') {
    const err = new Error('محتوى الملف لا يطابق نوع الفيديو المعلن');
    err.statusCode = 400;
    throw err;
  }
  if (detectedType !== 'video/webm' && file.mimetype === 'video/webm') {
    const err = new Error('محتوى الملف لا يطابق نوع الفيديو المعلن');
    err.statusCode = 400;
    throw err;
  }

  file.safeOriginalName = String(file.originalname || 'video')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120) || 'video';
  file.detectedMime = file.mimetype;

  return file;
};

const validateUploadedVideo = (req, res, next) => {
  try {
    const files = [
      ...(Array.isArray(req.files) ? req.files : []),
      ...(req.file ? [req.file] : []),
    ];
    files.forEach(validateOneVideo);
    next();
  } catch (err) {
    next(err);
  }
};

const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE,
    files: 1,
    fields: 20,
    parts: 25,
  },
});

module.exports.uploadVideo = uploadVideo;
module.exports.validateUploadedVideo = validateUploadedVideo;
module.exports.MAX_VIDEO_SIZE = MAX_VIDEO_SIZE;