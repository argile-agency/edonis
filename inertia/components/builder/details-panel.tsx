import { useEffect, useRef, useState } from 'react'
import { datePatch } from '~/lib/builder_tree'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import { Textarea } from '~/components/ui/textarea'

export interface DetailsValues {
  description: string | null
  isPublished: boolean
  availableFrom: string | null
  availableUntil: string | null
}

export interface DetailsPanelProps {
  idBase: string
  kind: 'section' | 'content'
  values: DetailsValues
  errorMessage?: string | null
  onSave(patch: Partial<DetailsValues>): void
}

const DATE_ORDER_MESSAGE = 'La date de fin doit être postérieure à la date de début.'

/** ISO (or yyyy-MM-dd) → yyyy-MM-dd for <input type="date">. */
const toDateInput = (value: string | null) => value?.slice(0, 10) ?? ''

type Field = 'description' | 'from' | 'until'

/**
 * Details of a section or content (D-04). A field the teacher has typed in keeps
 * its local value, so a conflict never overwrites what was typed (D-09); untouched
 * fields follow `values` (reload, re-sync, bulk edits). Only changed fields are
 * sent, so a stale untouched field never overwrites a colleague's change.
 * The disclosure button lives in the row (05-06).
 */
export function DetailsPanel({ idBase, values, errorMessage, onSave }: DetailsPanelProps) {
  const [description, setDescription] = useState(values.description ?? '')
  const [from, setFrom] = useState(toDateInput(values.availableFrom))
  const [until, setUntil] = useState(toDateInput(values.availableUntil))
  const [dateError, setDateError] = useState<string | null>(null)
  const touched = useRef<Set<Field>>(new Set())
  // Last values sent (or seeded), so a blur without change does not save again.
  const sent = useRef({
    description: values.description ?? '',
    from: toDateInput(values.availableFrom),
    until: toDateInput(values.availableUntil),
  })

  // A typed field is kept while unsaved (or held back) and while a save error shows;
  // once saved it follows `values` again, so a colleague's later change is shown.
  const reseed = (field: Field, local: string, value: string, set: (value: string) => void) => {
    if (touched.current.has(field) && (local !== sent.current[field] || errorMessage)) return
    touched.current.delete(field)
    sent.current[field] = value
    set(value)
  }
  useEffect(
    () => reseed('description', description, values.description ?? '', setDescription),
    [values.description]
  )
  useEffect(
    () => reseed('from', from, toDateInput(values.availableFrom), setFrom),
    [values.availableFrom]
  )
  useEffect(
    () => reseed('until', until, toDateInput(values.availableUntil), setUntil),
    [values.availableUntil]
  )

  const commitDescription = () => {
    if (description === sent.current.description) return
    sent.current.description = description
    onSave({ description: description.trim() === '' ? null : description })
  }

  const commitDates = () => {
    const patch = datePatch({ from, until }, sent.current)
    if (!patch) {
      setDateError(DATE_ORDER_MESSAGE)
      return
    }
    setDateError(null)
    if (Object.keys(patch).length === 0) return
    sent.current.from = from
    sent.current.until = until
    onSave(patch)
  }

  const errorId = `${idBase}-panel-error`
  const dateErrorId = `${idBase}-dates-error`

  return (
    <div id={`${idBase}-panel`} className="space-y-4 rounded-md border bg-muted/30 p-4">
      <div className="space-y-2">
        <Label htmlFor={`${idBase}-description`}>Description</Label>
        <Textarea
          id={`${idBase}-description`}
          value={description}
          rows={3}
          aria-describedby={errorMessage ? errorId : undefined}
          onChange={(e) => {
            touched.current.add('description')
            setDescription(e.target.value)
          }}
          onBlur={commitDescription}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id={`${idBase}-published`}
          checked={values.isPublished}
          onCheckedChange={(checked) => onSave({ isPublished: checked })}
        />
        <Label htmlFor={`${idBase}-published`}>Publié</Label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idBase}-available-from`}>Disponible à partir du</Label>
          <Input
            id={`${idBase}-available-from`}
            type="date"
            value={from}
            aria-invalid={dateError ? true : undefined}
            aria-describedby={dateError ? dateErrorId : undefined}
            onChange={(e) => {
              touched.current.add('from')
              setFrom(e.target.value)
            }}
            onBlur={commitDates}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idBase}-available-until`}>Disponible jusqu'au</Label>
          <Input
            id={`${idBase}-available-until`}
            type="date"
            value={until}
            aria-invalid={dateError ? true : undefined}
            aria-describedby={dateError ? dateErrorId : undefined}
            onChange={(e) => {
              touched.current.add('until')
              setUntil(e.target.value)
            }}
            onBlur={commitDates}
          />
        </div>
      </div>
      {dateError && (
        <p id={dateErrorId} className="text-sm text-destructive">
          {dateError}
        </p>
      )}

      {errorMessage && (
        <p id={errorId} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
