const express = require('express');
const router = express.Router();
const {
  getProducts, getAllProductsAdmin, getProductById,
  createProduct, updateProduct, deleteProduct,
  uploadVariantImages, uploadProductVideo, getInventoryMovements,
} = require('../controllers/productController');
const { protect, access, optionalProtect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { validateUploadedImages, uploadVideo, validateUploadedVideo } = require('../middleware/upload');
const { productListLimiter } = require('../middleware/guestRateLimiters');

// P1-4: endpoint بحث/قايمة عام بيضرب الداتابيز مباشرة عند أي فلترة - حد سخي
// جدًا فوق التصفح الطبيعي (حتى خلف NAT)، هدفه بس منع scraping/DoS بالسكريبت.
router.get('/', productListLimiter, getProducts);
router.get('/admin', protect, access('products', 'view'), getAllProductsAdmin);
router.get('/inventory/movements', protect, access('products', 'view'), getInventoryMovements);
// ===== [P0 Fix #3] لازم optionalProtect هنا (مش protect) - الراوت ده عام
// وبيفتح للزوار من غير تسجيل دخول زي ما هو، بس optionalProtect بيحط
// req.user لو فيه كوكي صحيحة عشان الكونترولر يقدر يميّز أدمن/موظف عن زائر
// (شوف الشرح في getProductById).
router.get('/:id', optionalProtect, getProductById);
router.post('/', protect, access('products', 'edit'), upload.array('images', 10), validateUploadedImages, createProduct);
router.put('/:id', protect, access('products', 'edit'), upload.array('images', 10), validateUploadedImages, updateProduct);
router.delete('/:id', protect, access('products', 'edit'), deleteProduct);
router.post('/:id/variants/:variantIndex/images', protect, access('products', 'edit'), upload.array('images', 10), validateUploadedImages, uploadVariantImages);
router.post('/video', protect, access('products', 'edit'), uploadVideo.single('video'), validateUploadedVideo, uploadProductVideo);

module.exports = router;