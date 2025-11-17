# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

**IMPORTANT**: Always use **bun** as the primary package manager. If bun fails, try **pnpm**. Only use **npm** as a last resort.

```bash
bun install           # Install dependencies
bun add <package>     # Add a package
bun add -d <package>  # Add a dev dependency
```

## Development Commands

```bash
# Development
bun run dev           # Start dev server with HMR (http://localhost:3333)
bun run build         # Build for production
bun start             # Start production server

# Database
node ace migration:run              # Run pending migrations
node ace migration:rollback         # Rollback last batch
node ace migration:fresh            # Drop all tables and re-run migrations
node ace make:migration <name>      # Create a new migration
node ace db:seed                    # Run database seeders

# Code Generation
node ace make:model <name>          # Create a model
node ace make:controller <name>     # Create a controller
node ace make:middleware <name>     # Create middleware
node ace make:validator <name>      # Create a validator

# Code Quality
bun run typecheck     # Type check TypeScript
bun run lint          # Lint code
bun run format        # Format code with Prettier
bun test              # Run all tests
node ace test         # Alternative test command
```

## Development Best Practices

### Demo Data & Seeders

**IMPORTANT**: When developing features that require demo data, ALWAYS use existing seeders instead of creating new ones.

**Existing Seeders**:
- `user_seeder.ts` - Creates test users (admin, manager, teacher, student)
- `course_seeder.ts` - Creates sample courses with various statuses
- `course_category_seeder.ts` - Creates course categories
- `enrollment_method_seeder.ts` - Creates enrollment methods
- `cohort_seeder.ts` - Creates student cohorts
- `student_enrollment_seeder.ts` - Enrolls test student in courses
- `app_setting_seeder.ts` - App branding and settings
- `menu_seeder.ts` - Navigation menus (header, footer, user menu)

**Seeder Guidelines**:
1. Run `node ace db:seed` to populate all demo data
2. Reuse existing data models instead of creating duplicates
3. Check for existing records with `findBy()` or `updateOrCreate()` 
4. Keep demo data realistic but minimal to avoid bloat during development
5. Document any new seeders in this file

**Test Accounts** (after running seeders):
```
Admin:    admin@edonis.test / password
Manager:  manager@edonis.test / password  
Teacher:  teacher@edonis.test / password
Student:  student@edonis.test / password
```

## CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment.

### Available Workflows

**1. CI Pipeline** (`.github/workflows/ci.yml`)
- **Triggers**: Push and Pull Requests to main/develop
- **Jobs**:
  - **Lint & Type Check**: ESLint and TypeScript validation
  - **Build**: Production build verification
  - **Security Audit**: Dependency vulnerability scanning
  - **Unit Tests**: Runs functional tests with PostgreSQL
- **Status**: Required checks for PR merges

**2. E2E Browser Tests** (`.github/workflows/e2e.yml`)
- **Triggers**: Pull Requests, nightly schedule (2 AM UTC), manual dispatch
- **Jobs**:
  - **Browser Tests**: Runs Playwright tests with Chromium
  - **Multi-Browser Matrix**: Tests on Chromium, Firefox, and Webkit (nightly/manual only)
- **Artifacts**: Screenshots, videos, and test reports on failure
- **Timeout**: 20 minutes (single), 30 minutes (matrix)

**3. Code Quality** (`.github/workflows/code-quality.yml`)
- **Triggers**: Push and Pull Requests to main/develop
- **Jobs**:
  - **CodeQL**: Security vulnerability scanning
  - **Dependency Review**: Checks for vulnerable/problematic dependencies
  - **Prettier Check**: Code formatting validation
  - **Commit Lint**: Validates conventional commit messages
  - **Code Metrics**: Lines of code and bundle size reporting

**4. Dependabot** (`.github/dependabot.yml`)
- **Schedule**: Weekly updates on Mondays at 9 AM
- **Scope**: npm dependencies and GitHub Actions
- **Configuration**:
  - Groups minor/patch updates together
  - Separate groups for dev and production dependencies
  - Auto-assigns to @delwwwinc
  - Uses conventional commit format

### Workflow Status Badges

Add these to your README.md to show CI status:

```markdown
![CI](https://github.com/delwwwinc/edonis/workflows/CI/badge.svg)
![E2E](https://github.com/delwwwinc/edonis/workflows/E2E%20Browser%20Tests/badge.svg)
![Code Quality](https://github.com/delwwwinc/edonis/workflows/Code%20Quality/badge.svg)
```

### Running Workflows Locally

To simulate CI checks before pushing:

