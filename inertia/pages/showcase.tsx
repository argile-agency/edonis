import { Head } from '@inertiajs/react'
import { useState } from 'react'
import {
  BookOpen,
  Users,
  GraduationCap,
  Bell,
  Search,
  Mail,
  Calendar,
  FileText,
  Award,
  BarChart3,
  Clock,
  CheckCircle2,
  Moon,
  Sun,
  ChevronRight,
  Plus,
  Download,
  Share2,
  Heart,
  Star,
  Trash2,
  Edit,
  Eye,
} from 'lucide-react'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '~/components/ui/card'
import { Progress } from '~/components/ui/progress'
import { Alert, AlertTitle, AlertDescription } from '~/components/ui/alert'
import { Avatar, AvatarImage, AvatarFallback, AvatarGroup } from '~/components/ui/avatar'
import { StatsCard } from '~/components/ui/stats-card'
import {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonStats,
  SkeletonTable,
} from '~/components/ui/skeleton'
import { LazySection } from '~/components/ui/lazy-section'
import { useTheme } from '~/components/theme-provider'

export default function Showcase() {
  const { theme, setTheme } = useTheme()
  const [inputValue, setInputValue] = useState('')
  const [showDismissableAlert, setShowDismissableAlert] = useState(true)

  return (
    <>
      <Head title="Component Showcase" />

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Edonis Design System</h1>
                <p className="text-xs text-muted-foreground">Inclusive & Accessible Components</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12">
          {/* Hero Section */}
          <section className="mb-16 text-center animate-fade-in">
            <Badge variant="soft-primary" size="lg" className="mb-4">
              Design System v1.0
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Built for <span className="text-primary">Education</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              A warm, approachable design system crafted for learners, teachers, and administrators.
              Every component prioritizes accessibility, clarity, and inclusivity.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" leftIcon={<BookOpen className="h-5 w-5" />}>
                View Documentation
              </Button>
              <Button size="lg" variant="outline" leftIcon={<Download className="h-5 w-5" />}>
                Download Figma
              </Button>
            </div>
          </section>

          {/* Color Palette */}
          <section className="mb-16">
            <SectionHeader
              title="Color Palette"
              description="A warm, inclusive palette designed for educational contexts"
            />
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <ColorSwatch
                name="Primary"
                color="bg-primary"
                textColor="text-primary-foreground"
                description="Trust & Focus"
              />
              <ColorSwatch
                name="Secondary"
                color="bg-secondary"
                textColor="text-secondary-foreground"
                description="Supporting"
              />
              <ColorSwatch
                name="Accent"
                color="bg-accent"
                textColor="text-accent-foreground"
                description="Highlights"
              />
              <ColorSwatch
                name="Success"
                color="bg-success"
                textColor="text-success-foreground"
                description="Achievement"
              />
              <ColorSwatch
                name="Warning"
                color="bg-warning"
                textColor="text-warning-foreground"
                description="Attention"
              />
              <ColorSwatch
                name="Destructive"
                color="bg-destructive"
                textColor="text-destructive-foreground"
                description="Errors"
              />
            </div>
          </section>

          {/* Buttons */}
          <section className="mb-16">
            <SectionHeader
              title="Buttons"
              description="Interactive elements with clear visual feedback and loading states"
            />

            <div className="space-y-8">
              {/* Primary Variants */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Solid Variants</h4>
                <div className="flex flex-wrap gap-3">
                  <Button>Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="success">Success</Button>
                  <Button variant="warning">Warning</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="info">Info</Button>
                  <Button variant="accent">Accent</Button>
                </div>
              </div>

              {/* Soft Variants */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Soft Variants</h4>
                <div className="flex flex-wrap gap-3">
                  <Button variant="soft-primary">Primary</Button>
                  <Button variant="soft-success">Success</Button>
                  <Button variant="soft-warning">Warning</Button>
                  <Button variant="soft-destructive">Destructive</Button>
                  <Button variant="soft-info">Info</Button>
                </div>
              </div>

              {/* Other Variants */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Other Variants</h4>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="link">Link Style</Button>
                </div>
              </div>

              {/* Sizes */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Sizes</h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="xl">Extra Large</Button>
                </div>
              </div>

              {/* With Icons */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4">With Icons</h4>
                <div className="flex flex-wrap gap-3">
                  <Button leftIcon={<Plus className="h-4 w-4" />}>Create Course</Button>
                  <Button variant="outline" rightIcon={<ChevronRight className="h-4 w-4" />}>
                    Continue Learning
                  </Button>
                  <Button variant="secondary" leftIcon={<Download className="h-4 w-4" />}>
                    Export Grades
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Favorite">
                    <Heart className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Share">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* States */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4">States</h4>
                <div className="flex flex-wrap gap-3">
                  <Button loading>Loading...</Button>
                  <Button disabled>Disabled</Button>
                  <Button variant="success" leftIcon={<CheckCircle2 className="h-4 w-4" />}>
                    Completed
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Inputs */}
          <section className="mb-16">
            <SectionHeader
              title="Form Inputs"
              description="Accessible form controls with validation states and helpful feedback"
            />

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Default Input</label>
                  <Input
                    placeholder="Enter your name..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">With Left Icon</label>
                  <Input
                    placeholder="Search courses..."
                    leftElement={<Search className="h-4 w-4" />}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Email with Helper Text</label>
                  <Input
                    type="email"
                    placeholder="student@university.edu"
                    leftElement={<Mail className="h-4 w-4" />}
                    helperText="We'll never share your email with anyone."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Password with Toggle</label>
                  <Input type="password" placeholder="Enter your password" />
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Success State</label>
                  <Input
                    placeholder="Email verified!"
                    leftElement={<Mail className="h-4 w-4" />}
                    success
                    defaultValue="student@university.edu"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Error State</label>
                  <Input
                    placeholder="Enter valid email"
                    leftElement={<Mail className="h-4 w-4" />}
                    error="Please enter a valid email address"
                    defaultValue="invalid-email"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Sizes</label>
                  <div className="space-y-3">
                    <Input inputSize="sm" placeholder="Small input" />
                    <Input inputSize="default" placeholder="Default input" />
                    <Input inputSize="lg" placeholder="Large input" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Badges */}
          <section className="mb-16">
            <SectionHeader
              title="Badges"
              description="Status indicators and labels for categorization"
            />

            <div className="space-y-8">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Solid Variants</h4>
                <div className="flex flex-wrap gap-3">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="success">Completed</Badge>
                  <Badge variant="warning">In Progress</Badge>
                  <Badge variant="destructive">Overdue</Badge>
                  <Badge variant="info">New</Badge>
                  <Badge variant="accent">Featured</Badge>
                  <Badge variant="outline">Outline</Badge>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Soft Variants</h4>
                <div className="flex flex-wrap gap-3">
                  <Badge variant="soft-primary">Primary</Badge>
                  <Badge variant="soft-success">Published</Badge>
                  <Badge variant="soft-warning">Draft</Badge>
                  <Badge variant="soft-destructive">Archived</Badge>
                  <Badge variant="soft-info">Beta</Badge>
                  <Badge variant="soft-accent">Premium</Badge>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Role Badges</h4>
                <div className="flex flex-wrap gap-3">
                  <Badge variant="admin">Administrator</Badge>
                  <Badge variant="manager">Manager</Badge>
                  <Badge variant="teacher">Teacher</Badge>
                  <Badge variant="student">Student</Badge>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4">With Dot & Icons</h4>
                <div className="flex flex-wrap gap-3">
                  <Badge variant="success" dot>
                    Online
                  </Badge>
                  <Badge variant="soft-warning" dot>
                    Away
                  </Badge>
                  <Badge variant="soft-destructive" dot>
                    Offline
                  </Badge>
                  <Badge variant="soft-info" icon={<Star className="h-3 w-3" />}>
                    Featured
                  </Badge>
                  <Badge variant="soft-success" icon={<CheckCircle2 className="h-3 w-3" />}>
                    Verified
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Sizes</h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge size="sm">Small</Badge>
                  <Badge size="default">Default</Badge>
                  <Badge size="lg">Large</Badge>
                </div>
              </div>
            </div>
          </section>

          {/* Progress */}
          <section className="mb-16">
            <SectionHeader
              title="Progress Bars"
              description="Track completion and learning progress"
            />

            <div className="space-y-8 max-w-2xl">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Variants</h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Course Progress</span>
                      <span className="text-muted-foreground">75%</span>
                    </div>
                    <Progress value={75} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Assignments Complete</span>
                      <span className="text-success">100%</span>
                    </div>
                    <Progress value={100} variant="success" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Quiz Score</span>
                      <span className="text-warning">45%</span>
                    </div>
                    <Progress value={45} variant="warning" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Deadline Approaching</span>
                      <span className="text-destructive">15%</span>
                    </div>
                    <Progress value={15} variant="destructive" />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Sizes</h4>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-muted-foreground mb-2 block">Small</span>
                    <Progress value={60} size="sm" />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground mb-2 block">Default</span>
                    <Progress value={60} size="default" />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground mb-2 block">
                      Large (with label)
                    </span>
                    <Progress value={60} size="lg" showLabel />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Alerts */}
          <section className="mb-16">
            <SectionHeader title="Alerts" description="Contextual feedback messages for users" />

            <div className="space-y-4 max-w-2xl">
              <Alert variant="info">
                <AlertTitle>Welcome to the new semester!</AlertTitle>
                <AlertDescription>
                  Check out the updated course catalog and register for your classes.
                </AlertDescription>
              </Alert>

              <Alert variant="success">
                <AlertTitle>Assignment submitted successfully</AlertTitle>
                <AlertDescription>
                  Your work has been received. You'll get feedback within 3 days.
                </AlertDescription>
              </Alert>

              <Alert variant="warning">
                <AlertTitle>Deadline approaching</AlertTitle>
                <AlertDescription>
                  Your assignment for "Introduction to Psychology" is due in 2 hours.
                </AlertDescription>
              </Alert>

              <Alert variant="destructive">
                <AlertTitle>Submission failed</AlertTitle>
                <AlertDescription>
                  There was an error uploading your file. Please try again.
                </AlertDescription>
              </Alert>

              {showDismissableAlert && (
                <Alert variant="info" dismissible onDismiss={() => setShowDismissableAlert(false)}>
                  <AlertTitle>Dismissable Alert</AlertTitle>
                  <AlertDescription>
                    Click the X button to dismiss this notification.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </section>

          {/* Avatars */}
          <section className="mb-16">
            <SectionHeader
              title="Avatars"
              description="User representations with status indicators"
            />

            <LazySection
              fallback={
                <div className="space-y-8">
                  <div className="flex gap-4">
                    {[...Array(6)].map((_, i) => (
                      <SkeletonAvatar key={i} size="lg" />
                    ))}
                  </div>
                  <div className="flex gap-6">
                    {[...Array(4)].map((_, i) => (
                      <SkeletonAvatar key={i} size="lg" />
                    ))}
                  </div>
                </div>
              }
              options={{ rootMargin: '200px' }}
            >
              <div className="space-y-8">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-4">Sizes</h4>
                  <div className="flex flex-wrap items-end gap-4">
                    <Avatar size="xs">
                      <AvatarFallback>XS</AvatarFallback>
                    </Avatar>
                    <Avatar size="sm">
                      <AvatarFallback>SM</AvatarFallback>
                    </Avatar>
                    <Avatar size="default">
                      <AvatarImage src="https://i.pravatar.cc/150?img=1" alt="User" />
                      <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                    <Avatar size="lg">
                      <AvatarImage src="https://i.pravatar.cc/150?img=2" alt="User" />
                      <AvatarFallback>AB</AvatarFallback>
                    </Avatar>
                    <Avatar size="xl">
                      <AvatarImage src="https://i.pravatar.cc/150?img=3" alt="User" />
                      <AvatarFallback>CD</AvatarFallback>
                    </Avatar>
                    <Avatar size="2xl">
                      <AvatarImage src="https://i.pravatar.cc/150?img=4" alt="User" />
                      <AvatarFallback>EF</AvatarFallback>
                    </Avatar>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-4">With Status</h4>
                  <div className="flex flex-wrap items-center gap-6">
                    <Avatar size="lg" status="online">
                      <AvatarImage src="https://i.pravatar.cc/150?img=5" alt="Online user" />
                      <AvatarFallback>ON</AvatarFallback>
                    </Avatar>
                    <Avatar size="lg" status="away">
                      <AvatarImage src="https://i.pravatar.cc/150?img=6" alt="Away user" />
                      <AvatarFallback>AW</AvatarFallback>
                    </Avatar>
                    <Avatar size="lg" status="busy">
                      <AvatarImage src="https://i.pravatar.cc/150?img=7" alt="Busy user" />
                      <AvatarFallback>BU</AvatarFallback>
                    </Avatar>
                    <Avatar size="lg" status="offline">
                      <AvatarImage src="https://i.pravatar.cc/150?img=8" alt="Offline user" />
                      <AvatarFallback>OF</AvatarFallback>
                    </Avatar>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-4">Avatar Group</h4>
                  <div className="space-y-4">
                    <AvatarGroup max={4} total={12}>
                      <Avatar>
                        <AvatarImage src="https://i.pravatar.cc/150?img=10" alt="User 1" />
                        <AvatarFallback>U1</AvatarFallback>
                      </Avatar>
                      <Avatar>
                        <AvatarImage src="https://i.pravatar.cc/150?img=11" alt="User 2" />
                        <AvatarFallback>U2</AvatarFallback>
                      </Avatar>
                      <Avatar>
                        <AvatarImage src="https://i.pravatar.cc/150?img=12" alt="User 3" />
                        <AvatarFallback>U3</AvatarFallback>
                      </Avatar>
                      <Avatar>
                        <AvatarImage src="https://i.pravatar.cc/150?img=13" alt="User 4" />
                        <AvatarFallback>U4</AvatarFallback>
                      </Avatar>
                      <Avatar>
                        <AvatarImage src="https://i.pravatar.cc/150?img=14" alt="User 5" />
                        <AvatarFallback>U5</AvatarFallback>
                      </Avatar>
                    </AvatarGroup>
                    <p className="text-sm text-muted-foreground">
                      12 students enrolled in this course
                    </p>
                  </div>
                </div>
              </div>
            </LazySection>
          </section>

          {/* Cards */}
          <section className="mb-16">
            <SectionHeader
              title="Cards"
              description="Container components for grouping related content"
            />

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Default Card</CardTitle>
                  <CardDescription>A simple card with default styling</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Cards are used to group related content and actions together.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button size="sm">Learn More</Button>
                </CardFooter>
              </Card>

              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>Elevated Card</CardTitle>
                  <CardDescription>More prominent shadow for emphasis</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Use elevated cards to draw attention to important content.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button size="sm" variant="secondary">
                    View Details
                  </Button>
                </CardFooter>
              </Card>

              <Card variant="interactive">
                <CardHeader>
                  <CardTitle>Interactive Card</CardTitle>
                  <CardDescription>Hover to see the lift effect</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Perfect for clickable items like course cards or assignments.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button size="sm" variant="outline">
                    Select
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardFooter>
              </Card>

              <Card variant="success">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    Success Card
                  </CardTitle>
                  <CardDescription>For completed or approved items</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Assignment submitted successfully and reviewed.
                  </p>
                </CardContent>
              </Card>

              <Card variant="warning">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-warning" />
                    Warning Card
                  </CardTitle>
                  <CardDescription>Deadline in 2 hours</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Your assignment is due soon. Don't forget to submit!
                  </p>
                </CardContent>
              </Card>

              <Card variant="info">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-info" />
                    Info Card
                  </CardTitle>
                  <CardDescription>New announcement</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Check the updated schedule for next week's lectures.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Stats Cards */}
          <section className="mb-16">
            <SectionHeader title="Stats Cards" description="Display key metrics and analytics" />

            <LazySection
              fallback={
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <SkeletonStats key={i} />
                  ))}
                </div>
              }
              options={{ rootMargin: '150px' }}
            >
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                  title="Total Students"
                  value="2,847"
                  icon={<Users className="h-5 w-5" />}
                  trend="up"
                  trendValue="+12%"
                  description="from last semester"
                />
                <StatsCard
                  title="Active Courses"
                  value="124"
                  icon={<BookOpen className="h-5 w-5" />}
                  trend="up"
                  trendValue="+8"
                  description="new this month"
                />
                <StatsCard
                  title="Completion Rate"
                  value="78%"
                  icon={<Award className="h-5 w-5" />}
                  trend="up"
                  trendValue="+5%"
                  description="above target"
                />
                <StatsCard
                  title="Avg. Grade"
                  value="B+"
                  icon={<BarChart3 className="h-5 w-5" />}
                  trend="neutral"
                  trendValue="0%"
                  description="unchanged"
                />
              </div>
            </LazySection>
          </section>

          {/* Skeletons */}
          <section className="mb-16">
            <SectionHeader
              title="Loading Skeletons"
              description="Placeholder content while data loads"
            />

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Text Skeleton</h4>
                <SkeletonText lines={4} />
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4">
                  Avatar Variations
                </h4>
                <div className="flex items-center gap-4">
                  <SkeletonAvatar size="sm" />
                  <SkeletonAvatar size="default" />
                  <SkeletonAvatar size="lg" />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Stats Skeleton</h4>
                <SkeletonStats />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Card Skeleton</h4>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Table Skeleton</h4>
                <SkeletonTable rows={4} columns={5} />
              </div>
            </div>
          </section>

          {/* Example Compositions */}
          <section className="mb-16">
            <SectionHeader
              title="Example Compositions"
              description="Real-world component combinations for LMS interfaces"
            />

            <LazySection
              fallback={
                <div className="grid lg:grid-cols-2 gap-8">
                  {[...Array(4)].map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              }
              options={{ rootMargin: '200px' }}
            >
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Course Card Example */}
                <Card variant="interactive" className="overflow-hidden">
                  <div className="h-40 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <BookOpen className="h-16 w-16 text-primary/50" />
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge variant="soft-success" size="sm" className="mb-2">
                          Published
                        </Badge>
                        <CardTitle>Introduction to Psychology</CardTitle>
                        <CardDescription>Prof. Sarah Johnson</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Progress</span>
                          <span className="font-medium">68%</span>
                        </div>
                        <Progress value={68} size="sm" />
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" /> 234 students
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" /> 12 hours
                        </span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t bg-muted/30">
                    <Button className="w-full" rightIcon={<ChevronRight className="h-4 w-4" />}>
                      Continue Learning
                    </Button>
                  </CardFooter>
                </Card>

                {/* User Profile Card Example */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <Avatar size="xl" status="online">
                        <AvatarImage src="https://i.pravatar.cc/150?img=20" alt="Student profile" />
                        <AvatarFallback>JD</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle>Jane Doe</CardTitle>
                        <CardDescription>Computer Science, Year 3</CardDescription>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="student">Student</Badge>
                          <Badge variant="soft-accent" icon={<Star className="h-3 w-3" />}>
                            Dean's List
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 py-4 border-y">
                      <div className="text-center">
                        <p className="text-2xl font-bold">12</p>
                        <p className="text-xs text-muted-foreground">Courses</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">3.8</p>
                        <p className="text-xs text-muted-foreground">GPA</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">45</p>
                        <p className="text-xs text-muted-foreground">Credits</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>Overall Progress</span>
                        <span className="font-medium">75%</span>
                      </div>
                      <Progress value={75} variant="success" />
                    </div>
                  </CardContent>
                  <CardFooter className="gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      leftIcon={<Mail className="h-4 w-4" />}
                    >
                      Message
                    </Button>
                    <Button className="flex-1" leftIcon={<Eye className="h-4 w-4" />}>
                      View Profile
                    </Button>
                  </CardFooter>
                </Card>

                {/* Assignment Card Example */}
                <Card variant="warning">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge variant="warning" size="sm" className="mb-2">
                          Due Soon
                        </Badge>
                        <CardTitle className="text-lg">Research Paper Draft</CardTitle>
                        <CardDescription>Psychology 101</CardDescription>
                      </div>
                      <FileText className="h-8 w-8 text-warning/50" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Due: March 15, 2024 at 11:59 PM</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-warning" />
                        <span className="text-warning font-medium">2 hours remaining</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="gap-2">
                    <Button variant="outline" size="sm" leftIcon={<Edit className="h-4 w-4" />}>
                      Edit Draft
                    </Button>
                    <Button size="sm" variant="warning">
                      Submit Now
                    </Button>
                  </CardFooter>
                </Card>

                {/* Admin Action Card Example */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Pending Approvals</CardTitle>
                        <CardDescription>3 items require your attention</CardDescription>
                      </div>
                      <Badge variant="destructive">3</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { name: 'New Course: Advanced ML', type: 'Course', time: '2h ago' },
                      { name: 'User: john.smith@uni.edu', type: 'Registration', time: '5h ago' },
                      { name: 'Grade Appeal: CS201', type: 'Appeal', time: '1d ago' },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.type} • {item.time}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full">
                      View All Pending Items
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </LazySection>
          </section>

          {/* Accessibility Features */}
          <section className="mb-16">
            <SectionHeader
              title="Accessibility Features"
              description="Built-in accessibility for all users"
            />

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Keyboard Navigation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    All interactive elements are fully keyboard accessible with visible focus
                    states.
                  </p>
                  <div className="flex gap-2">
                    <kbd className="px-2 py-1 text-xs bg-muted rounded border">Tab</kbd>
                    <kbd className="px-2 py-1 text-xs bg-muted rounded border">Enter</kbd>
                    <kbd className="px-2 py-1 text-xs bg-muted rounded border">Space</kbd>
                    <kbd className="px-2 py-1 text-xs bg-muted rounded border">Esc</kbd>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Screen Reader Support</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Semantic HTML, ARIA labels, and proper roles for assistive technologies.
                  </p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Descriptive button labels</li>
                    <li>• Form field associations</li>
                    <li>• Status announcements</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Reduced Motion</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Respects user preferences for reduced motion and animations.
                  </p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block">
                    @media (prefers-reduced-motion)
                  </code>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Color Contrast</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    WCAG AA compliant color contrast ratios for text readability.
                  </p>
                  <div className="flex gap-2">
                    <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                      Aa
                    </div>
                    <div className="h-8 w-8 rounded bg-success flex items-center justify-center text-success-foreground text-xs font-bold">
                      Aa
                    </div>
                    <div className="h-8 w-8 rounded bg-destructive flex items-center justify-center text-destructive-foreground text-xs font-bold">
                      Aa
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Focus Indicators</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Clear, visible focus rings on all interactive elements.
                  </p>
                  <Button className="focus-visible:ring-4">Focus Me (Tab)</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">High Contrast Mode</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Enhanced borders and colors for users with low vision.
                  </p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block">
                    @media (prefers-contrast: high)
                  </code>
                </CardContent>
              </Card>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t py-8 mt-16">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>Edonis Design System • Built with accessibility and inclusivity in mind</p>
            <p className="mt-1">For learners, teachers, and administrators</p>
          </div>
        </footer>
      </div>
    </>
  )
}

// Helper Components

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold tracking-tight mb-2">{title}</h2>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}

function ColorSwatch({
  name,
  color,
  textColor,
  description,
}: {
  name: string
  color: string
  textColor: string
  description: string
}) {
  return (
    <div className="space-y-2">
      <div className={`h-20 rounded-lg ${color} ${textColor} flex items-end p-3 shadow-sm`}>
        <span className="text-sm font-medium">{name}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
