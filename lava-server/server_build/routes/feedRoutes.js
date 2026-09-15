const express = require('express');
const router = express.Router();
const {
  getMetaCatalog,
  getGoogleCatalog,
  getTikTokCatalog,
  getSnapchatCatalog,
} = require('../controllers/feedController');

// لا يحتاج authentication — الـ feed عام عشان المنصات تقدر تجيبه
router.get('/meta-catalog.xml',     getMetaCatalog);
router.get('/google-catalog.xml',   getGoogleCatalog);
router.get('/tiktok-catalog.csv',   getTikTokCatalog);
router.get('/snapchat-catalog.csv', getSnapchatCatalog);

module.exports = router;