```bash
# Run all CI checks locally
bun run lint && bun run typecheck && bun run build && node ace test

# Run browser tests locally
node ace db:seed && node ace test browser

# Check code formatting
bun run format --check
```

### Environment Variables for CI

The following environment variables are configured in GitHub Actions:

- `NODE_ENV`: Set to `test`
- `APP_KEY`: Test-only encryption key
- `DB_*`: PostgreSQL connection details (from service container)
- `PORT` / `HOST`: Server configuration

**Note**: Never commit real credentials. Use GitHub Secrets for production deployments.

### Conventional Commit Format

All commits must follow the conventional commits specification:

```
type(scope): description

Examples:
feat(auth): add SSO login with SAML 2.0
fix(users): resolve hydration error in user list
docs(readme): update installation instructions
chore(deps): update dependencies
```

Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`

## Product Vision & Strategy

### Market Positioning

Edonis LMS aims to succeed by combining:
- **Modern architecture** (AdonisJS/TypeScript) for superior developer experience
- **Mobile-first design** with Progressive Web App capabilities
- **Native AI integration** for personalized learning and content generation
- **Cost advantages and transparency** of open-source software
- **Apache 2.0 licensing** for enterprise adoption without licensing concerns

### Key Success Factors

1. **Modular Monolithic Architecture**: Start simple, scale when needed
2. **Educational Standards Compliance**: SCORM 2004, xAPI, LTI 1.3, QTI 2.1
3. **Hybrid Funding Model**: Open-core features + professional services
4. **Developer Experience First**: TypeScript-first, comprehensive docs, easy customization

### Target Scale

Architecture designed to support **10,000+ concurrent users** through:
- Horizontal scaling with multiple AdonisJS instances
- Read replicas for read-heavy operations
- Redis cluster for session storage and caching
- Connection pooling (pgBouncer) for database efficiency

## Architecture Overview

This is an **AdonisJS 6** application using **Inertia.js** with **React 19** for a modern monolithic architecture (no separate API/frontend builds).

### Architectural Principles

1. **Modular Monolithic Design**: Clear module boundaries for future microservices evolution if needed
2. **Domain-Driven Structure**: Organized by business domains, not technical layers
3. **Multi-Tenancy Ready**: Shared database with tenant isolation via `tenant_id`
4. **Type-Safe Throughout**: TypeScript for backend, frontend, and API contracts
5. **Standards Compliant**: Built-in support for educational standards (SCORM, xAPI, LTI, QTI)

### Planned Module Structure

```
src/
├── modules/
│   ├── user-management/          # Authentication, profiles, SSO
│   ├── course-management/        # Course creation, organization, templates
│   ├── learning-delivery/        # Content delivery, progress tracking
│   ├── assessment-engine/        # Quizzes, assignments, grading, rubrics
│   ├── analytics-reporting/      # Learning analytics, xAPI statements
│   ├── communication/            # Forums, messaging, notifications
│   ├── content-authoring/        # Course content creation tools
│   ├── ai-integration/           # AI-powered features (content gen, tutoring)
│   └── standards-compliance/     # SCORM, LTI, QTI implementations
├── shared/                       # Common utilities and services
└── infrastructure/               # Database, caching, external services
```

### Current Implementation

**Monolithic SPA**: Uses Inertia.js to build SPAs without building an API. Server-side routing with client-side navigation.

**SSR Enabled**: Server-side rendering is configured in `vite.config.ts` for better SEO and initial page load.

**Subpath Imports**: The project uses Node.js subpath imports (defined in `package.json`) instead of relative imports:
- `#controllers/*` → `./app/controllers/*.js`
- `#models/*` → `./app/models/*.js`
- `#middleware/*` → `./app/middleware/*.js`
- `#validators/*` → `./app/validators/*.js`
- Frontend uses `~/` alias → `./inertia/`

**Authentication & Authorization**: 
- Session-based auth with `@adonisjs/auth`
- Role-based access control (RBAC) with custom middleware
- User-Role-Permission pattern via database models
- Custom `role` middleware in `app/middleware/role_middleware.ts`

**Database**: PostgreSQL with Lucid ORM. Two setup options:
- **Supabase Local** (recommended): Full Supabase stack locally
- **Docker Compose**: Simple PostgreSQL container

### Directory Structure

