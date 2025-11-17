import { Head, Link } from '@inertiajs/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Progress } from '~/components/ui/progress'
import {
  ChevronLeft,
  Download,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
} from 'lucide-react'

interface Course {
  id: number
  code: string
  title: string
  instructor: {
    firstName: string
    lastName: string
  }
}

interface Category {
  id: number
  name: string
  weight: number
  grade?: number
  earnedPoints?: number
  totalPoints?: number
}

interface Assignment {
  id: number
  title: string
  maxPoints: number
  dueDate: string | null
  categoryId: number | null
  category: string | null
}

// Student view interfaces
interface StudentGrade {
  assignment: {
    id: number
    title: string
    description: string | null
    maxPoints: number
    dueDate: string | null
    categoryId: number | null
    category: string | null
    module: string | null
  }
  submission: {
    id: number
    status: string
    grade: number | null
    pointsEarned: number | null
    isLate: boolean
    submittedAt: string | null
    gradedAt: string | null
    feedback: string | null
    graderName: string | null
  } | null
}

// Instructor view interfaces
interface StudentGradebook {
  student: {
    id: number
    email: string
    full_name: string
    enrollment_status: string
  }
  grades: {
    assignmentId: number
    submissionId: number | null
    status: string
    grade: number | null
    pointsEarned: number | null
    maxPoints: number
    isLate: boolean
    submittedAt: string | null
  }[]
  overallGrade: number | null
  earnedPoints: number
  totalPoints: number
}

interface Props {
  course: Course
  categories: Category[]
  isInstructor: boolean
  // Student props
  grades?: StudentGrade[]
  overallGrade?: number
  earnedPoints?: number
  totalPoints?: number
  gradedCount?: number
  // Instructor props
  assignments?: Assignment[]
  gradebook?: StudentGradebook[]
}

