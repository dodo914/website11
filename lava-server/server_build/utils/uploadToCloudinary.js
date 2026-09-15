const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');
const { PassThrough } = require('stream');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const CLOUDINARY_TIMEOUT_MS = Number(process.env.CLOUDINARY_UPLOAD_TIMEOUT_MS || 30000);

const parseCloudinaryPublicId = (imageUrl) => {
  if (!imageUrl || !imageUrl.includes('cloudinary.com')) return null;
  const token = '/image/upload/';
  const idx = imageUrl.indexOf(token);
  if (idx === -1) return null;

  let publicId = imageUrl.substring(idx + token.length);
  publicId = publicId.replace(/^v\d+\//, '');
  publicId = publicId.replace(/\.[a-zA-Z0-9]+(\?.*)?$/, '');
  return publicId;
};

const getCloudinaryPublicId = (imageRef) => {
  if (!imageRef) return null;
  if (typeof imageRef === 'string') return parseCloudinaryPublicId(imageRef);
  if (typeof imageRef === 'object') {
    if (imageRef.publicId) return imageRef.publicId;
    if (imageRef.url) return parseCloudinaryPublicId(imageRef.url);
  }
  return null;
};

const cloudinaryError = (message, cause) => {
  const err = new Error(message);
  err.code = 'CLOUDINARY_UPLOAD_FAILED';
  err.statusCode = 502;
  err.cause = cause;
  return err;
};

const streamUpload = (fileBuffer, options = {}) => new Promise((resolve, reject) => {
  let settled = false;

  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    reject(cloudinaryError('تعذر رفع الصورة إلى خدمة التخزين. حاول مرة أخرى.', new Error('Cloudinary upload timeout')));
  }, CLOUDINARY_TIMEOUT_MS);

  const uploader = cloudinary.uploader.upload_stream(
    {
      folder: options.folder || 'products',
      public_id: options.publicId,
      overwrite: false,
      resource_type: 'image',
      timeout: CLOUDINARY_TIMEOUT_MS,
      use_filename: false,
      unique_filename: false,
    },
    (error, result) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;

      if (error || !result?.secure_url || !result?.public_id) {
        reject(cloudinaryError('تعذر رفع الصورة إلى خدمة التخزين. حاول مرة أخرى.', error));
        return;
      }

      resolve({
        url: result.secure_url,
        secureUrl: result.secure_url,
        publicId: result.public_id,
        assetId: result.asset_id || null,
        width: result.width || null,
        height: result.height || null,
        format: result.format || null,
        bytes: result.bytes || null,
      });
    },
  );

  uploader.on('error', (error) => {
    clearTimeout(timer);
    if (!settled) {
      settled = true;
      reject(cloudinaryError('تعذر رفع الصورة إلى خدمة التخزين. حاول مرة أخرى.', error));
    }
  });

  const source = new PassThrough();
  source.end(fileBuffer);
  source.pipe(uploader);
});

// Upload raw image bytes directly to Cloudinary.
// IMPORTANT: no data:image/... and no Base64 conversion.
const uploadImageToCloudinary = async (
  fileBuffer,
  originalName,
  mimetype,
  options = {},
) => {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw cloudinaryError('ملف الصورة غير صالح.');
  }

  const ext = (String(originalName || '').split('.').pop() || 'jpg')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const suffix = ext || 'jpg';
  const publicId = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

  return streamUpload(fileBuffer, {
    folder: options.folder || 'products',
    publicId: `${publicId}-${suffix}`,
    context: options.context,
  });
};

const deleteImageFromCloudinary = async (imageRef) => {
  const publicId = getCloudinaryPublicId(imageRef);
  if (!publicId) return { skipped: true };

  try {
    await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: 'image',
      timeout: CLOUDINARY_TIMEOUT_MS,
    });
    return { deleted: true, publicId };
  } catch (err) {
    console.error('Cloudinary asset deletion failed:', err.message);
    return { deleted: false, publicId, error: err };
  }
};

const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );

const CLOUDINARY_VIDEO_TIMEOUT_MS = Number(process.env.CLOUDINARY_VIDEO_UPLOAD_TIMEOUT_MS || 120000);

const streamUploadVideo = (fileBuffer, options = {}) => new Promise((resolve, reject) => {
  let settled = false;

  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    reject(cloudinaryError('تعذر رفع الفيديو إلى خدمة التخزين. حاول مرة أخرى.', new Error('Cloudinary video upload timeout')));
  }, CLOUDINARY_VIDEO_TIMEOUT_MS);

  const uploader = cloudinary.uploader.upload_stream(
    {
      folder: options.folder || 'videos',
      public_id: options.publicId,
      overwrite: false,
      resource_type: 'video',
      timeout: CLOUDINARY_VIDEO_TIMEOUT_MS,
      use_filename: false,
      unique_filename: false,
    },
    (error, result) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;

      if (error || !result?.secure_url || !result?.public_id) {
        reject(cloudinaryError('تعذر رفع الفيديو إلى خدمة التخزين. حاول مرة أخرى.', error));
        return;
      }

      resolve({
        url: result.secure_url,
        secureUrl: result.secure_url,
        publicId: result.public_id,
        assetId: result.asset_id || null,
        width: result.width || null,
        height: result.height || null,
        format: result.format || null,
        bytes: result.bytes || null,
        duration: result.duration || null,
      });
    },
  );

  uploader.on('error', (error) => {
    clearTimeout(timer);
    if (!settled) {
      settled = true;
      reject(cloudinaryError('تعذر رفع الفيديو إلى خدمة التخزين. حاول مرة أخرى.', error));
    }
  });

  const source = new PassThrough();
  source.end(fileBuffer);
  source.pipe(uploader);
});

// Upload raw video bytes directly to Cloudinary.
// نفس مبدأ الصور بالظبط: مفيش أي تحويل Base64 ولا تخزين وسيط — الملف بيتبعت مباشرة
// كـ stream لـ Cloudinary، ولو فشل الرفع بيترفض بخطأ واضح من غير أي مسار بديل للتخزين.
const uploadVideoToCloudinary = async (
  fileBuffer,
  originalName,
  mimetype,
  options = {},
) => {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw cloudinaryError('ملف الفيديو غير صالح.');
  }

  const ext = (String(originalName || '').split('.').pop() || 'mp4')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const suffix = ext || 'mp4';
  const publicId = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

  return streamUploadVideo(fileBuffer, {
    folder: options.folder || 'videos',
    publicId: `${publicId}-${suffix}`,
  });
};

const deleteVideoFromCloudinary = async (videoRef) => {
  const publicId = getCloudinaryPublicId(videoRef);
  if (!publicId) return { skipped: true };

  try {
    await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: 'video',
      timeout: CLOUDINARY_VIDEO_TIMEOUT_MS,
    });
    return { deleted: true, publicId };
  } catch (err) {
    console.error('Cloudinary video deletion failed:', err.message);
    return { deleted: false, publicId, error: err };
  }
};

module.exports = {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
  parseCloudinaryPublicId,
  getCloudinaryPublicId,
  isCloudinaryConfigured,
  uploadVideoToCloudinary,
  deleteVideoFromCloudinary,
};