```
app/
├── controllers/     # HTTP request handlers
├── models/          # Lucid ORM models (User, Role, UserRole, etc.)
├── middleware/      # Request middleware (auth, guest, role, etc.)
├── validators/      # VineJS validation schemas
└── exceptions/      # Custom exception classes

config/              # AdonisJS configuration files
├── auth.ts          # Authentication configuration
├── database.ts      # Database connection settings
├── inertia.ts       # Inertia.js configuration
└── ...

database/
├── migrations/      # Database schema migrations
└── seeders/         # Database seeders (roles, test users)

inertia/
├── app/
│   ├── app.tsx      # Client-side entry point
│   └── ssr.tsx      # Server-side rendering entry
├── pages/           # Inertia pages (route components)
│   ├── auth/        # Login, register pages
│   ├── users/       # User CRUD pages
│   ├── dashboard.tsx
│   └── home.tsx
├── components/
│   └── ui/          # shadcn/ui components
├── css/
│   └── app.css      # Tailwind CSS with custom theme
└── lib/
    └── utils.ts     # Utility functions (cn helper)

start/
├── routes.ts        # Application routes definition
└── kernel.ts        # Middleware registration

resources/
└── views/           # Edge templates (only root.edge for Inertia)
```

## Multi-Tenancy Architecture

### Database Design Pattern

**Shared Database with Tenant ID** approach for optimal cost-effectiveness and operational simplicity:

```sql
-- Multi-tenant table structure pattern
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructor_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Performance indexes
    INDEX idx_tenant_courses (tenant_id, id),
    INDEX idx_instructor_courses (instructor_id, tenant_id),
    
    -- Row-level security
    CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

### Tenant Isolation Strategy

**Model-Level Enforcement**:

```typescript
// Base multi-tenant model
export default class TenantAwareModel extends BaseModel {
  @column()
  declare tenantId: string

  // Automatically scope all queries by tenant
  public static boot() {
    super.boot()
    
    this.before('find', (query) => {
      const tenantId = getCurrentTenantId() // From context
      query.where('tenant_id', tenantId)
    })
  }
}
```

**Middleware Protection**:

```typescript
// Ensure tenant context for all requests
export default class TenantMiddleware {
  async handle({ auth, request }: HttpContext, next: NextFn) {
    const user = auth.user!
    const tenantId = user.tenantId
    
    // Set tenant context for this request
    setRequestTenantId(tenantId)
    
    await next()
  }
}
```

## Real-Time Features Architecture

### WebSocket Implementation

For live collaboration (whiteboard, document editing):

```typescript
// Collaborative editing service with operational transformation
import { Server } from 'socket.io'

export class CollaborativeDocumentService {
  private io: Server

  public async handleDocumentEdit(
    documentId: string, 
    operation: Operation, 
    userId: string
  ) {
    // Transform operation based on current document state
    const transformedOp = await this.transformOperation(operation, documentId)
    
    // Apply operation to document
    await Document.applyOperation(documentId, transformedOp)
    
    // Broadcast to collaborators
    this.io.to(`document-${documentId}`).emit('document-operation', {
      operation: transformedOp,
      userId,
      timestamp: Date.now()
    })
  }
  
  private async transformOperation(
    operation: Operation, 
    documentId: string
  ): Promise<Operation> {
    // Operational transformation algorithm for concurrent editing
    const pendingOps = await this.getPendingOperations(documentId)
    return this.applyTransformations(operation, pendingOps)
  }
}
```

### Server-Sent Events (SSE)

For unidirectional real-time updates (notifications, progress):

```typescript
// Using AdonisJS Transmit for SSE
import transmit from '@adonisjs/transmit/services/main'

export class NotificationService {
  public async sendNotification(userId: string, notification: Notification) {
    // Send real-time notification via SSE
    transmit.broadcast(`user/${userId}/notifications`, {
      type: 'notification',
      data: notification
    })
    
    // Also persist for offline users
    await Notification.create({ userId, ...notification })
  }
}
```

## Plugin System Architecture

### Plugin Interface Definition

WordPress-inspired but with modern TypeScript security:

```typescript
// Core plugin interface
interface LMSPlugin {
  name: string
  version: string
  author: string
  license: string
  dependencies: PluginDependency[]
  permissions: PluginPermission[]
  
  // Lifecycle hooks
  initialize(): Promise<void>
  activate?(): Promise<void>
  deactivate?(): Promise<void>
  uninstall?(): Promise<void>
  
  // Extension points
  getRoutes?(): Route[]
  getMiddleware?(): Middleware[]
  getViewComponents?(): ViewComponent[]
  getDatabaseMigrations?(): Migration[]
  getEventListeners?(): EventListener[]
  
  // Configuration
  getSettings?(): PluginSettings
  validateSettings?(settings: unknown): Promise<boolean>
}

// Plugin security sandbox
export class PluginSecurityService {
  public async validatePlugin(plugin: LMSPlugin): Promise<ValidationResult> {
    const checks = await Promise.all([
      this.verifyCodeSignature(plugin),
      this.scanDependencies(plugin),
      this.validatePermissions(plugin),
      this.checkAPICompliance(plugin)
    ])
    
    return this.aggregateResults(checks)
  }
  
