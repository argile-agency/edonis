import { Head, Link, useForm } from '@inertiajs/react'
import { FormEvent } from 'react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Switch } from '~/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

interface Category {
  id: number
  name: string
  slug: string
  depth: number
  parentId: number | null
}

interface Props {
  categories: Category[]
  parentId?: number
  parentCategory?: Category
}

export default function CategoriesCreate({ categories, parentId, parentCategory }: Props) {
  const form = useForm({
    name: '',
    slug: '',
    description: '',
    parentId: parentCategory?.id || parentId || (null as number | null),
    sortOrder: 0,
    isVisible: true,
    icon: '',
    color: '#3b82f6',
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    form.post('/admin/categories')
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const handleNameChange = (value: string) => {
    form.setData('name', value)
    if (!form.data.slug || form.data.slug === generateSlug(form.data.name)) {
      form.setData('slug', generateSlug(value))
    }
  }

  const rootCategories = categories.filter((c) => c.parentId === null && c.depth === 0)

  return (
    <>
      <Head title="Créer une catégorie" />

      <div className="container mx-auto py-8 px-4 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin/categories" className="text-sm text-muted-foreground hover:underline">
            ← Retour aux catégories
          </Link>
          <h1 className="text-3xl font-bold mt-2">
            {parentCategory
              ? `Créer une sous-catégorie de "${parentCategory.name}"`
              : 'Créer une catégorie'}
          </h1>
          <p className="text-muted-foreground">
            {parentCategory
              ? `Ajoutez une nouvelle sous-catégorie dans "${parentCategory.name}"`
              : 'Ajoutez une nouvelle catégorie pour organiser vos cours'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Informations de la catégorie</CardTitle>
              <CardDescription>Remplissez les détails de la nouvelle catégorie</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Name */}
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={form.data.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Sciences"
                  required
                />
                {form.errors.name && <p className="text-sm text-destructive">{form.errors.name}</p>}
              </div>

              {/* Slug */}
              <div className="grid gap-2">
                <Label htmlFor="slug">
                  Slug (URL) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="slug"
                  value={form.data.slug}
                  onChange={(e) => form.setData('slug', e.target.value)}
                  placeholder="Ex: sciences"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Utilisé dans l'URL. Généré automatiquement à partir du nom.
                </p>
                {form.errors.slug && <p className="text-sm text-destructive">{form.errors.slug}</p>}
              </div>

              {/* Description */}
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.data.description}
                  onChange={(e) => form.setData('description', e.target.value)}
                  placeholder="Décrivez cette catégorie..."
                  rows={4}
                />
                {form.errors.description && (
                  <p className="text-sm text-destructive">{form.errors.description}</p>
                )}
              </div>

              {/* Parent Category */}
              <div className="grid gap-2">
                <Label htmlFor="parentId">Catégorie parente (optionnel)</Label>
                <Select
                  value={form.data.parentId?.toString() || 'none'}
                  onValueChange={(value) =>
                    form.setData('parentId', value === 'none' ? null : Number(value))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune (catégorie racine)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune (catégorie racine)</SelectItem>
                    {rootCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Laissez vide pour créer une catégorie de premier niveau
                </p>
                {form.errors.parentId && (
                  <p className="text-sm text-destructive">{form.errors.parentId}</p>
                )}
              </div>

              {/* Sort Order */}
              <div className="grid gap-2">
                <Label htmlFor="sortOrder">Ordre de tri</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={form.data.sortOrder}
                  onChange={(e) => form.setData('sortOrder', Number(e.target.value))}
                  placeholder="0"
                />
                <p className="text-sm text-muted-foreground">
                  Les catégories sont affichées par ordre croissant
                </p>
                {form.errors.sortOrder && (
                  <p className="text-sm text-destructive">{form.errors.sortOrder}</p>
                )}
              </div>

              {/* Icon and Color */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="icon">Icône (emoji)</Label>
                  <Input
                    id="icon"
                    value={form.data.icon}
                    onChange={(e) => form.setData('icon', e.target.value)}
                    placeholder="📚"
                    maxLength={2}
                  />
                  <p className="text-sm text-muted-foreground">
                    Un emoji pour identifier la catégorie
                  </p>
                  {form.errors.icon && (
                    <p className="text-sm text-destructive">{form.errors.icon}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="color">Couleur</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color"
                      type="color"
                      value={form.data.color}
                      onChange={(e) => form.setData('color', e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={form.data.color}
                      onChange={(e) => form.setData('color', e.target.value)}
                      placeholder="#3b82f6"
                      className="flex-1"
                    />
                  </div>
                  {form.errors.color && (
                    <p className="text-sm text-destructive">{form.errors.color}</p>
                  )}
                </div>
              </div>

              {/* Visibility */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="isVisible"
                  checked={form.data.isVisible}
                  onCheckedChange={(checked) => form.setData('isVisible', checked)}
                />
                <Label htmlFor="isVisible" className="cursor-pointer">
                  Catégorie visible publiquement
                </Label>
              </div>

              {/* Preview */}
              {(form.data.name || form.data.icon) && (
                <div className="pt-4 border-t">
                  <Label className="mb-3 block">Aperçu</Label>
                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    {form.data.icon && (
                      <div
                        className="flex items-center justify-center w-12 h-12 rounded-lg"
                        style={{
                          backgroundColor: form.data.color,
                          color: '#ffffff',
                        }}
                      >
                        <span className="text-2xl">{form.data.icon}</span>
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold">{form.data.name || 'Nom de la catégorie'}</h3>
                      {form.data.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {form.data.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {form.data.slug || 'slug'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4 mt-6">
            <Link href="/admin/categories">
              <Button type="button" variant="outline">
                Annuler
              </Button>
            </Link>
            <Button type="submit" disabled={form.processing}>
              {form.processing ? 'Création...' : 'Créer la catégorie'}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
