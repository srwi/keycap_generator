export function clickOutside(node: HTMLElement, onOutside: () => void) {
  const handle = (ev: MouseEvent) => {
    const target = ev.target as Node | null
    if (!target) return
    if (node.contains(target)) return
    onOutside()
  }

  document.addEventListener('mousedown', handle, true)
  return {
    destroy() {
      document.removeEventListener('mousedown', handle, true)
    },
  }
}
