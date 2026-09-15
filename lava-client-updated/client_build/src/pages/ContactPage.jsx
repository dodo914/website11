import { InputField, TextareaField } from '../components/SharedFields';

// ========== صفحة التواصل ==========
// اتفصلت من App.jsx عشان تتحمّل (lazy) بس لما الزائر يدخل صفحة "تواصل معنا"،
// مش مع كل صفحات الموقع من البداية.
export default function ContactPage({
  t,
  language,
  handleContactSubmit,
  contactName,
  setContactName,
  contactPhone,
  setContactPhone,
  contactMsg,
  setContactMsg,
}) {
  return (
    <section className={`py-16 px-6 md:px-12 max-w-3xl mx-auto ${language === 'ar' ? 'text-right' : 'text-left'} fade-in`}>
      <h2 className="text-4xl font-bold mb-10 text-center">{t('تواصل معنا', 'Contact Us')}</h2>
      <form className="bg-[var(--lava-card)] p-8 rounded-lg shadow-md space-y-6" onSubmit={handleContactSubmit}>
        <InputField label={t('الاسم بالكامل', 'Full Name')} type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} required={true} id="contactName" />
        <InputField label={t('رقم التليفون', 'Phone')} type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required={true} id="contactPhone" />
        <TextareaField label={t('الرسالة', 'Message')} value={contactMsg} onChange={(e) => setContactMsg(e.target.value)} placeholder={t('اكتب رسالتك هنا...', 'Write your message...')} required={true} rows={4} id="contactMsg" />
        <button type="submit" className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition">{t('إرسال', 'Send')}</button>
      </form>
    </section>
  );
}