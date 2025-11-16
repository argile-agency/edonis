import { Head, Link, router } from '@inertiajs/react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  BookOpen,
  Settings,
  Users,
  MoreVertical,
  Search,
  FolderTree,
  CheckCircle,
  Clock,
  Eye,
  Archive,
  ArrowLeft,
  Plus,
} from 'lucide-react'

interface Course {
  id: number
  code: string
  title: string
  description: string
  status: 'draft' | 'published' | 'archived'
  visibility: 'public' | 'private' | 'unlisted'
  enrolledCount: number
  maxStudents: number | null
  approvalStatus: 'draft' | 'pending_approval' | 'approved' | 'rejected'
  instructor: {
    id: number
    fullName: string
    email: string
  }
  courseCategory?: {
    id: number
    name: string
  }
  createdAt: string
}

interface Props {
  courses: Course[]
  stats: {
    total: number
    published: number
    draft: number
    archived: number
  }
}

export default function AdminCoursesIndex({ courses, stats }: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [approvalFilter, setApprovalFilter] = useState<string>('all')

  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.instructor.fullName.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || course.status === statusFilter
    const matchesApproval = approvalFilter === 'all' || course.approvalStatus === approvalFilter

    return matchesSearch && matchesStatus && matchesApproval
  })

  const getStatusBadge = (status: Course['status']) => {
    const badges = {
      draft: { label: 'Brouillon', variant: 'secondary' as const },
      published: { label: 'Publié', variant: 'default' as const },
      archived: { label: 'Archivé', variant: 'outline' as const },
    }
    return <Badge variant={badges[status].variant}>{badges[status].label}</Badge>
  }

  const getApprovalBadge = (status: Course['approvalStatus']) => {
    const badges = {
      draft: { label: 'Brouillon', variant: 'secondary' as const, icon: null },
      pending_approval: { label: 'En attente', variant: 'default' as const, icon: Clock },
      approved: { label: 'Approuvé', variant: 'default' as const, icon: CheckCircle },
      rejected: { label: 'Rejeté', variant: 'destructive' as const, icon: null },
    }
    const badge = badges[status]
    const Icon = badge.icon
    return (
      <Badge variant={badge.variant} className="gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {badge.label}
      </Badge>
    )
  }

  return (
    <>
      <Head title="Gestion des cours" />

      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Back Button */}
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:underline flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au tableau de bord
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Gestion des cours</h1>
            <p className="text-muted-foreground">Administration complète des cours et catégories</p>
          </div>
          <div className="flex gap-3">
            <Link href="/courses/create">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un cours
              </Button>
            </Link>
            <Link href="/admin/categories">
              <Button variant="outline">
                <FolderTree className="h-4 w-4 mr-2" />
                Gérer les catégories
              </Button>
            </Link>
            <Link href="/admin/courses/approval-queue">
              <Button variant="outline">
                <Clock className="h-4 w-4 mr-2" />
                File d'approbation
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total des cours</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Publiés</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.published}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Brouillons</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{stats.draft}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Archivés</CardDescription>
              <CardTitle className="text-3xl text-gray-600">{stats.archived}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un cours, code ou enseignant..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="published">Publié</SelectItem>
                  <SelectItem value="archived">Archivé</SelectItem>
                </SelectContent>
              </Select>
              <Select value={approvalFilter} onValueChange={setApprovalFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Approbation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="pending_approval">En attente</SelectItem>
                  <SelectItem value="approved">Approuvé</SelectItem>
                  <SelectItem value="rejected">Rejeté</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Courses List */}
        {filteredCourses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun cours trouvé</h3>
              <p className="text-muted-foreground text-center">
                {searchTerm || statusFilter !== 'all' || approvalFilter !== 'all'
                  ? 'Essayez de modifier vos filtres de recherche.'
                  : 'Aucun cours disponible pour le moment.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredCourses.map((course) => (
              <Card key={course.id} className="hover:shadow-md transition">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{course.code}</Badge>
                        {getStatusBadge(course.status)}
                        {getApprovalBadge(course.approvalStatus)}
                        {course.visibility === 'private' && (
                          <Badge variant="secondary">Privé</Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl mb-2">{course.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {course.description}
                      </CardDescription>
                      <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                        <span>👤 {course.instructor.fullName}</span>
                        <span>
                          👥 {course.enrolledCount}
                          {course.maxStudents && ` / ${course.maxStudents}`} étudiants
                        </span>
                        {course.courseCategory && <span>📁 {course.courseCategory.name}</span>}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/courses/${course.id}/participants`}>
                            <Users className="h-4 w-4 mr-2" />
                            Gérer les participants
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/courses/${course.id}/settings`}>
                            <Settings className="h-4 w-4 mr-2" />
                            Paramètres du cours
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/courses/${course.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            Voir le cours
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {course.status !== 'archived' && (
                          <DropdownMenuItem
                            onClick={() => router.post(`/admin/courses/${course.id}/archive`)}
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archiver
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
