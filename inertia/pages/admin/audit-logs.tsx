import { Head, Link, router } from '@inertiajs/react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { ArrowLeft, Search, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react'
import AppHeader from '~/components/layout/app-header'

interface AuditLogEntry {
  id: number
  userId: number | null
  action: string
  resourceType: string
  resourceId: string | null
  ipAddress: string | null
  userAgent: string | null
  metadata: Record<string, any> | null
  createdAt: string
  user?: {
    id: number
    fullName: string | null
    email: string
  } | null
}

interface PaginationMeta {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
  firstPage: number
}

interface Props {
  logs: {
    meta: PaginationMeta
    data: AuditLogEntry[]
  }
  filters: {
    action: string
    userId: string
    resourceType: string
    dateFrom: string
    dateTo: string
  }
  actionOptions: string[]
  resourceTypeOptions: string[]
  auth: { user: any }
  appSettings: any
  menus: any
}

function actionBadgeVariant(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (action.includes('delete') || action.includes('destroy')) return 'destructive'
  if (action.includes('create') || action.includes('register')) return 'default'
  if (action.includes('login') || action.includes('logout')) return 'secondary'
  return 'outline'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function AuditLogs({
  logs,
  filters,
  actionOptions,
  resourceTypeOptions,
  auth,
  appSettings,
  menus,
}: Props) {
  const [localFilters, setLocalFilters] = useState(filters)

  const applyFilters = () => {
    const params: Record<string, string> = {}
    if (localFilters.action) params.action = localFilters.action
    if (localFilters.userId) params.userId = localFilters.userId
    if (localFilters.resourceType) params.resourceType = localFilters.resourceType
    if (localFilters.dateFrom) params.dateFrom = localFilters.dateFrom
    if (localFilters.dateTo) params.dateTo = localFilters.dateTo
    router.get('/admin/audit-logs', params, { preserveState: true })
  }

  const clearFilters = () => {
    setLocalFilters({ action: '', userId: '', resourceType: '', dateFrom: '', dateTo: '' })
    router.get('/admin/audit-logs', {}, { preserveState: true })
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== '')

  const goToPage = (page: number) => {
    const params: Record<string, string> = { page: String(page) }
    if (filters.action) params.action = filters.action
    if (filters.userId) params.userId = filters.userId
    if (filters.resourceType) params.resourceType = filters.resourceType
    if (filters.dateFrom) params.dateFrom = filters.dateFrom
    if (filters.dateTo) params.dateTo = filters.dateTo
    router.get('/admin/audit-logs', params, { preserveState: true })
  }

  return (
    <>
      <Head title="Audit Logs" />
      <AppHeader user={auth.user} appSettings={appSettings} menus={menus} />

      <div className="container py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour au tableau de bord
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-6">Journal d'audit</h1>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtres
            </CardTitle>
            <CardDescription>
              Recherchez dans les logs par action, utilisateur ou date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="filter-action" className="text-xs">
                  Action
                </Label>
                <Select
                  value={localFilters.action || '_all'}
                  onValueChange={(v) =>
                    setLocalFilters((f) => ({ ...f, action: v === '_all' ? '' : v }))
                  }
                >
                  <SelectTrigger id="filter-action">
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Toutes</SelectItem>
                    {actionOptions.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="filter-resource" className="text-xs">
                  Type de ressource
                </Label>
                <Select
                  value={localFilters.resourceType || '_all'}
                  onValueChange={(v) =>
                    setLocalFilters((f) => ({ ...f, resourceType: v === '_all' ? '' : v }))
                  }
                >
                  <SelectTrigger id="filter-resource">
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Tous</SelectItem>
                    {resourceTypeOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="filter-user" className="text-xs">
                  ID Utilisateur
                </Label>
                <Input
                  type="text"
                  id="filter-user"
                  value={localFilters.userId}
                  onChange={(e) => setLocalFilters((f) => ({ ...f, userId: e.target.value }))}
                  placeholder="Ex : 1"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="filter-from" className="text-xs">
                  Date début
                </Label>
                <Input
                  type="date"
                  id="filter-from"
                  value={localFilters.dateFrom}
                  onChange={(e) => setLocalFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="filter-to" className="text-xs">
                  Date fin
                </Label>
                <Input
                  type="date"
                  id="filter-to"
                  value={localFilters.dateTo}
                  onChange={(e) => setLocalFilters((f) => ({ ...f, dateTo: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={applyFilters}>
                <Search className="mr-2 h-4 w-4" />
                Rechercher
              </Button>
              {hasActiveFilters && (
                <Button size="sm" variant="ghost" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Effacer les filtres
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Date</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Ressource</TableHead>
                    <TableHead className="hidden lg:table-cell">IP</TableHead>
                    <TableHead className="hidden xl:table-cell">Métadonnées</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Aucun log trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.data.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          {log.user ? (
                            <div className="text-sm">
                              <p className="font-medium">{log.user.fullName || log.user.email}</p>
                              <p className="text-xs text-muted-foreground">{log.user.email}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Système</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={actionBadgeVariant(log.action)}>{log.action}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="text-muted-foreground">{log.resourceType}</span>
                          {log.resourceId && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              #{log.resourceId}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground font-mono">
                          {log.ipAddress || '—'}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                          {log.metadata ? JSON.stringify(log.metadata) : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {logs.meta.lastPage > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Page {logs.meta.currentPage} sur {logs.meta.lastPage} ({logs.meta.total}{' '}
                  résultats)
                </p>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={logs.meta.currentPage <= 1}
                    onClick={() => goToPage(logs.meta.currentPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={logs.meta.currentPage >= logs.meta.lastPage}
                    onClick={() => goToPage(logs.meta.currentPage + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
