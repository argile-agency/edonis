import { Head, Link, router, useForm } from '@inertiajs/react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Badge } from '~/components/ui/badge'
import { Switch } from '~/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/ui/alert-dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '~/components/ui/tabs'
import { Edit, Folder, MessageSquare, Plus, Trash2, Users, Eye, EyeOff } from 'lucide-react'

interface Grouping {
  id: number
  name: string
  description: string | null
  createdAt: string
  groupsCount?: number
}

interface Group {
  id: number
  groupingId: number | null
  name: string
  description: string | null
  maxMembers: number | null
  currentMembers: number
  isVisibleToStudents: boolean
  enableGroupMessaging: boolean
  createdAt: string
  grouping?: {
    id: number
    name: string
  }
}

interface Course {
  id: number
  code: string
  title: string
}

interface Props {
  course: Course
  groupings: Grouping[]
  groups: Group[]
}

export default function GroupsManage({ course, groupings, groups }: Props) {
  const [isCreateGroupingDialogOpen, setIsCreateGroupingDialogOpen] = useState(false)
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false)

  const groupingForm = useForm({
    name: '',
    description: '',
  })

  const groupForm = useForm({
    groupingId: null as number | null,
    name: '',
    description: '',
    maxMembers: null as number | null,
    isVisibleToStudents: true,
    enableGroupMessaging: true,
  })

  const handleCreateGrouping = (e: React.FormEvent) => {
    e.preventDefault()
    groupingForm.post(`/courses/${course.id}/groupings`, {
      onSuccess: () => {
        setIsCreateGroupingDialogOpen(false)
        groupingForm.reset()
      },
    })
  }

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault()
    groupForm.post(`/courses/${course.id}/groups`, {
      onSuccess: () => {
        setIsCreateGroupDialogOpen(false)
        groupForm.reset()
      },
    })
  }

  const handleDeleteGrouping = (groupingId: number) => {
    router.delete(`/courses/${course.id}/groupings/${groupingId}`)
  }

  const handleDeleteGroup = (groupId: number) => {
    router.delete(`/courses/${course.id}/groups/${groupId}`)
  }

  const getGroupsByGrouping = (groupingId: number | null) => {
    return groups.filter((g) => g.groupingId === groupingId)
  }

  const ungroupedGroups = getGroupsByGrouping(null)

  return (
    <>
      <Head title={`Gestion des groupes - ${course.title}`} />

      <div className="container mx-auto py-8 px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/courses/${course.id}`} className="text-sm text-muted-foreground hover:underline">
            ← Retour au cours
          </Link>
          <h1 className="text-3xl font-bold mt-2">Groupes et Groupings</h1>
          <p className="text-muted-foreground">
            {course.code} - {course.title}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-6">
          <Dialog open={isCreateGroupingDialogOpen} onOpenChange={setIsCreateGroupingDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Folder className="h-4 w-4 mr-2" />
                Nouveau Grouping
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateGrouping}>
                <DialogHeader>
                  <DialogTitle>Créer un Grouping</DialogTitle>
                  <DialogDescription>
                    Un grouping est une collection de groupes (ex: Sections, Équipes de projet)
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="grouping-name">Nom du grouping</Label>
                    <Input
                      id="grouping-name"
                      value={groupingForm.data.name}
                      onChange={(e) => groupingForm.setData('name', e.target.value)}
                      placeholder="Ex: Sections"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="grouping-description">Description (optionnel)</Label>
                    <Textarea
                      id="grouping-description"
                      value={groupingForm.data.description}
                      onChange={(e) => groupingForm.setData('description', e.target.value)}
                      placeholder="Décrivez le but de ce grouping..."
                      rows={3}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateGroupingDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={groupingForm.processing}>
                    {groupingForm.processing ? 'Création...' : 'Créer'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateGroupDialogOpen} onOpenChange={setIsCreateGroupDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau Groupe
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateGroup}>
                <DialogHeader>
                  <DialogTitle>Créer un Groupe</DialogTitle>
                  <DialogDescription>
                    Créez un groupe pour organiser les étudiants dans ce cours
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="group-grouping">Grouping parent (optionnel)</Label>
                    <Select
                      value={groupForm.data.groupingId?.toString() || 'none'}
                      onValueChange={(value) =>
                        groupForm.setData('groupingId', value === 'none' ? null : Number(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Aucun grouping" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {groupings.map((grouping) => (
                          <SelectItem key={grouping.id} value={grouping.id.toString()}>
                            {grouping.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="group-name">Nom du groupe</Label>
                    <Input
                      id="group-name"
                      value={groupForm.data.name}
                      onChange={(e) => groupForm.setData('name', e.target.value)}
                      placeholder="Ex: Groupe A"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="group-description">Description (optionnel)</Label>
                    <Textarea
                      id="group-description"
                      value={groupForm.data.description}
                      onChange={(e) => groupForm.setData('description', e.target.value)}
                      placeholder="Décrivez ce groupe..."
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="group-maxMembers">Nombre maximum de membres (optionnel)</Label>
                    <Input
                      id="group-maxMembers"
                      type="number"
                      value={groupForm.data.maxMembers || ''}
                      onChange={(e) =>
                        groupForm.setData('maxMembers', e.target.value ? Number(e.target.value) : null)
                      }
                      placeholder="Illimité si vide"
                    />
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="group-visible"
                        checked={groupForm.data.isVisibleToStudents}
                        onCheckedChange={(checked) =>
                          groupForm.setData('isVisibleToStudents', checked)
                        }
                      />
                      <Label htmlFor="group-visible">Visible pour les étudiants</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="group-messaging"
                        checked={groupForm.data.enableGroupMessaging}
                        onCheckedChange={(checked) =>
                          groupForm.setData('enableGroupMessaging', checked)
                        }
                      />
                      <Label htmlFor="group-messaging">Activer la messagerie de groupe</Label>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateGroupDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={groupForm.processing}>
                    {groupForm.processing ? 'Création...' : 'Créer'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs for Groupings */}
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">Tous les groupes ({groups.length})</TabsTrigger>
            {groupings.map((grouping) => (
              <TabsTrigger key={grouping.id} value={grouping.id.toString()}>
                {grouping.name} ({getGroupsByGrouping(grouping.id).length})
              </TabsTrigger>
            ))}
          </TabsList>

          {/* All Groups Tab */}
          <TabsContent value="all" className="space-y-4">
            {groupings.length === 0 && groups.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucun groupe</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Créez des groupes pour organiser les étudiants de ce cours.
                  </p>
                  <Button onClick={() => setIsCreateGroupDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer un groupe
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Groupings with their groups */}
                {groupings.map((grouping) => {
                  const groupingGroups = getGroupsByGrouping(grouping.id)
                  return (
                    <Card key={grouping.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <Folder className="h-5 w-5 mt-1" />
                            <div>
                              <CardTitle>{grouping.name}</CardTitle>
                              <CardDescription>{grouping.description}</CardDescription>
                            </div>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer le grouping</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Êtes-vous sûr de vouloir supprimer ce grouping ? Les groupes qu'il contient
                                  ne seront pas supprimés mais déplacés vers "Sans grouping".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteGrouping(grouping.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid md:grid-cols-2 gap-4">
                          {groupingGroups.map((group) => (
                            <GroupCard key={group.id} group={group} onDelete={handleDeleteGroup} />
                          ))}
                        </div>
                        {groupingGroups.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Aucun groupe dans ce grouping
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}

                {/* Ungrouped groups */}
                {ungroupedGroups.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Groupes sans grouping</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-4">
                        {ungroupedGroups.map((group) => (
                          <GroupCard key={group.id} group={group} onDelete={handleDeleteGroup} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Individual Grouping Tabs */}
          {groupings.map((grouping) => (
            <TabsContent key={grouping.id} value={grouping.id.toString()}>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{grouping.name}</CardTitle>
                      <CardDescription>{grouping.description}</CardDescription>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer le grouping</AlertDialogTitle>
                          <AlertDialogDescription>
                            Êtes-vous sûr ? Les groupes ne seront pas supprimés.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteGrouping(grouping.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {getGroupsByGrouping(grouping.id).map((group) => (
                      <GroupCard key={group.id} group={group} onDelete={handleDeleteGroup} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  )
}

function GroupCard({ group, onDelete }: { group: Group; onDelete: (id: number) => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2 flex-1">
            <Users className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div className="flex-1">
              <CardTitle className="text-base">{group.name}</CardTitle>
              {group.description && (
                <CardDescription className="text-sm mt-1">{group.description}</CardDescription>
              )}
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost">
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer le groupe</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir supprimer "{group.name}" ? Les membres seront retirés du
                  groupe.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(group.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-3 w-3" />
            <span>
              {group.currentMembers}
              {group.maxMembers && ` / ${group.maxMembers}`} membres
            </span>
          </div>
          <div className="flex gap-2">
            {group.isVisibleToStudents ? (
              <Badge variant="secondary" className="text-xs">
                <Eye className="h-3 w-3 mr-1" />
                Visible
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                <EyeOff className="h-3 w-3 mr-1" />
                Masqué
              </Badge>
            )}
            {group.enableGroupMessaging && (
              <Badge variant="secondary" className="text-xs">
                <MessageSquare className="h-3 w-3 mr-1" />
                Messages
              </Badge>
            )}
          </div>
        </div>
        {group.maxMembers && (
          <div className="mt-3">
            <div className="w-full bg-secondary rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{
                  width: `${Math.min((group.currentMembers / group.maxMembers) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