  public createSandbox(plugin: LMSPlugin): PluginSandbox {
    // Isolated execution environment with limited API access
    return new PluginSandbox({
      allowedAPIs: plugin.permissions,
      memoryLimit: '256MB',
      cpuLimit: '50%',
      networkAccess: plugin.permissions.includes('network')
    })
  }
}
```

### Plugin Discovery and Management

```typescript
// Plugin registry and management
export class PluginRegistry {
  private plugins: Map<string, LoadedPlugin> = new Map()
  
  public async discoverPlugins(): Promise<Plugin[]> {
    // Scan plugins directory
    const pluginDirs = await this.scanPluginDirectories()
    
    // Load and validate plugin manifests
    const plugins = await Promise.all(
      pluginDirs.map(dir => this.loadPluginManifest(dir))
    )
    
    return plugins.filter(p => p !== null)
  }
  
  public async installPlugin(pluginId: string): Promise<void> {
    const plugin = await this.downloadPlugin(pluginId)
    
    // Security validation
    const validation = await this.securityService.validatePlugin(plugin)
    if (!validation.isValid) {
      throw new PluginSecurityError(validation.errors)
    }
    
    // Install dependencies
    await this.installDependencies(plugin)
    
    // Run migrations
    await this.runMigrations(plugin)
    
    // Initialize plugin
    await plugin.initialize()
    
    // Register in system
    this.plugins.set(plugin.name, plugin)
  }
}
```

## Essential Feature Roadmap

### MVP Features (Phase 1)

**User Management Module**:
- ✅ Multi-role system (admin, instructor, student, guest)
- ✅ Role-based access control (RBAC)
- [ ] SSO integration (SAML 2.0, OAuth 2.0)
- [ ] Bulk user import/management
- [ ] Parent/guardian portal access

**Course Management Module**:
- ✅ Drag-and-drop course builder (content builder with modules)
- ✅ Content organization (modules, lessons, activities)
- ✅ Enrollment systems (self-enroll, manual, bulk, key-based, request-based)
- ✅ Course categories and hierarchical organization
- ✅ Course approval workflow
- ✅ Course permissions and sharing
- ✅ Course groups and groupings
- [ ] Course templates and cloning

**Assessment Engine Module**:
- ✅ Assignment creation and management
- ✅ Multiple assignment types (essay, file_upload, online_text, offline)
- ✅ Rubric support and grading criteria
- ✅ Multiple grading types (points, percentage, letter, pass/fail)
- ✅ Late submission policies and penalties
- ✅ Multiple attempts per assignment
- [ ] Quiz builder with question banks
- [ ] Multiple question types (MCQ, essay, file upload, etc.)
- [ ] Peer assessment capabilities

**Gradebook Module**:
- ✅ Category-based grading system
- ✅ Weighted score calculations
- ✅ Progress tracking dashboards (student and instructor views)
- ✅ Grade overview across all courses
- ✅ Assignment submission tracking
- ✅ Feedback system with grader attribution
- [ ] Grade export (CSV, PDF)
- [ ] Parent portal access to grades

**Communication Module**:
- [ ] Discussion forums with threading
- [ ] Direct messaging system
- [ ] Announcements and news feed
- [ ] Video conferencing integration (Zoom, Google Meet)
- [ ] Email notifications

**Calendar Module**:
- [ ] Integrated scheduling system
- [ ] Event management (assignments, quizzes, meetings)
- [ ] Deadline reminders and notifications
- [ ] Resource booking (rooms, equipment)

### AI-Powered Features (Phase 2)

**Content Generation** (addressing 47% CAGR in AI education):

```typescript
// AI content generation service
export class AIContentService {
  public async generateQuiz(
    topic: string, 
    difficulty: 'easy' | 'medium' | 'hard',
    questionCount: number
  ): Promise<Quiz> {
    const prompt = this.buildQuizPrompt(topic, difficulty, questionCount)
    
    const response = await this.aiProvider.generate(prompt)
    
    return {
      title: `${topic} Quiz`,
      questions: this.parseQuizResponse(response),
      difficulty,
      generatedAt: new Date()
    }
  }
  
  public async generateSummary(content: string): Promise<string> {
    return await this.aiProvider.summarize(content, {
      maxLength: 500,
      style: 'educational'
    })
  }
  
