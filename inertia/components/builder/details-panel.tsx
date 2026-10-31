import { useRef, useState } from 'react'
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
const orNull = (value: string) => (value === '' ? null : value)

/**
 * Details of a section or content (D-04). Local state is seeded from `values`
 * on mount only, so a conflict never overwrites what the teacher typed (D-09).
 * The disclosure button lives in the row (05-06).
 */
export function DetailsPanel({ idBase, values, errorMessage, onSave }: DetailsPanelProps) {
  const [description, setDescription] = useState(values.description ?? '')
  const [isPublished, setIsPublished] = useState(values.isPublished)
  const [from, setFrom] = useState(toDateInput(values.availableFrom))
  const [until, setUntil] = useState(toDateInput(values.availableUntil))
  const [dateError, setDateError] = useState<string | null>(null)
  // Last values sent, so a blur without change does not save again.
  const sent = useRef({
    description: values.description ?? '',
    from: toDateInput(values.availableFrom),
    until: toDateInput(values.availableUntil),
  })

  const commitDescription = () => {
    if (description === sent.current.description) return
    sent.current.description = description
    onSave({ description: description.trim() === '' ? null : description })
  }

  const commitDates = (nextFrom: string, nextUntil: string) => {
    if (nextFrom !== '' && nextUntil !== '' && nextFrom > nextUntil) {
      setDateError(DATE_ORDER_MESSAGE)
      return
    }
    setDateError(null)
    if (nextFrom === sent.current.from && nextUntil === sent.current.until) return
    sent.current.from = nextFrom
    sent.current.until = nextUntil
    // Both sent together: a date held back by the order check goes out once fixed.
    onSave({ availableFrom: orNull(nextFrom), availableUntil: orNull(nextUntil) })
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
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commitDescription}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id={`${idBase}-published`}
          checked={isPublished}
          onCheckedChange={(checked) => {
            setIsPublished(checked)
            onSave({ isPublished: checked })
          }}
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
            onChange={(e) => setFrom(e.target.value)}
            onBlur={() => commitDates(from, until)}
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
            onChange={(e) => setUntil(e.target.value)}
            onBlur={() => commitDates(from, until)}
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
