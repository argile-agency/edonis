import { useEffect, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { Search } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'

interface HeaderSearchProps {
  variant: 'bar' | 'panel'
  onOpenChange?: (open: boolean) => void
}

export function HeaderSearch({ variant, onOpenChange }: HeaderSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  useEffect(() => router.on('navigate', () => setOpen(false)), [])

  useEffect(() => {
    onOpenChange?.(open)
    if (open) inputRef.current?.focus()
    else if (returnFocus.current) {
      returnFocus.current = false
      buttonRef.current?.focus()
    }
  }, [open])

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const value = query.trim()
    if (!value) return
    router.get('/courses', { search: value })
    setOpen(false)
  }

  const isPanel = variant === 'panel'

  if (!isPanel && !open) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={buttonRef}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            aria-label="Rechercher des cours"
            aria-expanded={open}
            aria-controls="header-search"
            onClick={() => setOpen(true)}
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Rechercher des cours</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <form
      role="search"
      id={isPanel ? 'header-search-mobile' : 'header-search'}
      onSubmit={submit}
      className={isPanel ? 'flex w-full items-center' : 'flex items-center'}
    >
      <Input
        ref={isPanel ? undefined : inputRef}
        type="search"
        name="search"
        aria-label="Rechercher des cours"
        placeholder="Rechercher un cours…"
        maxLength={100}
        className={isPanel ? 'h-9 w-full rounded-full' : 'h-9 w-48 rounded-full'}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={
          isPanel
            ? undefined
            : (e) => {
                if (e.key !== 'Escape') return
                e.preventDefault()
                returnFocus.current = true
                setOpen(false)
              }
        }
        onBlur={isPanel ? undefined : () => !query.trim() && !returnFocus.current && setOpen(false)}
      />
    </form>
  )
}