export default function GradesCourse({
  course,
  categories,
  isInstructor,
  grades,
  overallGrade,
  earnedPoints,
  totalPoints,
  gradedCount,
  assignments,
  gradebook,
}: Props) {
  const getGradeColor = (grade: number | null) => {
    if (grade === null) return 'text-muted-foreground'
    if (grade >= 90) return 'text-green-600'
    if (grade >= 80) return 'text-blue-600'
    if (grade >= 70) return 'text-yellow-600'
    if (grade >= 60) return 'text-orange-600'
    return 'text-red-600'
  }

  const getGradeLetter = (grade: number | null) => {
    if (grade === null) return 'N/A'
    if (grade >= 90) return 'A'
    if (grade >= 80) return 'B'
    if (grade >= 70) return 'C'
    if (grade >= 60) return 'D'
    return 'F'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'graded':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'submitted':
        return <Clock className="h-4 w-4 text-blue-600" />
      case 'draft':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case 'not_submitted':
        return <XCircle className="h-4 w-4 text-muted-foreground" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string, isLate: boolean = false) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      graded: 'default',
      submitted: 'secondary',
      draft: 'outline',
      not_submitted: 'destructive',
    }

    const labels: Record<string, string> = {
      graded: 'Noté',
      submitted: 'Soumis',
      draft: 'Brouillon',
      not_submitted: 'Non soumis',
    }

    return (
      <div className="flex items-center gap-2">
        <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>
        {isLate && <Badge variant="destructive">En retard</Badge>}
      </div>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <>
      <Head title={`Notes - ${course.code}`} />

      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/grades"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Retour aux notes
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                {course.code} - {course.title}
              </h1>
              <p className="text-muted-foreground mt-1">
                Instructeur: {course.instructor.firstName} {course.instructor.lastName}
              </p>
            </div>

            {!isInstructor && overallGrade !== undefined && (
              <Card className="w-48">
                <CardContent className="pt-6 text-center">
                  <div className={`text-4xl font-bold ${getGradeColor(overallGrade)}`}>
                    {overallGrade !== null ? `${overallGrade.toFixed(1)}%` : 'N/A'}
                  </div>
                  <Badge variant="outline" className="mt-2">
                    {getGradeLetter(overallGrade)}
                  </Badge>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {isInstructor ? (
          // INSTRUCTOR VIEW
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Tableau des Notes</h2>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exporter (CSV)
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">
                          Étudiant
                        </TableHead>
                        {assignments?.map((assignment) => (
                          <TableHead key={assignment.id} className="text-center min-w-[120px]">
                            <div className="flex flex-col">
                              <span className="font-medium">{assignment.title}</span>
                              <span className="text-xs text-muted-foreground">
                                {assignment.maxPoints} pts
                              </span>
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-medium sticky right-0 bg-background z-10 min-w-[100px]">
                          Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gradebook?.map((studentData) => (
                        <TableRow key={studentData.student.id}>
                          <TableCell className="sticky left-0 bg-background z-10 font-medium">
                            <div>
                              <div>{studentData.student.full_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {studentData.student.email}
                              </div>
                            </div>
                          </TableCell>
                          {studentData.grades.map((grade) => (
                            <TableCell key={grade.assignmentId} className="text-center">
                              {grade.status === 'graded' && grade.pointsEarned !== null ? (
                                <div className="flex flex-col items-center">
                                  <span
                                    className={getGradeColor(
                                      (grade.pointsEarned / grade.maxPoints) * 100
                                    )}
                                  >
                                    {grade.pointsEarned.toFixed(1)}
                                  </span>
                                  {grade.isLate && (
                                    <Badge variant="destructive" className="text-xs mt-1">
                                      Retard
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <div className="flex justify-center">
                                  {getStatusIcon(grade.status)}
                                </div>
                              )}
                            </TableCell>
                          ))}
                          <TableCell className="text-center sticky right-0 bg-background z-10">
                            <div className={`font-bold ${getGradeColor(studentData.overallGrade)}`}>
                              {studentData.overallGrade !== null
                                ? `${studentData.overallGrade.toFixed(1)}%`
                                : 'N/A'}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {gradebook?.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={(assignments?.length || 0) + 2}
                            className="text-center text-muted-foreground py-8"
                          >
                            Aucun étudiant inscrit
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Category breakdown for instructor */}
            {categories.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Catégories de Notes</CardTitle>
                  <CardDescription>Pondération des différentes catégories</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{category.name}</div>
                          {category.description && (
                            <div className="text-sm text-muted-foreground">
                              {category.description}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline">{category.weight}%</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          // STUDENT VIEW
          <Tabs defaultValue="assignments" className="space-y-6">
            <TabsList>
              <TabsTrigger value="assignments">Devoirs</TabsTrigger>
              <TabsTrigger value="categories">Par Catégorie</TabsTrigger>
            </TabsList>

            <TabsContent value="assignments" className="space-y-4">
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Points Obtenus</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {earnedPoints?.toFixed(1) || 0} / {totalPoints || 0}
                    </div>
                    {totalPoints && totalPoints > 0 && (
                      <Progress
                        value={((earnedPoints || 0) / totalPoints) * 100}
                        className="mt-2"
                      />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Devoirs Notés</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {gradedCount || 0} / {grades?.length || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Moyenne</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${getGradeColor(overallGrade || null)}`}>
                      {overallGrade !== undefined && overallGrade !== null
                        ? `${overallGrade.toFixed(1)}%`
                        : 'N/A'}
                    </div>
                    <Badge variant="outline" className="mt-2">
                      {getGradeLetter(overallGrade || null)}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Assignments List */}
              <Card>
                <CardHeader>
                  <CardTitle>Liste des Devoirs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {grades?.map((gradeData) => (
                      <div
                        key={gradeData.assignment.id}
                        className="border rounded-lg p-4 hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold">{gradeData.assignment.title}</h3>
                            {gradeData.assignment.module && (
                              <p className="text-sm text-muted-foreground">
                                Module: {gradeData.assignment.module}
                              </p>
                            )}
                            {gradeData.assignment.category && (
                              <Badge variant="secondary" className="mt-1">
                                {gradeData.assignment.category}
                              </Badge>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            {gradeData.submission?.status === 'graded' &&
                            gradeData.submission.pointsEarned !== null ? (
                              <div>
                                <div
                                  className={`text-2xl font-bold ${getGradeColor(
                                    (gradeData.submission.pointsEarned /
                                      gradeData.assignment.maxPoints) *
                                      100
                                  )}`}
                                >
                                  {gradeData.submission.pointsEarned.toFixed(1)} /{' '}
                                  {gradeData.assignment.maxPoints}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {(
                                    (gradeData.submission.pointsEarned /
                                      gradeData.assignment.maxPoints) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </div>
                              </div>
                            ) : (
                              <div className="text-muted-foreground">
                                Max: {gradeData.assignment.maxPoints} pts
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-4">
                            {getStatusBadge(
                              gradeData.submission?.status || 'not_submitted',
                              gradeData.submission?.isLate || false
                            )}
                            {gradeData.assignment.dueDate && (
                              <div className="flex items-center text-muted-foreground">
                                <Calendar className="h-4 w-4 mr-1" />
                                {formatDate(gradeData.assignment.dueDate)}
                              </div>
                            )}
                          </div>
                          {gradeData.submission?.gradedAt && (
                            <div className="flex items-center text-muted-foreground">
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Noté le {formatDate(gradeData.submission.gradedAt)}
                            </div>
                          )}
                        </div>

                        {gradeData.submission?.feedback && (
                          <div className="mt-3 p-3 bg-muted rounded-md">
                            <p className="text-sm font-medium mb-1">
                              Commentaire de l'instructeur:
                            </p>
                            <p className="text-sm">{gradeData.submission.feedback}</p>
                            {gradeData.submission.graderName && (
                              <p className="text-xs text-muted-foreground mt-2">
                                — {gradeData.submission.graderName}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {grades?.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Aucun devoir pour ce cours
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Notes par Catégorie</CardTitle>
                  <CardDescription>
                    Répartition pondérée de vos notes selon les catégories
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {categories.map((category) => (
                      <div key={category.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{category.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              Pondération: {category.weight}%
                            </p>
                          </div>
                          <div className="text-right">
                            <div
                              className={`text-2xl font-bold ${getGradeColor(
                                category.grade || null
                              )}`}
                            >
                              {category.grade !== undefined && category.grade !== null
                                ? `${category.grade.toFixed(1)}%`
                                : 'N/A'}
                            </div>
                            {category.earnedPoints !== undefined &&
                              category.totalPoints !== undefined && (
                                <div className="text-sm text-muted-foreground">
                                  {category.earnedPoints.toFixed(1)} / {category.totalPoints} pts
                                </div>
                              )}
                          </div>
                        </div>
                        {category.totalPoints && category.totalPoints > 0 && (
                          <Progress
                            value={((category.earnedPoints || 0) / category.totalPoints) * 100}
                          />
                        )}
                      </div>
                    ))}

                    {categories.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Aucune catégorie de notes définie
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  )
}
