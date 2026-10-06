import type { ReactNode } from 'react'

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div
      className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-4"
      onMouseDown={onClose}
    >
      <div
        className="relative flex max-h-[85svh] w-full max-w-[24rem] flex-col rounded-2xl border border-stone-700 bg-stone-900 p-4 pt-11"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full text-lg leading-none text-stone-400 hover:bg-stone-800 hover:text-stone-100"
          onClick={onClose}
        >
          ×
        </button>
        <h3 className="font-serif text-lg text-amber-100">{title}</h3>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="mt-4">{footer}</div> : null}
      </div>
    </div>
  )
}
