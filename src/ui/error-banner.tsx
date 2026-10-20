import React from 'react';
import { useTranslation } from '../i18n/provider';

interface FailureNoticeProps {
  message: string;
}

const FailureNotice: React.FC<FailureNoticeProps> = ({ message }) => {
  const { t } = useTranslation();
  const displayMessage = message && message.includes('.') ? t(message) : message;
  return (
    <div className="w-full max-w-lg p-4 bg-[var(--bg-error)] border border-[var(--border-error)] text-[var(--text-error)] rounded-lg text-center" role="alert">
      <p className="font-bold">{t('failure.title')}</p>
      <p className="text-sm">{displayMessage}</p>
    </div>
  );
};

export default FailureNotice;