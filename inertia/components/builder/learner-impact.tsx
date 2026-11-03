import { useEffect, useRef, useState } from 'react'

/**
 * The delete dialogs' learner count: fetched each time the dialog opens, so the
 * teacher sees how many learners lose their progress before confirming.
 */
export function LearnerImpact({
  open,
  load,
  subject,
}: {
  open: boolean
  load: () => Promise<number>
  /** What is deleted, e.g. "ce contenu". */
  subject: string
}) {
  const [state, setState] = useState<number | 'loading' | 'error'>('loading')
  // The parent rebuilds `load` on every render; only a new opening should refetch.
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    if (!open) return
    let live = true
    setState('loading')
    loadRef.current().then(
      (n) => live && setState(n),
      () => live && setState('error')
    )
    return () => {
      live = false
    }
  }, [open])

  let text: React.ReactNode
  if (state === 'loading') text = 'Calcul de la progression des apprenants concernés…'
  else if (state === 'error')
    text = `La progression des apprenants sur ${subject} sera supprimée (nombre d'apprenants concernés indisponible).`
  else if (state === 0) text = `Aucune progression des apprenants n'est enregistrée sur ${subject}.`
  else
    text = (
      <>
        La progression des apprenants sur {subject} sera supprimée :{' '}
        <strong>
          {state} apprenant{state > 1 ? 's' : ''} concerné{state > 1 ? 's' : ''}
        </strong>
        .
      </>
    )

  return (
    <p role="status" className="text-sm text-muted-foreground">
      {text}
    </p>
  )
}
