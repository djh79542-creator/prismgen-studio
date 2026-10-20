import React from 'react';
import { useTranslation } from '../i18n/provider';

const LocaleToggle: React.FC = () => {
  const { language, changeLanguage } = useTranslation();

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'zh' : 'en';
    changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="py-2 px-3 text-sm font-semibold text-[var(--text-primary)] bg-[rgba(107,114,128,0.2)] rounded-md hover:bg-[rgba(107,114,128,0.4)] transition-colors duration-200"
      aria-label="Switch language"
    >
      {language === 'en' ? 'CN' : 'EN'}
    </button>
  );
};

export default LocaleToggle;
