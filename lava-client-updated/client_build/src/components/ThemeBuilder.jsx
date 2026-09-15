// ============================================================
// ThemeBuilder.jsx - منشئ الثيمات الكامل v3
// src/components/ThemeBuilder.jsx
// ============================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PRESETS, DEFAULT_THEME_ID, FONT_OPTIONS, DEFAULT_FONT_ID, getFontOption } from '../themes';

// ===== خيارات =====
const NAV_LAYOUTS = [
  { value: 'centered-logo', label: 'لوجو في الوسط' },
  { value: 'classic', label: 'لوجو يسار، لينكات يمين' },
  { value: 'minimal', label: 'مينيمال (لوجو + هامبرجر بس)' },
];
const NAV_HEIGHTS = [
  { value: 'h-12', label: 'صغير جداً' },
  { value: 'h-14', label: 'صغير' },
  { value: 'h-16', label: 'متوسط' },
  { value: 'h-18', label: 'كبير' },
  { value: 'h-20', label: 'كبير جداً' },
];
const BTN_RADIUS = [
  { value: 'rounded-none', label: '▬ حاد تماماً' },
  { value: 'rounded-sm', label: '▬ حاد شوية' },
  { value: 'rounded-md', label: '▭ متوسط' },
  { value: 'rounded-lg', label: '▭ مدور' },
  { value: 'rounded-full', label: '● دايري كامل' },
];
const BTN_STYLES = [
  { value: 'filled', label: 'ممتلئ' },
  { value: 'outline', label: 'إطار بس' },
  { value: 'ghost', label: 'شفاف' },
];
const CARD_RADIUS = [
  { value: 'rounded-none', label: 'حاد' },
  { value: 'rounded-md', label: 'متوسط' },
  { value: 'rounded-lg', label: 'مدور' },
  { value: 'rounded-xl', label: 'مدور أكثر' },
  { value: 'rounded-2xl', label: 'مدور جداً' },
];
const CARD_SHADOWS = [
  { value: 'shadow-none', label: 'بدون ظل' },
  { value: 'shadow-sm', label: 'ظل خفيف' },
  { value: 'shadow-md', label: 'ظل متوسط' },
  { value: 'shadow-lg', label: 'ظل قوي' },
];
const HOVER_EFFECTS = [
  { value: 'none', label: 'بدون' },
  { value: 'scale', label: 'تكبير' },
  { value: 'lift', label: 'ارتفاع' },
  { value: 'glow', label: 'توهج' },
];
// ===== عدد كروت المنتجات في الصف - منفصل بين شاشة الموبايل وشاشة الكمبيوتر =====
const CARD_COLS_MOBILE = [
  { value: 'grid-cols-1', label: '1 كارت في الصف' },
  { value: 'grid-cols-2', label: '2 كارت في الصف' },
  { value: 'grid-cols-3', label: '3 كروت في الصف' },
];
const CARD_COLS_DESKTOP = [
  { value: 'md:grid-cols-2', label: '2 كارت في الصف' },
  { value: 'md:grid-cols-3', label: '3 كروت في الصف' },
  { value: 'md:grid-cols-4', label: '4 كروت في الصف' },
  { value: 'md:grid-cols-5', label: '5 كروت في الصف' },
  { value: 'md:grid-cols-6', label: '6 كروت في الصف' },
];
// ===== المسافة بين الكروت - منفصلة بين الموبايل والكمبيوتر =====
const CARD_GAP_MOBILE = [
  { value: 'gap-1', label: 'ضيقة جداً' },
  { value: 'gap-2', label: 'ضيقة' },
  { value: 'gap-3', label: 'متوسطة' },
  { value: 'gap-4', label: 'واسعة' },
  { value: 'gap-6', label: 'واسعة جداً' },
];
const CARD_GAP_DESKTOP = [
  { value: 'md:gap-2', label: 'ضيقة جداً' },
  { value: 'md:gap-4', label: 'ضيقة' },
  { value: 'md:gap-6', label: 'متوسطة' },
  { value: 'md:gap-8', label: 'واسعة' },
  { value: 'md:gap-10', label: 'واسعة جداً' },
];
// ===== ارتفاع صورة الكارت (طول الصورة داخل كارت المنتج) =====
const CARD_IMAGE_HEIGHT = [
  { value: 'h-36 md:h-56', label: 'قصيرة' },
  { value: 'h-44 md:h-64', label: 'متوسطة' },
  { value: 'h-48 md:h-80', label: 'طويلة (افتراضي)' },
  { value: 'h-56 md:h-96', label: 'طويلة جداً' },
];
// ===== حجم خط اسم المنتج داخل الكارت =====
const CARD_NAME_FONT_SIZE = [
  { value: 'text-xs md:text-base', label: 'صغير' },
  { value: 'text-sm md:text-xl', label: 'متوسط (افتراضي)' },
  { value: 'text-base md:text-2xl', label: 'كبير' },
];
// ===== حجم خط سعر المنتج داخل الكارت =====
const CARD_PRICE_FONT_SIZE = [
  { value: 'text-xs md:text-base', label: 'صغير' },
  { value: 'text-xs md:text-lg', label: 'متوسط (افتراضي)' },
  { value: 'text-sm md:text-2xl', label: 'كبير' },
];
// ===== مين يبقى أبرز جوه الكارت: الاسم ولا السعر =====
const CARD_PRICE_EMPHASIS = [
  { value: 'price', label: 'السعر أبرز' },
  { value: 'name', label: 'اسم المنتج أبرز' },
];
// ===== عدد كروت الصفحة الرئيسية في الصف — منفصل عن إعداد صفحة المتجر فوق =====
const CARD_HOME_COLS_MOBILE = [
  { value: '', label: 'زي صفحة المتجر' },
  { value: 'grid-cols-1', label: '1 كارت في الصف' },
  { value: 'grid-cols-2', label: '2 كارت في الصف' },
  { value: 'grid-cols-3', label: '3 كروت في الصف' },
];
const CARD_HOME_COLS_DESKTOP = [
  { value: '', label: 'زي صفحة المتجر' },
  { value: 'md:grid-cols-2', label: '2 كارت في الصف' },
  { value: 'md:grid-cols-3', label: '3 كروت في الصف' },
  { value: 'md:grid-cols-4', label: '4 كروت في الصف' },
  { value: 'md:grid-cols-5', label: '5 كروت في الصف' },
  { value: 'md:grid-cols-6', label: '6 كروت في الصف' },
];
const CARD_HOME_GAP_MOBILE = [
  { value: '', label: 'زي صفحة المتجر' },
  { value: 'gap-1', label: 'ضيقة جداً' },
  { value: 'gap-2', label: 'ضيقة' },
  { value: 'gap-3', label: 'متوسطة' },
  { value: 'gap-4', label: 'واسعة' },
  { value: 'gap-6', label: 'واسعة جداً' },
];
const CARD_HOME_GAP_DESKTOP = [
  { value: '', label: 'زي صفحة المتجر' },
  { value: 'md:gap-2', label: 'ضيقة جداً' },
  { value: 'md:gap-4', label: 'ضيقة' },
  { value: 'md:gap-6', label: 'متوسطة' },
  { value: 'md:gap-8', label: 'واسعة' },
  { value: 'md:gap-10', label: 'واسعة جداً' },
];
const CAT_STYLES = [
  { value: 'masonry', label: 'موزاييك (الأول كبير)' },
  { value: 'grid', label: 'شبكة متساوية' },
  { value: 'scroll', label: 'سكرول أفقي' },
  { value: 'list', label: 'قائمة عمودية' },
  { value: 'carousel', label: 'كاروسيل' },
];
const CAT_SHAPES = [
  { value: 'square', label: 'مربع حاد' },
  { value: 'rounded', label: 'مربع مدور' },
  { value: 'circle', label: 'دايري' },
];
const CAT_LABEL_STYLES = [
  { value: 'overlay', label: 'فوق الصورة' },
  { value: 'below', label: 'تحت الصورة' },
  { value: 'pill', label: 'شارة' },
];
const CAT_SHOW_LABEL = [
  { value: 'always', label: 'دايماً' },
  { value: 'hover', label: 'عند hover بس' },
  { value: 'none', label: 'مخفي' },
];
const MOBILE_ITEMS = ['home','shop','cart','wishlist','account'];
const MOBILE_LABELS = { home:'🏠 الرئيسية', shop:'👕 المتجر', cart:'🛒 العربة', wishlist:'❤️ المفضلة', account:'👤 حسابي' };

