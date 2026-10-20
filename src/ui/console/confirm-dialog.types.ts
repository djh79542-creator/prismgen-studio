export interface ConfirmOverlayProps {
  open: boolean
  title?: string
  content: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}
