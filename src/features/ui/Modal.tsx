import type { ReactNode } from 'react'

export function Modal({
  title,
  onClose,
  children,
  footer,
  overlay,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  overlay?: ReactNode
}) {
  return (
    <div
      className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[85svh] w-full max-w-[24rem] flex-col rounded-2xl border border-stone-700 bg-stone-900 pb-4"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-2 pl-4 pr-2.5 pt-2.5">
          <h3 className="min-w-0 flex-1 truncate font-serif text-lg leading-8 text-amber-100" title={title}>
            {title}
          </h3>
          <button
            type="button"
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg leading-none text-stone-400 hover:bg-stone-800 hover:text-stone-100"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-4">{children}</div>
        {overlay ? (
          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-2xl">{overlay}</div>
        ) : null}
        {footer ? <div className="mt-4 px-4">{footer}</div> : null}
      </div>
    </div>
  )
}