  public async generateLearningObjectives(
    content: string
  ): Promise<string[]> {
    const prompt = `Generate 3-5 SMART learning objectives for: ${content}`
    const response = await this.aiProvider.generate(prompt)
    return this.parseLearningObjectives(response)
  }
}
```

**Personalized Learning**:

```typescript
// Adaptive learning path engine
export class AdaptiveLearningService {
  public async generatePersonalizedPath(
    studentId: string,
    courseId: string
  ): Promise<LearningPath> {
    // Analyze student performance
    const performance = await this.analyzePerformance(studentId, courseId)
    
    // Get learning style preferences
    const preferences = await this.getLearningPreferences(studentId)
    
    // Generate adaptive path
    const path = await this.aiProvider.generatePath({
      performance,
      preferences,
      courseContent: await this.getCourseContent(courseId)
    })
    
    return path
  }
  
  public async recommendNextActivity(
    studentId: string,
    currentActivity: string
  ): Promise<Activity> {
    // AI-powered recommendation based on performance patterns
    const recommendations = await this.aiProvider.recommend({
      studentId,
      currentActivity,
      performanceHistory: await this.getPerformanceHistory(studentId)
    })
    
    return recommendations[0]
  }
}
```

**Automated Assessment**:

```typescript
// AI essay scoring service
export class AutomatedAssessmentService {
  public async scoreEssay(
    essay: string,
    rubric: Rubric
  ): Promise<EssayScore> {
    const analysis = await this.aiProvider.analyzeEssay(essay, {
      grammar: true,
      coherence: true,
      contentQuality: true,
      rubricAlignment: rubric
    })
    
    return {
      overallScore: analysis.score,
      criteriaScores: analysis.criteriaBreakdown,
      feedback: analysis.constructiveFeedback,
      suggestions: analysis.improvementSuggestions,
      confidence: analysis.confidenceLevel
    }
  }
  
  public async detectPlagiarism(
    submission: string,
    compareAgainst: string[]
  ): Promise<PlagiarismReport> {
    return await this.aiProvider.checkSimilarity(submission, compareAgainst)
  }
}
```

**Intelligent Tutoring**:

```typescript
// 24/7 AI tutoring chatbot
export class AITutoringService {
  public async handleStudentQuery(
    query: string,
    context: ConversationContext
  ): Promise<TutoringResponse> {
    const response = await this.aiProvider.generateTutoringResponse({
      query,
      context,
      courseContent: context.currentLesson,
      studentLevel: await this.assessStudentLevel(context.studentId)
    })
    
    return {
      answer: response.text,
      relatedResources: response.suggestedResources,
      followUpQuestions: response.followUpQuestions,
      confidence: response.confidence
    }
  }
}
```

### Mobile-First Design (Progressive Web App)

**Offline Functionality**:

```typescript
// Service worker for offline support
export class OfflineContentService {
  public async downloadCourseForOffline(
    courseId: string
  ): Promise<void> {
    const content = await this.fetchCourseContent(courseId)
    
    // Cache course materials
    await this.cacheContent(content.videos, 'course-videos')
    await this.cacheContent(content.documents, 'course-docs')
    await this.cacheContent(content.images, 'course-images')
    
    // Store course data in IndexedDB
    await this.storeOfflineData(courseId, content.data)
  }
  
  public async syncOfflineProgress(): Promise<void> {
    // Background sync when online
    const pendingUpdates = await this.getPendingUpdates()
    
    for (const update of pendingUpdates) {
      await this.syncUpdate(update)
    }
  }
}
```

**Touch-Optimized Interface**:
- Gesture navigation (swipe, pinch, pull-to-refresh)
- Thumb-friendly design patterns (bottom navigation)
- Large touch targets (minimum 44x44px)
- Responsive typography and spacing

**Push Notifications**:

```typescript
// Web Push notification service
export class PushNotificationService {
  public async sendNotification(
    userId: string,
    notification: Notification
  ): Promise<void> {
    const subscription = await this.getSubscription(userId)
    
    await webPush.sendNotification(subscription, {
      title: notification.title,
      body: notification.body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: notification.data,
      actions: notification.actions
    })
  }
}
```

## Educational Standards Compliance

### SCORM 2004 Implementation

```typescript
// SCORM API wrapper
export class SCORMService {
  public initializeSCO(scoId: string, studentId: string): SCORMAPI {
    return {
      Initialize: () => this.handleInitialize(scoId, studentId),
      Terminate: () => this.handleTerminate(scoId, studentId),
      GetValue: (element: string) => this.getValue(scoId, element),
      SetValue: (element: string, value: string) => 
        this.setValue(scoId, studentId, element, value),
      Commit: () => this.commit(scoId, studentId),
      GetLastError: () => this.getLastError(),
      GetErrorString: (errorCode: string) => this.getErrorString(errorCode),
      GetDiagnostic: (errorCode: string) => this.getDiagnostic(errorCode)
    }
  }
  