// ===== أيقونات ممكن تفضل ظاهرة فوق في الناف العلوي على الموبايل حتى لو الناف
// التحتاني شغال - دي بس الأيقونات اللي أصلاً موجودة في الناف العلوي =====
const MOBILE_TOP_ITEMS = ['account', 'wishlist', 'cart'];
const MOBILE_TOP_ITEMS_MAX = 3;

// ===== مكونات مساعدة =====
const ColorRow = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-2 py-1.5">
    <span className="text-xs text-gray-500 font-medium flex-1">{label}</span>
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <input type="color" value={value?.startsWith('#') ? value : '#000000'}
          onChange={e => onChange(e.target.value)}
          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
        <div className="w-7 h-7 rounded-md border border-gray-200 shadow-sm cursor-pointer"
          style={{ backgroundColor: value }} />
      </div>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        className="w-20 text-[11px] border border-gray-200 rounded-md px-1.5 py-1 font-mono bg-white" />
    </div>
  </div>
);

const SelectRow = ({ label, value, options, onChange }) => (
  <div className="flex items-center justify-between gap-2 py-1.5">
    <span className="text-xs text-gray-500 font-medium">{label}</span>
    <select value={value} onChange={e => onChange(e.target.value)}
      className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white max-w-[160px]">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const ToggleRow = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-2 py-1.5">
    <span className="text-xs text-gray-500 font-medium">{label}</span>
    <button onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full transition-colors relative ${value ? 'bg-black' : 'bg-gray-300'}`}>
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-6' : 'left-1'}`} />
    </button>
  </div>
);

const Section = ({ title, children, onReset }) => (
  <div className="space-y-0.5">
    <div className="flex items-center justify-between mb-2">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{title}</p>
      {onReset && (
        <button type="button" onClick={onReset}
          className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-black transition px-2 py-1 rounded-md hover:bg-gray-100">
          ↺ رجّع للافتراضي
        </button>
      )}
    </div>
    <div className="divide-y divide-gray-100">{children}</div>
  </div>
);

