import { useEffect, useRef, useState } from 'react'
import { Input } from '~/components/ui/input'
import { cn } from '~/lib/utils'

export interface InlineTitleProps {
  idBase: string
  title: string
  kindLabel: 'la section' | 'le contenu'
  editing: boolean
  initialDraft?: string
  errorMessage?: string | null
  onStartEdit(): void
  onCancel(): void
  onSubmit(value: string): void
  titleClassName?: string
}

const REQUIRED_MESSAGE = 'Le titre est obligatoire.'

/**
 * Controlled inline title editor (D-04). The page owns `editing` and saving;
 * `initialDraft` lets it show back a draft kept after a conflict (D-09).
 */
export function InlineTitle({
  idBase,
  title,
  kindLabel,
  editing,
  initialDraft,
  errorMessage,
  onStartEdit,
  onCancel,
  onSubmit,
  titleClassName,
}: InlineTitleProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  // Set by Enter/Escape only: after a blur exit, focus already went where the teacher chose.
  const refocusOnExit = useRef(false)

  // Back to read mode after a keyboard exit: return focus to the title button.
  useEffect(() => {
    if (!editing && refocusOnExit.current) {
      refocusOnExit.current = false
      buttonRef.current?.focus()
    }
  }, [editing])

  if (!editing) {
    return (
      <button
        ref={buttonRef}
        type="button"
        id={`${idBase}-title`}
        aria-label={`Renommer ${kindLabel} « ${title} »`}
        onClick={onStartEdit}
        className={cn(
          'truncate rounded-sm text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          titleClassName
        )}
      >
        {title}
      </button>
    )
  }

  return (
    <TitleInput
      idBase={idBase}
      title={title}
      initialValue={initialDraft ?? title}
      errorMessage={errorMessage}
      onCancel={onCancel}
      onSubmit={onSubmit}
      onKeyboardExit={() => {
        refocusOnExit.current = true
      }}
    />
  )
}

interface TitleInputProps {
  idBase: string
  title: string
  initialValue: string
  errorMessage?: string | null
  onCancel(): void
  onSubmit(value: string): void
  onKeyboardExit(): void
}

/** Mounted per edit session, so its local value starts from the draft each time. */
function TitleInput({
  idBase,
  title,
  initialValue,
  errorMessage,
  onCancel,
  onSubmit,
  onKeyboardExit,
}: TitleInputProps) {
  const [value, setValue] = useState(initialValue)
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Set once Enter/Escape has decided, so the blur that follows unmount is ignored.
  const settled = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = (byKeyboard: boolean) => {
    const trimmed = value.trim()
    if (trimmed === '') {
      setLocalError(REQUIRED_MESSAGE)
      return
    }
    settled.current = true
    if (byKeyboard) onKeyboardExit()
    onSubmit(trimmed)
  }

  const cancel = (byKeyboard: boolean) => {
    settled.current = true
    if (byKeyboard) onKeyboardExit()
    onCancel()
  }

  const error = localError ?? errorMessage ?? null
  const errorId = `${idBase}-title-error`
  const inputId = `${idBase}-title-input`

  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={inputId} className="sr-only">
        Titre
      </label>
      <Input
        ref={inputRef}
        id={inputId}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          setValue(e.target.value)
          setLocalError(null)
          settled.current = false // the page may keep the editor open (conflict)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit(true)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            cancel(true)
          }
        }}
        onBlur={() => {
          if (settled.current) return
          // Compared with the saved title, so a kept conflict draft is still sent.
          if (value.trim() !== title) submit(false)
          else cancel(false)
        }}
        className="h-8"
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