  private async setValue(
    scoId: string, 
    studentId: string, 
    element: string, 
    value: string
  ): Promise<boolean> {
    // Store SCORM data model values
    await SCORMData.updateOrCreate(
      { scoId, studentId, element },
      { value, updatedAt: new Date() }
    )
    return true
  }
}
```

### xAPI (Experience API) Implementation

```typescript
// xAPI statement tracking
export class XAPIService {
  public async trackStatement(
    actor: Actor,
    verb: Verb,
    object: ActivityObject,
    result?: Result,
    context?: Context
  ): Promise<void> {
    const statement: XAPIStatement = {
      actor: {
        name: actor.name,
        mbox: `mailto:${actor.email}`,
        objectType: 'Agent'
      },
      verb: {
        id: verb.id,
        display: { 'en-US': verb.display }
      },
      object: {
        id: object.id,
        objectType: 'Activity',
        definition: {
          name: { 'en-US': object.name },
          description: { 'en-US': object.description },
          type: object.type
        }
      },
      result,
      context,
      timestamp: new Date().toISOString(),
      stored: new Date().toISOString()
    }
    
    // Store in Learning Record Store (LRS)
    await this.lrs.storeStatement(statement)
    
    // Emit for real-time analytics
    await this.analyticsService.processStatement(statement)
  }
}

// Example usage
await xapiService.trackStatement(
  { name: 'John Doe', email: 'john@example.com' },
  { id: 'http://adlnet.gov/expapi/verbs/completed', display: 'completed' },
  { 
    id: 'http://lms.example.com/course/intro-biology/module-1',
    name: 'Cell Biology Module',
    description: 'Introduction to cell structure',
    type: 'http://adlnet.gov/expapi/activities/module'
  },
  { 
    score: { scaled: 0.85 },
    completion: true,
    duration: 'PT45M'
  }
)
```

### LTI 1.3 Integration

```typescript
// LTI 1.3 tool provider implementation
export class LTIService {
  public async handleLaunchRequest(
    request: LTILaunchRequest
  ): Promise<LTIResponse> {
    // Validate JWT token
    const claims = await this.validateIdToken(request.id_token)
    
    // Extract user and context
    const user = await this.mapLTIUser(claims)
    const context = await this.mapLTIContext(claims)
    
    // Create or update session
    const session = await this.createLTISession(user, context, claims)
    
    // Return launch URL with session
    return {
      launchUrl: this.buildLaunchUrl(session),
      sessionId: session.id
    }
  }
  
  public async handleGradePassback(
    lineItemUrl: string,
    studentId: string,
    score: number
  ): Promise<void> {
    // Send grade back to LMS via LTI Assignment and Grade Services
    await this.ltiAGS.publishScore(lineItemUrl, {
      userId: studentId,
      scoreGiven: score,
      scoreMaximum: 100,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      timestamp: new Date().toISOString()
    })
  }
  
  public async handleDeepLinking(
    request: DeepLinkingRequest
  ): Promise<DeepLinkingResponse> {
    // Return content items for deep linking
    return {
      contentItems: [
        {
          type: 'ltiResourceLink',
          title: 'Interactive Quiz',
          url: 'https://lms.example.com/quiz/123',
          custom: {
            quiz_id: '123'
          }
        }
      ]
    }
  }
}
```

### QTI 2.1 Assessment Interoperability

```typescript
// QTI question import/export service
export class QTIService {
  public async importQTI(qtiXml: string): Promise<Question[]> {
    const doc = this.parseQTI(qtiXml)
    const questions: Question[] = []
    
    // Parse assessment items
    for (const item of doc.assessmentItems) {
      const question = await this.mapQTIItem(item)
      questions.push(question)
    }
    
    return questions
  }
  
  public async exportQTI(questions: Question[]): Promise<string> {
    const assessment = this.createQTIAssessment()
    
    for (const question of questions) {
      const item = this.mapQuestionToQTI(question)
      assessment.addItem(item)
    }
    
    return assessment.toXML()
  }
  
