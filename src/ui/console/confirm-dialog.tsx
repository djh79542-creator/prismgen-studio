import React, { useState } from 'react'
import type { ConfirmOverlayProps } from './confirm-dialog.types'
import styles from './confirm-dialog.module.css'

const showSimpleToast = (message: string, isError: boolean = false) => {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 20px;
    background: ${isError ? '#d62a2a' : '#fd9db4'};
    color: white;
    border-radius: 4px;
    z-index: 10000;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    min-width: 100px;
    text-align: center;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 1000);
};

const ConfirmOverlay: React.FC<ConfirmOverlayProps> = ({
  open,
  title = '确认操作',
  content,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  if (!open) return null
    const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    showSimpleToast('操作成功');
    try {
      await onConfirm?.();
    } catch ( error){
      showSimpleToast('操作失败',true);
    }finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className={styles.backdrop}>
      <div className={styles.modal} role="dialog" aria-modal>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.content}>{content}</p>
        <div className={styles.actions}>
          <button className={styles.cancel} onClick={onCancel}>
            {cancelText}
          </button>
          <button
              className={styles.confirm}
              onClick={handleConfirm}
              disabled={isSubmitting}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmOverlay
