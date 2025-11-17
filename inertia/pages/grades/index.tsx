import { Head, Link } from '@inertiajs/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Progress } from '~/components/ui/progress'
import { BookOpen, Award, TrendingUp, Clock } from 'lucide-react'

interface Course {
  id: number
  code: string
  title: string
  instructor: {
    firstName: string
    lastName: string
  }
}

interface GradeData {
  course: Course
  assignmentCount: number
  submittedCount: number
  gradedCount: number
  overallGrade: number | null
  earnedPoints: number
  totalPoints: number
}

interface Props {
  grades: GradeData[]
}

export default function GradesIndex({ grades }: Props) {
  // Calculate overall statistics
  const totalAssignments = grades.reduce((sum, g) => sum + g.assignmentCount, 0)
  const totalSubmitted = grades.reduce((sum, g) => sum + g.submittedCount, 0)
  const totalGraded = grades.reduce((sum, g) => sum + g.gradedCount, 0)

  // Calculate weighted average across all courses
  let totalEarned = 0
  let totalMax = 0
  grades.forEach((g) => {
    if (g.totalPoints > 0) {
      totalEarned += g.earnedPoints
      totalMax += g.totalPoints
    }
  })
  const overallAverage = totalMax > 0 ? (totalEarned / totalMax) * 100 : null

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

  return (
    <>
      <Head title="Mes Notes" />

      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Mes Notes</h1>
          <p className="text-muted-foreground mt-2">
            Vue d'ensemble de vos résultats académiques
          </p>
        </div>

        {/* Overall Statistics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Moyenne Générale</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getGradeColor(overallAverage)}`}>
                {overallAverage !== null ? `${overallAverage.toFixed(1)}%` : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Note globale: {overallAverage !== null ? getGradeLetter(overallAverage) : 'N/A'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cours Actifs</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{grades.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalAssignments} devoirs au total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Devoirs Soumis</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSubmitted}</div>
              <p className="text-xs text-muted-foreground mt-1">
                sur {totalAssignments} devoirs
              </p>
              <Progress
                value={totalAssignments > 0 ? (totalSubmitted / totalAssignments) * 100 : 0}
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Devoirs Notés</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalGraded}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalSubmitted - totalGraded} en attente
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Courses List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Notes par Cours</h2>

          {grades.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  Vous n'êtes inscrit à aucun cours pour le moment.
                </p>
              </CardContent>
            </Card>
          ) : (
            grades.map((gradeData) => (
              <Card key={gradeData.course.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle>
                        <Link
                          href={`/grades/courses/${gradeData.course.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          {gradeData.course.code} - {gradeData.course.title}
                        </Link>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Instructeur: {gradeData.course.instructor.firstName}{' '}
                        {gradeData.course.instructor.lastName}
                      </CardDescription>
                    </div>
                    <div className="text-right ml-4">
                      <div className={`text-3xl font-bold ${getGradeColor(gradeData.overallGrade)}`}>
                        {gradeData.overallGrade !== null
                          ? `${gradeData.overallGrade.toFixed(1)}%`
                          : 'N/A'}
                      </div>
                      <Badge variant="outline" className="mt-1">
                        {gradeData.overallGrade !== null
                          ? getGradeLetter(gradeData.overallGrade)
                          : 'N/A'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Devoirs</p>
                      <p className="font-medium">{gradeData.assignmentCount} total</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Soumis</p>
                      <p className="font-medium">
                        {gradeData.submittedCount} / {gradeData.assignmentCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Notés</p>
                      <p className="font-medium">
                        {gradeData.gradedCount} / {gradeData.submittedCount}
                      </p>
                    </div>
                  </div>

                  {gradeData.totalPoints > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Progression</span>
                        <span className="font-medium">
                          {gradeData.earnedPoints.toFixed(1)} / {gradeData.totalPoints} points
                        </span>
                      </div>
                      <Progress
                        value={(gradeData.earnedPoints / gradeData.totalPoints) * 100}
                      />
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <Link
                      href={`/grades/courses/${gradeData.course.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Voir le détail →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  )
}