  private mapQTIItem(item: QTIAssessmentItem): Question {
    return {
      type: this.mapQTIInteractionType(item.interaction),
      title: item.title,
      prompt: item.itemBody.content,
      choices: this.extractChoices(item.interaction),
      correctResponse: this.extractCorrectResponse(item.responseDeclaration),
      metadata: {
        qtiIdentifier: item.identifier,
        qtiVersion: '2.1'
      }
    }
  }
}
```

## Frontend Architecture (Inertia + React)

### Styling: Tailwind CSS v4 + shadcn/ui

- **Tailwind v4**: Uses new `@import 'tailwindcss'` and `@theme` syntax
- **shadcn/ui**: Pre-built accessible components using Radix UI primitives
- **Theme**: Custom color system defined in `inertia/css/app.css` with CSS variables
- **Icons**: Lucide React icons

### Inertia.js Patterns

**Page Components**: Located in `inertia/pages/`, they receive props from controllers:

```typescript
interface Props {
  user: User
  // Props are passed from controller via inertia.render()
}

export default function Dashboard({ user }: Props) {
  // Component code
}
```

**Forms**: Use `useForm` hook from `@inertiajs/react`:

```typescript
import { useForm } from '@inertiajs/react'

const { data, setData, post, processing, errors } = useForm({
  email: '',
  password: '',
})

const handleSubmit = (e: FormEvent) => {
  e.preventDefault()
  post('/login')
}
```

**Navigation**: Use `<Link>` component or `router` for client-side navigation:

```typescript
import { Link } from '@inertiajs/react'

<Link href="/dashboard">Dashboard</Link>
```

### Component Organization

- **UI Components**: `inertia/components/ui/` - shadcn/ui components (Button, Input, Card, etc.)
- **Page Components**: `inertia/pages/` - Full page components rendered by routes
- **Utility**: `inertia/lib/utils.ts` - Helper functions like `cn()` for class merging

## Backend Architecture (AdonisJS)

### Routing Pattern

Routes are defined in `start/routes.ts` with controller actions:

```typescript
router.get('/users', [UsersController, 'index']).as('users.index')
router.post('/users', [UsersController, 'store']).as('users.store')
```

**Route Groups**: Used for applying middleware to multiple routes:

```typescript
router
  .group(() => {
    router.get('/users', [UsersController, 'index'])
  })
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin', 'manager'] }))
```

### Controller Pattern

Controllers return Inertia responses for pages:

```typescript
import type { HttpContext } from '@adonisjs/core/http'

export default class UsersController {
  async index({ inertia }: HttpContext) {
    const users = await User.query().preload('roles')
    
    return inertia.render('users/index', {
      users: users.serialize()
    })
  }
}
```

### Models & Relationships

Models use Lucid ORM with decorators:

```typescript
import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @manyToMany(() => Role, {
    pivotTable: 'user_roles',
  })
  declare roles: ManyToMany<typeof Role>
}
```

### Validation

VineJS validators in `app/validators/`:

```typescript
import vine from '@vinejs/vine'

export const createUserValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string().minLength(8),
  })
)
```

Use in controllers:

```typescript
const payload = await request.validateUsing(createUserValidator)
```

### Authentication & Authorization

**Auth Middleware**: Protects routes requiring authentication
- `middleware.auth()` - Requires authenticated user
- `middleware.guest()` - Requires unauthenticated user

**Role Middleware**: Custom RBAC implementation
- `middleware.role({ roles: ['admin', 'manager'] })` - Requires specific roles
- Defined in `app/middleware/role_middleware.ts`

**Access User in Controllers**:

```typescript
async index({ auth }: HttpContext) {
  const user = auth.user! // Guaranteed by auth middleware
  const hasRole = await user.hasRole('admin')
}
```

## Database Conventions

1. **Migrations**: Timestamped files in `database/migrations/`
   - Use `node ace make:migration` to create
   - Always include `up()` and `down()` methods

2. **Naming**:
   - Tables: plural snake_case (`users`, `user_roles`, `courses`)
   - Foreign keys: `{table}_id` (`user_id`, `role_id`, `tenant_id`)
   - Pivot tables: alphabetically ordered (`role_user` not `user_role`)

3. **Timestamps**: Most tables include `created_at` and `updated_at`

4. **Multi-Tenancy**: All tenant-aware tables must include `tenant_id UUID NOT NULL`

5. **Soft Deletes**: Consider using `deleted_at` for important data rather than hard deletes

## Testing

### Testing Framework: Japa

The project uses Japa as its testing framework with multiple test suites:

```bash
# Run all tests
bun test

# Run specific test suite
node ace test functional    # API/Integration tests
node ace test browser       # E2E browser tests
node ace test unit          # Unit tests
```

### Browser Testing (E2E)

Browser tests use **@japa/browser-client**, which provides a Playwright-based testing solution officially integrated with AdonisJS.

**Configuration**: Located in `tests/bootstrap.ts`:

```typescript
import { browserClient } from '@japa/browser-client'