// ===== معاينة موبايل =====
const MobilePreview = ({ theme }) => {
  const { colors, nav, buttons, card, categories } = theme;
  const navH = nav.height === 'h-12' ? 48 : nav.height === 'h-14' ? 56 : nav.height === 'h-16' ? 64 : nav.height === 'h-18' ? 72 : 80;
  const fontStack = getFontOption(theme.fontFamily || DEFAULT_FONT_ID).stack;

  return (
    <div className="mx-auto select-none" style={{ width: 200, fontFamily: fontStack }}>
      <div className="rounded-[28px] overflow-hidden border-[5px] border-gray-800 shadow-2xl bg-gray-800">
        {/* status bar */}
        <div className="bg-gray-800 h-5 flex items-center justify-between px-4">
          <span className="text-white text-[8px] font-medium">9:41</span>
          <div className="flex gap-0.5 items-center">
            {[...Array(3)].map((_,i) => <div key={i} className="w-1 h-1 rounded-full bg-white opacity-80" />)}
          </div>
        </div>

        <div style={{ backgroundColor: colors.bg }}>
          {/* NAV */}
          <div style={{ height: Math.round(navH * 0.55), backgroundColor: nav.transparent ? 'transparent' : colors.navBg, borderBottom: nav.borderBottom ? `1px solid ${colors.navBorder}` : 'none' }}
            className="flex items-center justify-between px-3">
            {nav.layout === 'centered-logo' ? (
              <>
                <div className="w-3 h-3 rounded-full opacity-50" style={{ backgroundColor: colors.navFg }} />
                <span className="text-[9px] font-black tracking-widest" style={{ color: colors.navFg }}>LOGO</span>
                <div className="flex gap-1">
                  <span className="text-[9px]" style={{ color: colors.navFg }}>🛒</span>
                </div>
              </>
            ) : nav.layout === 'minimal' ? (
              <>
                <span className="text-[9px] font-black" style={{ color: colors.navFg }}>LOGO</span>
                <div className="flex gap-1">
                  <span className="text-[9px]" style={{ color: colors.navFg }}>🛒</span>
                  <span className="text-[9px]" style={{ color: colors.navFg }}>☰</span>
                </div>
              </>
            ) : (
              <>
                <span className="text-[9px] font-black" style={{ color: colors.navFg }}>LOGO</span>
                <div className="flex gap-2">
                  {['Home','Shop'].map(l => <span key={l} className="text-[7px] font-semibold opacity-60" style={{ color: colors.navFg }}>{l}</span>)}
                </div>
                <span className="text-[9px]" style={{ color: colors.navFg }}>🛒</span>
              </>
            )}
          </div>

          {/* Hero */}
          <div className="h-14 flex items-end pb-1.5 px-2"
            style={{ backgroundColor: colors.secondary, backgroundImage: `linear-gradient(to top, ${colors.secondaryFg}22, transparent)` }}>
            <div className="space-y-0.5">
              <div className="h-1 w-12 rounded-full" style={{ backgroundColor: colors.secondaryFg, opacity: 0.6 }} />
              <div className="h-2 w-16 rounded-full" style={{ backgroundColor: colors.secondaryFg, opacity: 0.9 }} />
            </div>
          </div>

          {/* Categories preview */}
          <div className="px-2 py-1.5">
            <div className="h-1 w-10 rounded-full mb-1.5" style={{ backgroundColor: colors.navFg, opacity: 0.15 }} />
            {categories.style === 'scroll' ? (
              <div className="flex gap-1.5 overflow-hidden">
                {[45,35,50].map((w,i) => (
                  <div key={i} className={`flex-shrink-0 ${categories.shape === 'circle' ? 'rounded-full' : categories.shape === 'rounded' ? 'rounded-md' : 'rounded-none'}`}
                    style={{ width: w, height: 40, backgroundColor: colors.secondary }}>
                    {categories.labelStyle === 'below' && <div className="h-1 w-4/5 mx-auto mt-1 rounded-full" style={{ backgroundColor: colors.navFg, opacity: 0.2 }} />}
                  </div>
                ))}
              </div>
            ) : categories.style === 'grid' && categories.columns === 3 ? (
              <div className="grid grid-cols-3 gap-1">
                {[...Array(3)].map((_,i) => (
                  <div key={i} className={`${categories.shape === 'circle' ? 'rounded-full aspect-square' : categories.shape === 'rounded' ? 'rounded-md' : 'rounded-none'}`}
                    style={{ height: 28, backgroundColor: colors.secondary }} />
                ))}
              </div>
            ) : categories.style === 'masonry' ? (
              <div className="grid grid-cols-2 gap-1">
                <div className="row-span-2 rounded-sm" style={{ height: 48, backgroundColor: colors.secondary }} />
                <div className="rounded-sm" style={{ height: 22, backgroundColor: colors.secondary, opacity: 0.7 }} />
                <div className="rounded-sm" style={{ height: 22, backgroundColor: colors.secondary, opacity: 0.5 }} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {[...Array(2)].map((_,i) => (
                  <div key={i} className={categories.shape === 'rounded' ? 'rounded-md' : 'rounded-none'}
                    style={{ height: 32, backgroundColor: colors.secondary, opacity: i === 0 ? 0.9 : 0.6 }} />
                ))}
              </div>
            )}
          </div>

          {/* Products */}
          <div className="px-2 pb-1">
            <div className="h-1 w-14 rounded-full mb-1.5" style={{ backgroundColor: colors.navFg, opacity: 0.12 }} />
            <div className="grid grid-cols-2 gap-1.5">
              {[...Array(4)].map((_,i) => (
                <div key={i} className={`overflow-hidden ${card.radius}`}
                  style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder || colors.navBorder}` }}>
                  <div className="h-14" style={{ backgroundColor: colors.secondary, opacity: 0.8 + i * 0.05 }} />
                  <div className="p-1 space-y-1">
                    <div className="h-1 rounded-full w-4/5" style={{ backgroundColor: colors.navFg, opacity: 0.15 }} />
                    <div className="h-1.5 rounded-full w-1/2" style={{ backgroundColor: colors.primary, opacity: 0.8 }} />
                    <div className={`h-3.5 w-full flex items-center justify-center ${buttons.radius}`}
                      style={{
                        backgroundColor: buttons.style === 'filled' ? colors.primary : 'transparent',
                        border: buttons.style !== 'ghost' ? `1px solid ${colors.primary}` : 'none',
                      }}>
                      <div className="h-0.5 w-5 rounded-full"
                        style={{ backgroundColor: buttons.style === 'filled' ? colors.primaryFg : colors.primary }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="h-8 flex items-center justify-center" style={{ backgroundColor: colors.footerBg }}>
            <span className="text-[8px] font-bold tracking-widest" style={{ color: colors.footerFg }}>FOOTER</span>
          </div>

          {/* Mobile bottom nav */}
          {nav.mobileBottom && (
            <div className="flex justify-around items-center py-1.5 border-t"
              style={{ backgroundColor: colors.navBg, borderColor: colors.navBorder || '#eee' }}>
              {(nav.mobileBottomItems || []).slice(0,5).map(item => (
                <div key={item} className="flex flex-col items-center gap-0.5">
                  <span className="text-[11px]">
                    {item==='home'?'🏠':item==='shop'?'👕':item==='cart'?'🛒':item==='wishlist'?'❤️':'👤'}
                  </span>
                  <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: colors.navFg, opacity: 0.3 }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-center text-[10px] text-gray-400 mt-2">معاينة الموبايل</p>
    </div>
  );
};

// ===== الـ Component الرئيسي =====
export default function ThemeBuilder({ adminSettings, bumpSettings, showToast, t, getLocalized }) {
  const loadSaved = () => {
    const saved = adminSettings?.current?.customTheme;
    if (saved?.colors) return saved;
    const presetId = adminSettings?.current?.activeTheme || DEFAULT_THEME_ID;
    return { ...(PRESETS[presetId] || PRESETS[DEFAULT_THEME_ID]) };
  };

  const [theme, setTheme] = useState(loadSaved);
  const [activePreset, setActivePreset] = useState(adminSettings?.current?.activeTheme || DEFAULT_THEME_ID);
  const [tab, setTab] = useState('presets');
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);

  const applyLive = useCallback((t) => {
    if (adminSettings?.current) {
      adminSettings.current.customTheme = t;
      adminSettings.current._liveTheme = t;
    }
    bumpSettings?.();
  }, [adminSettings, bumpSettings]);

  const update = useCallback((updater) => {
    setTheme(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => applyLive(next), 80);
      return next;
    });
    setActivePreset('custom');
  }, [applyLive]);

  const setColor = (k,v) => update(p => ({ ...p, colors: { ...p.colors, [k]: v } }));
  const setNav = (k,v) => update(p => ({ ...p, nav: { ...p.nav, [k]: v } }));
  const setBtn = (k,v) => update(p => ({ ...p, buttons: { ...p.buttons, [k]: v } }));
  const setCard = (k,v) => update(p => ({ ...p, card: { ...p.card, [k]: v } }));
  const setCat = (k,v) => update(p => ({ ...p, categories: { ...p.categories, [k]: v } }));
  const setFontFamily = (v) => update(p => ({ ...p, fontFamily: v }));

  // ===== رجّع أي قسم لوحده للوضع الافتراضي (بيانات ثيم "كلاسيك" الأصلي) =====
  // مبيبوظش أي قسم تاني ولا بيلغي الحفظ - لحد ما المستخدم يدوس "حفظ الثيم"
  const resetSection = (key) => {
    const def = PRESETS[DEFAULT_THEME_ID][key];
    update(p => ({ ...p, [key]: Array.isArray(def) ? [...def] : (def && typeof def === 'object') ? { ...def } : def }));
  };

  // ===== تحميل خطوط Google المستخدمة في الثيمات (لمعاينتها هنا في الأدمن) =====
  useEffect(() => {
    const id = 'lava-theme-fonts-preview';
    if (document.getElementById(id)) return;
    const families = FONT_OPTIONS.filter(f => f.google).map(f => `family=${f.google}`).join('&');
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    document.head.appendChild(link);
  }, []);

  const applyPreset = (id) => {
    const p = PRESETS[id]; if (!p) return;
    setTheme(p); setActivePreset(id); applyLive(p);
  };

  const toggleMobileItem = (item) => {
    const cur = theme.nav.mobileBottomItems || [];
    setNav('mobileBottomItems', cur.includes(item) ? cur.filter(i=>i!==item) : [...cur, item]);
  };
  const moveMobileItem = (idx, dir) => {
    const arr = [...(theme.nav.mobileBottomItems || [])];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setNav('mobileBottomItems', arr);
  };

  const toggleMobileTopItem = (item) => {
    const cur = theme.nav.mobileTopItems || [];
    if (cur.includes(item)) { setNav('mobileTopItems', cur.filter(i => i !== item)); return; }
    if (cur.length >= MOBILE_TOP_ITEMS_MAX) return; // حد أقصى 3 عناصر
    setNav('mobileTopItems', [...cur, item]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { settingsAPI } = await import('../api/settings');
      await settingsAPI.update({ activeTheme: activePreset, customTheme: theme });
      if (adminSettings?.current) {
        adminSettings.current.activeTheme = activePreset;
        adminSettings.current.customTheme = theme;
      }
      bumpSettings?.();
      showToast?.('✅ تم حفظ الثيم!');
    } catch { showToast?.('❌ فشل الحفظ، حاول تاني'); }
    finally { setSaving(false); }
  };

  const TABS = [
    { key: 'presets', icon: '🎨', label: 'ثيمات جاهزة' },
    { key: 'colors', icon: '🖌️', label: 'الألوان' },
    { key: 'fonts', icon: '🔤', label: 'الخطوط' },
    { key: 'nav', icon: '📱', label: 'الناف' },
    { key: 'elements', icon: '🃏', label: 'العناصر' },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">🎨 منشئ الثيمات</h2>
          <p className="text-gray-400 text-xs mt-0.5">غيّر شكل الموقع — التغيير فوري على كل الزوار بعد الحفظ</p>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-800 transition disabled:opacity-50">
          {saving ? '⏳ جاري...' : '💾 حفظ الثيم'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* ===== Editor ===== */}
        <div className="flex-1 space-y-3 min-w-0">
          {/* Tabs */}
          <div className="bg-white rounded-xl p-1.5 flex gap-1 overflow-x-auto shadow-sm">
            {TABS.map(tb => (
              <button key={tb.key} onClick={() => setTab(tb.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  tab === tb.key ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                {tb.icon} {tb.label}
              </button>
            ))}
          </div>

          {/* ===== Presets ===== */}
          {tab === 'presets' && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-sm font-bold text-gray-700 mb-4">اختار ثيم جاهز — تقدر تعدل عليه بعدين من تبويبات التاني</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {Object.values(PRESETS).map(p => {
                  const active = activePreset === p.id;
                  return (
                    <div key={p.id} onClick={() => applyPreset(p.id)}
                      className={`cursor-pointer rounded-xl border-2 overflow-hidden transition-all hover:shadow-md ${
                        active ? 'border-black ring-2 ring-black ring-offset-1' : 'border-gray-200 hover:border-gray-400'}`}>
                      {/* Color chips */}
                      <div className="p-2 space-y-1.5" style={{ backgroundColor: p.colors.bg }}>
                        <div className="h-8 rounded-md" style={{ backgroundColor: p.colors.navBg, border: `1px solid ${p.colors.navBorder}` }}>
                          <div className="h-full flex items-center justify-center">
                            <div className="w-6 h-1 rounded-full" style={{ backgroundColor: p.colors.navFg, opacity: 0.5 }} />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <div className="h-8 rounded" style={{ backgroundColor: p.colors.secondary }} />
                          <div className="h-8 rounded col-span-2" style={{ backgroundColor: p.colors.cardBg, border: `1px solid ${p.colors.cardBorder || '#eee'}` }}>
                            <div className="h-full flex items-end p-1">
                              <div className="w-full h-2 rounded-sm" style={{ backgroundColor: p.colors.primary }} />
                            </div>
                          </div>
                        </div>
                        <div className="h-4 rounded" style={{ backgroundColor: p.colors.footerBg }} />
                      </div>
                      <div className={`px-2 py-1.5 border-t ${active ? 'bg-black' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center gap-1">
                          <span className="text-sm">{p.emoji}</span>
                          <span className={`text-xs font-bold ${active ? 'text-white' : 'text-gray-800'}`}>{p.name.ar}</span>
                          {active && <span className="text-[10px] text-white font-bold mr-auto">✓ مفعّل</span>}
                        </div>
                        <p className={`text-[10px] mt-0.5 leading-tight ${active ? 'text-gray-300' : 'text-gray-400'}`}>{p.vibe}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {activePreset === 'custom' && (
                <div className="mt-3 p-3 bg-gray-50 rounded-xl border text-xs text-gray-500 text-center">
                  ✏️ أنت شغال على ثيم مخصص — مش محدد من القائمة فوق
                </div>
              )}
            </div>
          )}

          {/* ===== Colors ===== */}
          {tab === 'colors' && (
            <div className="bg-white rounded-xl shadow-sm p-5 space-y-5">
              <Section title="الألوان الرئيسية" onReset={() => resetSection('colors')}>
                <ColorRow label="اللون الأساسي (زرار، تشديد)" value={theme.colors.primary} onChange={v=>setColor('primary',v)} />
                <ColorRow label="نص على الأساسي" value={theme.colors.primaryFg} onChange={v=>setColor('primaryFg',v)} />
                <ColorRow label="Accent (شارات، عدد)" value={theme.colors.accent} onChange={v=>setColor('accent',v)} />
                <ColorRow label="خلفية الصفحة" value={theme.colors.bg} onChange={v=>setColor('bg',v)} />
                <ColorRow label="نص الصفحة (عناوين زي الأقسام، نبذة، الأسئلة الشائعة)" value={theme.colors.text?.startsWith('#') ? theme.colors.text : '#111827'} onChange={v=>setColor('text',v)} />
              </Section>
              <Section title="الناف">
                <ColorRow label="خلفية الناف" value={theme.colors.navBg} onChange={v=>setColor('navBg',v)} />
                <ColorRow label="نص وأيقونات الناف" value={theme.colors.navFg} onChange={v=>setColor('navFg',v)} />
                <ColorRow label="حدود الناف" value={theme.colors.navBorder?.startsWith('#') ? theme.colors.navBorder : '#eeeeee'} onChange={v=>setColor('navBorder',v)} />
              </Section>
              <Section title="الكروت">
                <ColorRow label="خلفية الكرت" value={theme.colors.cardBg} onChange={v=>setColor('cardBg',v)} />
                <ColorRow label="حدود الكرت" value={theme.colors.cardBorder?.startsWith('#') ? theme.colors.cardBorder : '#eeeeee'} onChange={v=>setColor('cardBorder',v)} />
                <ColorRow label="خلفية ثانوية (هيرو، أقسام)" value={theme.colors.secondary} onChange={v=>setColor('secondary',v)} />
                <ColorRow label="نص ثانوي" value={theme.colors.secondaryFg} onChange={v=>setColor('secondaryFg',v)} />
              </Section>
              <Section title="الفوتر">
                <ColorRow label="خلفية الفوتر" value={theme.colors.footerBg} onChange={v=>setColor('footerBg',v)} />
                <ColorRow label="نص الفوتر" value={theme.colors.footerFg} onChange={v=>setColor('footerFg',v)} />
                <ColorRow label="خلفية زرار «تسوق الآن» (صورة الهيرو)" value={theme.colors.heroButtonBg?.startsWith('#') ? theme.colors.heroButtonBg : '#ffffff'} onChange={v=>setColor('heroButtonBg',v)} />
                <ColorRow label="نص زرار «تسوق الآن» (صورة الهيرو)" value={theme.colors.heroButtonText?.startsWith('#') ? theme.colors.heroButtonText : '#000000'} onChange={v=>setColor('heroButtonText',v)} />
              </Section>
            </div>
          )}

          {/* ===== Fonts ===== */}
          {tab === 'fonts' && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <Section title="خط الموقع (عربي + إنجليزي)" onReset={() => setFontFamily(DEFAULT_FONT_ID)}>
                <p className="text-xs text-gray-400 pb-3">
                  بيتطبق على كل نصوص المتجر (العناوين، المنتجات، الأزرار...). التغيير بيظهر فوراً في المعاينة.
                </p>
              </Section>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {FONT_OPTIONS.map(f => {
                  const active = (theme.fontFamily || DEFAULT_FONT_ID) === f.id;
                  return (
                    <button key={f.id} onClick={() => setFontFamily(f.id)}
                      className={`text-right rounded-xl border-2 p-3.5 transition-all ${
                        active ? 'border-black ring-1 ring-black ring-offset-1 bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-gray-800">{f.name.ar}</span>
                        {active && <span className="text-[10px] font-bold">✓ مفعّل</span>}
                      </div>
                      <p className="text-lg leading-snug" style={{ fontFamily: f.stack }}>متجرك يبيع أحلى منتج</p>
                      <p className="text-sm text-gray-500 leading-snug" style={{ fontFamily: f.stack }}>Shop Now — Style {f.name.en}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== Nav ===== */}
          {tab === 'nav' && (
            <div className="bg-white rounded-xl shadow-sm p-5 space-y-5">

              {/* ── تخطيط الناف: بطاقات بصرية بدل dropdown ── */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">تخطيط الناف</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {NAV_LAYOUTS.map(opt => {
                    const active = theme.nav.layout === opt.value;
                    return (
                      <button key={opt.value} onClick={() => setNav('layout', opt.value)}
                        className={`rounded-xl border-2 overflow-hidden transition-all text-right ${active ? 'border-black ring-1 ring-black ring-offset-1' : 'border-gray-200 hover:border-gray-400'}`}>
                        {/* معاينة مصغرة للناف */}
                        <div className="h-10 flex items-center px-2.5"
                          style={{ backgroundColor: theme.colors.navBg, borderBottom: `1px solid ${theme.colors.navBorder || '#eee'}` }}>
                          {opt.value === 'centered-logo' && (
                            <>
                              <div className="flex gap-1.5 opacity-50" style={{ color: theme.colors.navFg }}>
                                <div className="w-1.5 h-1.5 rounded-full bg-current"/>
                                <div className="w-1.5 h-1.5 rounded-full bg-current"/>
                              </div>
                              <span className="mx-auto text-[8px] font-black tracking-widest" style={{ color: theme.colors.navFg }}>LOGO</span>
                              <div className="flex gap-1.5 opacity-50" style={{ color: theme.colors.navFg }}>
                                <div className="w-1.5 h-1.5 rounded-full bg-current"/>
                                <div className="w-1.5 h-1.5 rounded-full bg-current"/>
                              </div>
                            </>
                          )}
                          {opt.value === 'classic' && (
                            <>
                              <span className="text-[8px] font-black tracking-widest ml-1" style={{ color: theme.colors.navFg }}>LOGO</span>
                              <div className="flex gap-1.5 mx-2 flex-1 opacity-50" style={{ color: theme.colors.navFg }}>
                                {['Home','Shop','Contact'].map(l => <span key={l} className="text-[7px] font-semibold">{l}</span>)}
                              </div>
                              <div className="flex gap-1.5 opacity-50" style={{ color: theme.colors.navFg }}>
                                <div className="w-1.5 h-1.5 rounded-full bg-current"/>
                                <div className="w-1.5 h-1.5 rounded-full bg-current"/>
                              </div>
                            </>
                          )}
                          {opt.value === 'minimal' && (
                            <>
                              <span className="text-[8px] font-black tracking-widest flex-1" style={{ color: theme.colors.navFg }}>LOGO</span>
                              <div className="flex gap-1.5 opacity-50" style={{ color: theme.colors.navFg }}>
                                <div className="w-1.5 h-1.5 rounded-full bg-current"/>
                                <div className="w-3 h-0.5 bg-current my-auto"/>
                              </div>
                            </>
                          )}
                        </div>
                        <div className={`px-2.5 py-1.5 ${active ? 'bg-black' : 'bg-white'}`}>
                          <p className={`text-[11px] font-bold ${active ? 'text-white' : 'text-gray-800'}`}>{opt.label}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Section title="إعدادات الناف العلوي" onReset={() => resetSection('nav')}>
                <SelectRow label="ارتفاع الناف" value={theme.nav.height} options={NAV_HEIGHTS} onChange={v=>setNav('height',v)} />
                <ToggleRow label="خط سفلي" value={theme.nav.borderBottom} onChange={v=>setNav('borderBottom',v)} />
                <ToggleRow label="شفاف فوق الهيرو" value={theme.nav.transparent} onChange={v=>setNav('transparent',v)} />
              </Section>

              <Section title="الناف التحتاني (موبايل فقط)">
                <ToggleRow label="تفعيل الناف التحتاني" value={theme.nav.mobileBottom} onChange={v=>setNav('mobileBottom',v)} />
                {theme.nav.mobileBottom && (
                  <div className="mt-3 space-y-3 pt-2 border-t border-gray-100">
                    <p className="text-[11px] text-gray-400 font-medium">اختار الأيقونات اللي تظهر (الترتيب ده هو ترتيب الظهور):</p>
                    <div className="space-y-1.5">
                      {MOBILE_ITEMS.map(item => {
                        const selected = (theme.nav.mobileBottomItems||[]).includes(item);
                        const idx = (theme.nav.mobileBottomItems||[]).indexOf(item);
                        const total = (theme.nav.mobileBottomItems||[]).length;
                        return (
                          <div key={item} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors ${selected ? 'bg-gray-50 border border-gray-200' : 'border border-transparent'}`}>
                            {/* checkbox */}
                            <button onClick={() => toggleMobileItem(item)}
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected ? 'bg-black border-black' : 'border-gray-300 hover:border-gray-500'}`}>
                              {selected && <span className="text-white text-[10px] font-black">✓</span>}
                            </button>
                            {/* رقم الترتيب */}
                            {selected && (
                              <span className="text-[10px] font-bold text-gray-400 w-4 text-center flex-shrink-0">{idx+1}</span>
                            )}
                            <span className="text-sm font-medium flex-1">{MOBILE_LABELS[item]}</span>
                            {/* أسهم الترتيب */}
                            {selected && (
                              <div className="flex gap-1 flex-shrink-0">
                                <button disabled={idx===0} onClick={() => moveMobileItem(idx,-1)}
                                  className="w-6 h-6 flex items-center justify-center rounded-md bg-white border border-gray-200 disabled:opacity-30 hover:bg-gray-100 transition text-xs font-bold">↑</button>
                                <button disabled={idx===total-1} onClick={() => moveMobileItem(idx,1)}
                                  className="w-6 h-6 flex items-center justify-center rounded-md bg-white border border-gray-200 disabled:opacity-30 hover:bg-gray-100 transition text-xs font-bold">↓</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* معاينة الناف التحتاني */}
                    {(theme.nav.mobileBottomItems||[]).length > 0 && (
                      <div className="mt-2 rounded-xl overflow-hidden border border-gray-200">
                        <p className="text-[10px] text-gray-400 text-center pt-2">معاينة الناف التحتاني</p>
                        <div className="flex justify-around items-center py-2.5"
                          style={{ backgroundColor: theme.colors.navBg, color: theme.colors.navFg }}>
                          {(theme.nav.mobileBottomItems||[]).map(item => (
                            <div key={item} className="flex flex-col items-center gap-0.5">
                              <span className="text-xl">{item==='home'?'🏠':item==='shop'?'👕':item==='cart'?'🛒':item==='wishlist'?'❤️':'👤'}</span>
                              <span className="text-[9px] font-bold opacity-60">
                                {item==='home'?'الرئيسية':item==='shop'?'المتجر':item==='cart'?'العربة':item==='wishlist'?'المفضلة':'حسابي'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ===== أيقونات تفضل ظاهرة فوق في الناف العلوي كمان (موبايل) ===== */}
                    <div className="mt-4 space-y-2 pt-3 border-t border-gray-100">
                      <p className="text-[11px] text-gray-400 font-medium">
                        اختار لحد 3 أيقونات تفضل ظاهرة في الناف العلوي كمان على الموبايل (غير الناف التحتاني):
                      </p>
                      <div className="space-y-1.5">
                        {MOBILE_TOP_ITEMS.map(item => {
                          const selected = (theme.nav.mobileTopItems||[]).includes(item);
                          const disabled = !selected && (theme.nav.mobileTopItems||[]).length >= MOBILE_TOP_ITEMS_MAX;
                          return (
                            <div key={item} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors ${selected ? 'bg-gray-50 border border-gray-200' : 'border border-transparent'}`}>
                              <button onClick={() => toggleMobileTopItem(item)} disabled={disabled}
                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected ? 'bg-black border-black' : disabled ? 'border-gray-200 opacity-40 cursor-not-allowed' : 'border-gray-300 hover:border-gray-500'}`}>
                                {selected && <span className="text-white text-[10px] font-black">✓</span>}
                              </button>
                              <span className="text-sm font-medium flex-1">{MOBILE_LABELS[item]}</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-gray-400">
                        {(theme.nav.mobileTopItems||[]).length}/{MOBILE_TOP_ITEMS_MAX} مختارة
                      </p>
                    </div>
                  </div>
                )}
              </Section>

              {/* معاينة الناف العلوي */}
              <Section title="معاينة الناف العلوي">
                <div className="mt-2 rounded-xl overflow-hidden border border-gray-200" style={{ fontFamily: getFontOption(theme.fontFamily || DEFAULT_FONT_ID).stack }}>
                  <div className={`flex items-center justify-between px-4 ${theme.nav.height}`}
                    style={{ backgroundColor: theme.nav.transparent ? 'rgba(0,0,0,0.05)' : theme.colors.navBg, borderBottom: theme.nav.borderBottom ? `1px solid ${theme.colors.navBorder}` : 'none', color: theme.colors.navFg }}>
                    {theme.nav.layout === 'centered-logo' ? (
                      <>
                        <div className="flex gap-4 text-sm opacity-70"><span>👤</span><span>🛒</span></div>
                        <span className="font-black text-xl tracking-widest">LOGO</span>
                        <div className="flex gap-4 text-sm opacity-70"><span>المتجر</span><span>تواصل</span></div>
                      </>
                    ) : theme.nav.layout === 'minimal' ? (
                      <>
                        <span className="font-black text-xl">LOGO</span>
                        <div className="flex gap-3 text-lg opacity-70"><span>🛒</span><span>☰</span></div>
                      </>
                    ) : (
                      <>
                        <span className="font-black text-xl">LOGO</span>
                        <div className="flex gap-5 text-sm opacity-70 font-semibold"><span>الرئيسية</span><span>المتجر</span><span>تواصل</span></div>
                        <div className="flex gap-3 text-lg opacity-70"><span>👤</span><span>🛒</span></div>
                      </>
                    )}
                  </div>
                  <div className="h-10 flex items-center justify-center text-xs text-gray-300" style={{ backgroundColor: theme.colors.bg }}>← محتوى الصفحة →</div>
                </div>
              </Section>
            </div>
          )}

          {/* ===== Elements ===== */}
          {tab === 'elements' && (
            <div className="bg-white rounded-xl shadow-sm p-5 space-y-5">
              <Section title="شكل الأزرار" onReset={() => resetSection('buttons')}>
                <SelectRow label="حواف الزرار" value={theme.buttons.radius} options={BTN_RADIUS} onChange={v=>setBtn('radius',v)} />
                <SelectRow label="نمط الزرار" value={theme.buttons.style} options={BTN_STYLES} onChange={v=>setBtn('style',v)} />
                <div className="flex gap-2 pt-2">
                  <button className={`px-5 py-2 text-sm font-bold ${theme.buttons.radius}`}
                    style={{ backgroundColor: theme.buttons.style==='filled' ? theme.colors.primary : 'transparent', color: theme.buttons.style==='filled' ? theme.colors.primaryFg : theme.colors.primary, border: theme.buttons.style!=='ghost' ? `2px solid ${theme.colors.primary}` : 'none' }}>
                    أضف للعربة
                  </button>
                  <button className={`px-5 py-2 text-sm font-bold ${theme.buttons.radius} border-2`}
                    style={{ backgroundColor: 'transparent', color: theme.colors.primary, borderColor: theme.colors.primary }}>
                    المزيد
                  </button>
                </div>
              </Section>

              <Section title="شكل كروت المنتجات" onReset={() => resetSection('card')}>
                <SelectRow label="حواف الكرت" value={theme.card.radius} options={CARD_RADIUS} onChange={v=>setCard('radius',v)} />
                <SelectRow label="الظل" value={theme.card.shadow} options={CARD_SHADOWS} onChange={v=>setCard('shadow',v)} />
                <SelectRow label="تأثير hover" value={theme.card.hoverEffect} options={HOVER_EFFECTS} onChange={v=>setCard('hoverEffect',v)} />
                <SelectRow label="ارتفاع صورة المنتج" value={theme.card.imageHeight || 'h-48 md:h-80'} options={CARD_IMAGE_HEIGHT} onChange={v=>setCard('imageHeight',v)} />
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <p className="text-[11px] font-bold text-gray-400 mb-1">✍️ اسم وسعر المنتج</p>
                  <SelectRow label="حجم خط الاسم" value={theme.card.nameFontSize || 'text-sm md:text-xl'} options={CARD_NAME_FONT_SIZE} onChange={v=>setCard('nameFontSize',v)} />
                  <SelectRow label="حجم خط السعر" value={theme.card.priceFontSize || 'text-xs md:text-lg'} options={CARD_PRICE_FONT_SIZE} onChange={v=>setCard('priceFontSize',v)} />
                  <SelectRow label="الأبرز في الكارت" value={theme.card.priceEmphasis || 'price'} options={CARD_PRICE_EMPHASIS} onChange={v=>setCard('priceEmphasis',v)} />
                  <ColorRow label="لون السعر بعد الخصم" value={theme.card.saleColor || '#dc2626'} onChange={v=>setCard('saleColor',v)} />
                </div>
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <p className="text-[11px] font-bold text-gray-400 mb-1">🛍️ صفحة المتجر (Shop) — 📱 موبايل</p>
                  <SelectRow label="عدد الكروت في الصف" value={theme.card.colsMobile || 'grid-cols-2'} options={CARD_COLS_MOBILE} onChange={v=>setCard('colsMobile',v)} />
                  <SelectRow label="المسافة بين الكروت" value={theme.card.gapMobile || 'gap-4'} options={CARD_GAP_MOBILE} onChange={v=>setCard('gapMobile',v)} />
                </div>
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <p className="text-[11px] font-bold text-gray-400 mb-1">🛍️ صفحة المتجر (Shop) — 💻 كمبيوتر</p>
                  <SelectRow label="عدد الكروت في الصف" value={theme.card.colsDesktop || 'md:grid-cols-3'} options={CARD_COLS_DESKTOP} onChange={v=>setCard('colsDesktop',v)} />
                  <SelectRow label="المسافة بين الكروت" value={theme.card.gapDesktop || 'md:gap-8'} options={CARD_GAP_DESKTOP} onChange={v=>setCard('gapDesktop',v)} />
                </div>
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <p className="text-[11px] font-bold text-gray-400 mb-1">🏠 الصفحة الرئيسية (أقسام المنتجات) — 📱 موبايل</p>
                  <SelectRow label="عدد الكروت في الصف" value={theme.card.homeColsMobile || ''} options={CARD_HOME_COLS_MOBILE} onChange={v=>setCard('homeColsMobile',v)} />
                  <SelectRow label="المسافة بين الكروت" value={theme.card.homeGapMobile || ''} options={CARD_HOME_GAP_MOBILE} onChange={v=>setCard('homeGapMobile',v)} />
                </div>
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <p className="text-[11px] font-bold text-gray-400 mb-1">🏠 الصفحة الرئيسية (أقسام المنتجات) — 💻 كمبيوتر</p>
                  <SelectRow label="عدد الكروت في الصف" value={theme.card.homeColsDesktop || ''} options={CARD_HOME_COLS_DESKTOP} onChange={v=>setCard('homeColsDesktop',v)} />
                  <SelectRow label="المسافة بين الكروت" value={theme.card.homeGapDesktop || ''} options={CARD_HOME_GAP_DESKTOP} onChange={v=>setCard('homeGapDesktop',v)} />
                </div>
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <ToggleRow label="زرار «إضافة سريعة للسلة» على الكارت" value={!!theme.card.showQuickAdd} onChange={v=>setCard('showQuickAdd',v)} />
                  <p className="text-[10px] text-gray-400 mt-1">لو مفعّل، هيظهر زرار "إضافة سريعة" أسفل صورة المنتج في المتجر والصفحة الرئيسية — بيفتح نافذة سريعة لاختيار اللون/المقاس ثم الإضافة للسلة من غير الدخول لصفحة المنتج.</p>
                  {theme.card.showQuickAdd && (
                    <div className="mt-2">
                      <ColorRow label="خلفية الزرار" value={theme.card.quickAddBg?.startsWith('#') ? theme.card.quickAddBg : '#000000'} onChange={v=>setCard('quickAddBg',v)} />
                      <ColorRow label="لون كتابة الزرار" value={theme.card.quickAddText?.startsWith('#') ? theme.card.quickAddText : '#ffffff'} onChange={v=>setCard('quickAddText',v)} />
                    </div>
                  )}
                </div>
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <p className="text-[11px] font-bold text-gray-400 mb-1">🏷️ شارة نسبة الخصم</p>
                  <p className="text-[10px] text-gray-400 mb-1">تظهر تلقائياً (زي "-46%") في صورة الكارت لما يكون فيه خصم فعّال — من غير تحكم تفعيل/تعطيل لأنها مرتبطة مباشرة بوجود خصم.</p>
                  <ColorRow label="خلفية الشارة" value={theme.card.discountBadgeBg?.startsWith('#') ? theme.card.discountBadgeBg : '#dc2626'} onChange={v=>setCard('discountBadgeBg',v)} />
                  <ColorRow label="لون كتابة الشارة" value={theme.card.discountBadgeText?.startsWith('#') ? theme.card.discountBadgeText : '#ffffff'} onChange={v=>setCard('discountBadgeText',v)} />
                </div>
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <ToggleRow label="نقط الألوان المتاحة تحت الكارت" value={!!theme.card.showColorDots} onChange={v=>setCard('showColorDots',v)} />
                  <p className="text-[10px] text-gray-400 mt-1">لو مفعّل، هتظهر دوائر صغيرة بألوان المنتج المتاحة تحت اسم/سعر المنتج في كل الكروت.</p>
                </div>
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <ToggleRow label="شارة «كمية محدودة» على صورة الكارت" value={!!theme.card.showLowStockBadge} onChange={v=>setCard('showLowStockBadge',v)} />
                  <p className="text-[10px] text-gray-400 mt-1">لو مفعّل، هتظهر شارة برتقالية على صورة الكارت لما مخزون المنتج يبقى منخفض (بالإضافة للنص الموجود تحت السعر في صفحة المتجر).</p>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {[1,2,3].map(i => (
                    <div key={i} className={`overflow-hidden ${theme.card.radius} ${theme.card.shadow} cursor-pointer transition-all
                      ${theme.card.hoverEffect==='scale'?'hover:scale-105':theme.card.hoverEffect==='lift'?'hover:-translate-y-1':''}`}
                      style={{ backgroundColor: theme.colors.cardBg, border: `1px solid ${theme.colors.cardBorder||theme.colors.navBorder||'#eee'}` }}>
                      <div className="h-16" style={{ backgroundColor: theme.colors.secondary }} />
                      <div className="p-2 space-y-1.5">
                        <div className="h-1.5 rounded-full w-full" style={{ backgroundColor: theme.colors.secondaryFg, opacity: 0.15 }} />
                        <div className="h-2 rounded-full w-2/3" style={{ backgroundColor: theme.colors.primary }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="شكل الأقسام (Categories)" onReset={() => resetSection('categories')}>
                <SelectRow label="نمط العرض" value={theme.categories?.style||'grid'} options={CAT_STYLES} onChange={v=>setCat('style',v)} />
                <SelectRow label="شكل الصورة" value={theme.categories?.shape||'rounded'} options={CAT_SHAPES} onChange={v=>setCat('shape',v)} />
                <SelectRow label="ظهور الاسم" value={theme.categories?.showLabel||'always'} options={CAT_SHOW_LABEL} onChange={v=>setCat('showLabel',v)} />
                <SelectRow label="مكان الاسم" value={theme.categories?.labelStyle||'overlay'} options={CAT_LABEL_STYLES} onChange={v=>setCat('labelStyle',v)} />
                <div className="mt-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-600">
                  💡 تغيير شكل الأقسام بيأثر على صفحة الرئيسية — محتاج الكود يستخدم <code>theme.categories</code> عشان يتطبق
                </div>
              </Section>
            </div>
          )}
        </div>

        {/* ===== Mobile Preview ===== */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm p-4 sticky top-4">
            <MobilePreview theme={theme} />
            <div className="mt-3 p-2.5 bg-gray-50 rounded-lg text-center">
              <p className="text-[10px] text-gray-400">الثيم الحالي</p>
              <p className="font-bold text-sm mt-0.5">
                {activePreset === 'custom' ? '✏️ مخصص' : `${PRESETS[activePreset]?.emoji||''} ${PRESETS[activePreset]?.name?.ar||''}`}
              </p>
            </div>
            <button onClick={save} disabled={saving}
              className="w-full mt-2 bg-black text-white py-2.5 rounded-xl font-bold text-sm hover:bg-gray-800 transition disabled:opacity-50">
              {saving ? '⏳' : '💾 حفظ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}