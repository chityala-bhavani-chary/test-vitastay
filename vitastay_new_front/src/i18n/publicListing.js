/**
 * BIC-036 — public listing chrome (EN default + HI). ERP stays English.
 * Lightweight dictionary — full i18next can replace later for more locales.
 */

const STRINGS = {
  en: {
    photos: 'Photos',
    about: 'About this PG',
    bedsLeft: (n) => (n > 0 ? `${n} beds left` : 'No vacant beds listed right now'),
    fromRent: (amount) => `From ${amount} / month`,
    askPrice: 'Ask for price',
    language: 'Language',
    english: 'English',
    hindi: 'हिन्दी',
    shareWhatsApp: 'Share on WhatsApp',
    copyLink: 'Copy link',
    previewOnly: 'Preview only — seekers cannot see this listing until you publish. This page is not indexed.',
    aiDescription: 'This description was drafted with AI and approved by the PG.',
    amenities: 'Amenities',
    securityDeposit: 'Security deposit',
    noticePeriod: 'Notice period',
  },
  hi: {
    photos: 'फ़ोटो',
    about: 'इस पीजी के बारे में',
    bedsLeft: (n) => (n > 0 ? `${n} बेड उपलब्ध` : 'अभी खाली बेड सूचीबद्ध नहीं'),
    fromRent: (amount) => `${amount} / महीना से`,
    askPrice: 'कीमत पूछें',
    language: 'भाषा',
    english: 'English',
    hindi: 'हिन्दी',
    shareWhatsApp: 'व्हाट्सऐप पर शेयर करें',
    copyLink: 'लिंक कॉपी करें',
    previewOnly: 'केवल पूर्वावलोकन — प्रकाशित होने तक साधक यह लिस्टिंग नहीं देख सकते।',
    aiDescription: 'यह विवरण AI से तैयार किया गया और पीजी ने स्वीकृत किया।',
    amenities: 'सुविधाएँ',
    securityDeposit: 'सिक्योरिटी डिपॉज़िट',
    noticePeriod: 'नोटिस अवधि',
  },
};

export const PUBLIC_LOCALES = ['en', 'hi'];

export const tPublic = (locale, key, ...args) => {
  const dict = STRINGS[locale] || STRINGS.en;
  const value = dict[key] ?? STRINGS.en[key] ?? key;
  return typeof value === 'function' ? value(...args) : value;
};

export const localizedHostelText = (hostel, locale) => {
  const hi = locale === 'hi';
  return {
    name: (hi && hostel?.name_hi) || hostel?.name || '',
    description: (hi && hostel?.description_hi) || hostel?.description || '',
  };
};

export const readStoredLocale = () => {
  try {
    const raw = localStorage.getItem('vs_listing_locale');
    if (raw === 'hi' || raw === 'en') return raw;
  } catch {
    /* ignore */
  }
  return 'en';
};

export const storeLocale = (locale) => {
  try {
    localStorage.setItem('vs_listing_locale', locale === 'hi' ? 'hi' : 'en');
  } catch {
    /* ignore */
  }
};