export const plugins: Config['plugins'] = [
  assert(),
  pluginAdonisJS(app),
  browserClient({
    runInSuites: ['browser'],
    contextOptions: {
      baseURL: 'http://localhost:3333',
    },
  }),
]
```

**Browser Test Example**:

```typescript
import { test } from '@japa/runner'

test.group('Authentication', () => {
  test('user can login with valid credentials', async ({ browser, visit }) => {
    const page = await visit('/login')
    
    await page.locator('input[name="email"]').fill('student@example.com')
    await page.locator('input[name="password"]').fill('password')
    await page.locator('button[type="submit"]').click()
    
    await page.waitForURL('/dashboard')
    await page.locator('text=Welcome back').isVisible()
  })
})
```

**Available Browser Tests**:
- `tests/browser/auth.spec.ts` - Authentication flows (login, register, logout)
- `tests/browser/user_management.spec.ts` - Admin user management operations
- `tests/browser/navigation.spec.ts` - Navigation and access control

**Browser Test Features**:
- Full Playwright API access
- Automatic server startup/shutdown
- Screenshot capture on failure
- Video recording support
- Mobile device emulation
- Network interception

**Running Browser Tests**:

```bash
# Run all browser tests
node ace test browser

# Run specific test file
node ace test browser tests/browser/auth.spec.ts

# Run with headed browser (visible UI)
HEADLESS=false node ace test browser

# Run with specific browser
BROWSER=firefox node ace test browser  # chromium (default), firefox, webkit
```

**Best Practices**:
- Test critical user journeys end-to-end
- Use data-testid attributes for stable selectors
- Clean up test data in afterEach hooks
- Keep tests isolated and independent
- Use page objects for complex pages

### API/Integration Testing

Functional tests use Japa's HTTP client:

```typescript
test('can login with valid credentials', async ({ client }) => {
  const response = await client.post('/login').json({
    email: 'test@example.com',
    password: 'password',
  })

  response.assertStatus(200)
  response.assertBodyContains({ success: true })
})
```

### Unit Testing

Unit tests for models, services, and utilities:

```typescript
test('user can check if they have a role', async ({ assert }) => {
  const user = await User.find(1)
  const hasRole = await user.hasRole('admin')
  
  assert.isTrue(hasRole)
})

## Common Development Patterns

### Adding a New Module/Feature

1. **Create Migration**: `node ace make:migration create_courses_table`
2. **Create Model**: `node ace make:model Course`
3. **Create Controller**: `node ace make:controller CoursesController`
4. **Create Validator**: `node ace make:validator course`
5. **Define Routes**: Add to `start/routes.ts`
6. **Create Inertia Pages**: Add in `inertia/pages/courses/`
7. **Add UI Components**: Use shadcn/ui components from `inertia/components/ui/`
8. **Write Tests**: Add integration tests

### Working with Inertia Shared Data

Shared data (available on all pages) is configured in `config/inertia.ts`:

```typescript
sharedData: {
  auth: (ctx) => {
    return {
      user: ctx.auth.user,
    }
  },
}
```

Access in any page component via props:

```typescript
interface SharedProps {
  auth: {
    user: User | null
  }
}
```

## Production Build

```bash
# Build the application
bun run build

# The build outputs to ./build/ directory
cd build
bun install --production
node bin/server.js
```

The build process:
1. Compiles TypeScript backend code
2. Builds frontend assets with Vite (client + SSR bundles)
3. Copies meta files (views, public assets)

## Environment Configuration

Key environment variables:

```env
# App
PORT=3333
HOST=localhost
NODE_ENV=development
APP_KEY=<generated-key>  # Generate with: node ace generate:key

# Database (PostgreSQL)
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_DATABASE=edonis_lms

# Session
SESSION_DRIVER=cookie

# Supabase (optional)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<key>
SUPABASE_SERVICE_KEY=<key>

# AI Integration (future)
OPENAI_API_KEY=<key>
AI_PROVIDER=openai  # openai, anthropic, local

# LTI Configuration (future)
LTI_KEY=<key>
LTI_SECRET=<secret>
```

## Important Development Notes

- **HMR (Hot Module Replacement)**: Configured for controllers and middleware via `hot-hook` boundaries in `package.json`
- **SSR**: Server-side rendering is enabled; changes to SSR entry require server restart
- **Type Safety**: Use TypeScript everywhere; run `bun run typecheck` before committing
- **Migrations**: Always create reversible migrations with proper `down()` methods
- **Authorization**: Check both authentication AND authorization in protected routes
- **Multi-Tenancy**: Always include `tenant_id` in tenant-aware queries
- **Performance**: Consider query optimization and caching for high-traffic routes
- **Security**: Sanitize user input, use parameterized queries, validate on both client and server
