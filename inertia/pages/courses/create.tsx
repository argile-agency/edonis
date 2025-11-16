import { Head, useForm, Link } from '@inertiajs/react'
import { FormEvent } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { ChevronLeft } from 'lucide-react'

export default function CreateCourse() {
  const { data, setData, post, processing, errors } = useForm({
    code: '',
    title: '',
    description: '',
    objectives: '',
    status: 'draft' as 'draft' | 'published' | 'archived',
    visibility: 'private' as 'public' | 'private' | 'unlisted',
    maxStudents: '',
    allowEnrollment: true,
    startDate: '',
    endDate: '',
    category: '',
    level: '',
    language: 'fr',
    estimatedHours: '',
    tags: '',
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    // Transform data before sending
    const payload: any = {
      ...data,
      maxStudents: data.maxStudents ? Number(data.maxStudents) : undefined,
      estimatedHours: data.estimatedHours ? Number(data.estimatedHours) : undefined,
      tags: data.tags ? data.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : undefined,
    }

    post('/courses', payload)
  }

  return (
    <>
      <Head title="Créer un cours" />

      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-6">
          <Link href="/courses">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Retour aux cours
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Créer un nouveau cours</CardTitle>
            <CardDescription>
              Remplissez les informations pour créer votre cours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Informations de base</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Code du cours *</Label>
                    <Input
                      id="code"
                      value={data.code}
                      onChange={(e) => setData('code', e.target.value)}
                      placeholder="ex: CS101"
                      required
                    />
                    {errors.code && (
                      <p className="text-sm text-red-500">{errors.code}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="language">Langue</Label>
                    <Select value={data.language} onValueChange={(value) => setData('language', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="en">Anglais</SelectItem>
                        <SelectItem value="es">Espagnol</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Titre du cours *</Label>
                  <Input
                    id="title"
                    value={data.title}
                    onChange={(e) => setData('title', e.target.value)}
                    placeholder="ex: Introduction à la programmation"
                    required
                  />
                  {errors.title && (
                    <p className="text-sm text-red-500">{errors.title}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={data.description}
                    onChange={(e) => setData('description', e.target.value)}
                    placeholder="Décrivez le contenu et les objectifs du cours..."
                    rows={4}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-500">{errors.description}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="objectives">Objectifs d'apprentissage</Label>
                  <Textarea
                    id="objectives"
                    value={data.objectives}
                    onChange={(e) => setData('objectives', e.target.value)}
                    placeholder="Listez les compétences que les étudiants acquerront..."
                    rows={4}
                  />
                  {errors.objectives && (
                    <p className="text-sm text-red-500">{errors.objectives}</p>
                  )}
                </div>
              </div>

              {/* Course Settings */}
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-semibold">Paramètres du cours</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Statut</Label>
                    <Select value={data.status} onValueChange={(value: any) => setData('status', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Brouillon</SelectItem>
                        <SelectItem value="published">Publié</SelectItem>
                        <SelectItem value="archived">Archivé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="visibility">Visibilité</Label>
                    <Select value={data.visibility} onValueChange={(value: any) => setData('visibility', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="private">Privé</SelectItem>
                        <SelectItem value="unlisted">Non répertorié</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Catégorie</Label>
                    <Select value={data.category} onValueChange={(value) => setData('category', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez une catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Computer Science">Informatique</SelectItem>
                        <SelectItem value="Mathematics">Mathématiques</SelectItem>
                        <SelectItem value="Science">Sciences</SelectItem>
                        <SelectItem value="Language">Langues</SelectItem>
                        <SelectItem value="Business">Commerce</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="level">Niveau</Label>
                    <Select value={data.level} onValueChange={(value) => setData('level', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un niveau" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Beginner">Débutant</SelectItem>
                        <SelectItem value="Intermediate">Intermédiaire</SelectItem>
                        <SelectItem value="Advanced">Avancé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxStudents">Nombre maximum d'étudiants</Label>
                    <Input
                      id="maxStudents"
                      type="number"
                      value={data.maxStudents}
                      onChange={(e) => setData('maxStudents', e.target.value)}
                      placeholder="Illimité si vide"
                      min="1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estimatedHours">Heures estimées</Label>
                    <Input
                      id="estimatedHours"
                      type="number"
                      value={data.estimatedHours}
                      onChange={(e) => setData('estimatedHours', e.target.value)}
                      placeholder="ex: 40"
                      min="1"
                    />
                  </div>
                </div>
              </div>

              {/* Scheduling */}
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-semibold">Planning</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Date de début</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={data.startDate}
                      onChange={(e) => setData('startDate', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate">Date de fin</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={data.endDate}
                      onChange={(e) => setData('endDate', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-semibold">Tags</h3>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (séparés par des virgules)</Label>
                  <Input
                    id="tags"
                    value={data.tags}
                    onChange={(e) => setData('tags', e.target.value)}
                    placeholder="ex: programmation, python, débutant"
                  />
                  <p className="text-sm text-muted-foreground">
                    Les tags aident les étudiants à trouver votre cours
                  </p>
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-4 pt-6">
                <Link href="/courses">
                  <Button type="button" variant="outline">
                    Annuler
                  </Button>
                </Link>
                <Button type="submit" disabled={processing}>
                  {processing ? 'Création...' : 'Créer le cours'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
