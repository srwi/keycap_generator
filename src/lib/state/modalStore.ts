import { writable } from 'svelte/store'

export type MessageModalData = {
  type: 'message'
  message: string
}

export type ConfirmModalData = {
  type: 'confirm'
  message: string
  onConfirm: () => void
  onCancel?: () => void
}

export type ModalData = MessageModalData | ConfirmModalData | null

export const modalStore = writable<ModalData>(null)

export function showMessage(message: string) {
  modalStore.set({ type: 'message', message })
}

export function showConfirm(message: string, onConfirm: () => void, onCancel?: () => void) {
  modalStore.set({ type: 'confirm', message, onConfirm, onCancel })
}

export function closeModal() {
  modalStore.set(null)
}
