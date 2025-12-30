/**
 * ConfirmModal
 * 
 * Reusable confirmation dialog component.
 * Displays a modal overlay with title, message, and confirm/cancel buttons.
 * 
 * @param {Object} props
 * @param {string} props.title - Modal title
 * @param {string} props.message - Main message/description
 * @param {string} props.confirmLabel - Label for confirm button (default: "Confirm")
 * @param {string} props.cancelLabel - Label for cancel button (default: "Cancel")
 * @param {string} props.variant - Button variant: "danger" | "warning" | "default" (default: "default")
 * @param {function} props.onConfirm - Called when user confirms
 * @param {function} props.onCancel - Called when user cancels or clicks overlay
 * @param {boolean} props.isLoading - If true, buttons are disabled and confirm shows loading
 * @param {React.ReactNode} props.children - Optional content to render between message and buttons
 */

import styles from './ConfirmModal.module.css';

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
  isLoading = false,
  children,
}) {
  // Get variant-specific class for confirm button
  const confirmBtnClass = {
    danger: styles.confirmBtnDanger,
    warning: styles.confirmBtnWarning,
    default: styles.confirmBtnDefault,
  }[variant] || styles.confirmBtnDefault;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{title}</h2>
        
        {message && (
          <p className={styles.message}>{message}</p>
        )}

        {children && (
          <div className={styles.content}>{children}</div>
        )}

        <div className={styles.actions}>
          <button 
            className={styles.cancelBtn} 
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button 
            className={`${styles.confirmBtn} ${confirmBtnClass}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
