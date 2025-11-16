import { Head, Link, router } from '@inertiajs/react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Book, Calendar, Users, Search, Plus } from 'lucide-react'
import AppHeader from '~/components/layout/app-header'

interface Instructor {
  id: number
  fullName: string
  email: string
}

interface Course {
  id: number
  code: string
  title: string
  description: string | null
  status: 'draft' | 'published' | 'archived'
  visibility: 'public' | 'private' | 'unlisted'
  category: string | null
  level: string | null
  thumbnailUrl: string | null
  enrolledCount: number
  startDate: string | null
  endDate: string | null
  estimatedHours: number | null
  instructor: Instructor
  canEnroll: boolean
}

interface PaginationMeta {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
  firstPage: number
  hasMorePages: boolean
}

interface PaginatedCourses {
  data: Course[]
  meta: PaginationMeta
}

interface AppSettings {
  appName: string
  appLogoUrl: string | null
  primaryColor: string
}

interface MenuItem {
  id: number
  label: string
  url: string
  icon: string | null
  children: MenuItem[]
}

interface Props {
  courses: PaginatedCourses
  filters: {
    status?: string
    category?: string
    search?: string
  }
  auth: {
    user: any
  }
  appSettings: AppSettings | null
  menus: {
    header: MenuItem[]
    footer: MenuItem[]
    userMenu: MenuItem[]
  }
}

export default function CoursesIndex({ courses, filters, auth, appSettings, menus }: Props) {
  const [search, setSearch] = useState(filters.search || '')
  const [status, setStatus] = useState(filters.status || '')
  const [category, setCategory] = useState(filters.category || '')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.get('/courses', { search, status, category }, { preserveState: true })
  }

  const handleFilterChange = (filterType: string, value: string) => {
    const newFilters: any = { search }

    if (filterType === 'status') {
      setStatus(value)
      newFilters.status = value
    } else if (filterType === 'category') {
      setCategory(value)
      newFilters.category = value
    }

    router.get('/courses', newFilters, { preserveState: true })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-500'
      case 'draft':
        return 'bg-yellow-500'
      case 'archived':
        return 'bg-gray-500'
      default:
        return 'bg-blue-500'
    }
  }

  const canCreateCourse = auth.user.roles.some((role) =>
    ['admin', 'instructor'].includes(role.slug)
  )

  return (
    <>
      <Head title="Cours" />

      <AppHeader user={auth.user} appSettings={appSettings} menus={menus} />

      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Cours</h1>
            <p className="text-muted-foreground mt-2">Parcourez et gérez vos cours</p>
          </div>
          {canCreateCourse && (
            <Link href="/courses/create">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau cours
              </Button>
            </Link>
          )}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Rechercher un cours..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="published">Publié</SelectItem>
                  <SelectItem value="archived">Archivé</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={category}
                onValueChange={(value) => handleFilterChange('category', value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  <SelectItem value="Computer Science">Informatique</SelectItem>
                  <SelectItem value="Mathematics">Mathématiques</SelectItem>
                  <SelectItem value="Science">Sciences</SelectItem>
                  <SelectItem value="Language">Langues</SelectItem>
                  <SelectItem value="Business">Commerce</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit">Rechercher</Button>
            </form>
          </CardContent>
        </Card>

        {/* Courses Grid */}
        {courses.data.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Book className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun cours trouvé</h3>
              <p className="text-muted-foreground">
                {filters.search || filters.status || filters.category
                  ? 'Essayez de modifier vos filtres'
                  : 'Commencez par créer votre premier cours'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.data.map((course) => (
              <Card key={course.id} className="flex flex-col hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge className={getStatusColor(course.status)}>{course.status}</Badge>
                    <span className="text-sm text-muted-foreground">{course.code}</span>
                  </div>
                  <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {course.description || 'Pas de description'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Users className="mr-2 h-4 w-4" />
                      {course.enrolledCount} étudiants inscrits
                    </div>
                    {course.estimatedHours && (
                      <div className="flex items-center text-muted-foreground">
                        <Calendar className="mr-2 h-4 w-4" />
                        {course.estimatedHours}h estimées
                      </div>
                    )}
                    <div className="text-muted-foreground">
                      Instructeur: {course.instructor.fullName}
                    </div>
                    {course.category && <Badge variant="outline">{course.category}</Badge>}
                    {course.level && <Badge variant="outline">{course.level}</Badge>}
                  </div>
                </CardContent>
                <CardFooter>
                  <Link href={`/courses/${course.id}`} className="w-full">
                    <Button variant="outline" className="w-full">
                      Voir le cours
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {courses.meta.lastPage > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            {Array.from({ length: courses.meta.lastPage }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={page === courses.meta.currentPage ? 'default' : 'outline'}
                onClick={() =>
                  router.get('/courses', { ...filters, page }, { preserveState: true })
                }
              >
                {page}
              </Button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
