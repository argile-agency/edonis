import { useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'

// The server enum on POST /edit-mode accepts only these three origins.
const FROM_BY_COMPONENT = {
  'courses/show': 'show',
  'courses/learn': 'learn',
  'courses/builder': 'builder',
} as const

export function EditModeSwitch({ id }: { id: string }) {
  const { props, component } = usePage<{
    editMode: boolean
    courseEditing?: { courseId: number; canEdit: boolean }
  }>()
  const [processing, setProcessing] = useState(false)

  if (props.courseEditing?.canEdit !== true) return null
  if (!Object.hasOwn(FROM_BY_COMPONENT, component)) return null
  const from = FROM_BY_COMPONENT[component as keyof typeof FROM_BY_COMPONENT]
  const courseId = props.courseEditing.courseId

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-sm font-normal whitespace-nowrap cursor-pointer">
        Mode d'édition
      </Label>
      <Switch
        id={id}
        checked={props.editMode}
        disabled={processing}
        aria-busy={processing || undefined}
        onCheckedChange={(next) =>
          router.post(
            '/edit-mode',
            { enabled: next, courseId, from },
            {
              preserveScroll: true,
              onStart: () => setProcessing(true),
              onFinish: () => setProcessing(false),
            }
          )
        }
      />
    </div>
  )
}
