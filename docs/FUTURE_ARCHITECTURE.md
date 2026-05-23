# Future Architecture Specifications

> Moved from CLAUDE.md — these are planned/aspirational architecture designs for features not yet implemented.

## Table of Contents

- [Planned Module Structure](#planned-module-structure)
- [Multi-Tenancy Architecture](#multi-tenancy-architecture)
- [Real-Time Features Architecture](#real-time-features-architecture)
- [Plugin System Architecture](#plugin-system-architecture)
- [AI-Powered Features](#ai-powered-features)
- [Mobile-First Design (PWA)](#mobile-first-design-progressive-web-app)
- [Educational Standards Compliance](#educational-standards-compliance)

---

## Planned Module Structure

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

  public async handleDocumentEdit(documentId: string, operation: Operation, userId: string) {
    // Transform operation based on current document state
    const transformedOp = await this.transformOperation(operation, documentId)

    // Apply operation to document
    await Document.applyOperation(documentId, transformedOp)

    // Broadcast to collaborators
    this.io.to(`document-${documentId}`).emit('document-operation', {
      operation: transformedOp,
      userId,
      timestamp: Date.now(),
    })
  }

  private async transformOperation(operation: Operation, documentId: string): Promise<Operation> {
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
      data: notification,
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
      this.checkAPICompliance(plugin),
    ])

    return this.aggregateResults(checks)
  }

  public createSandbox(plugin: LMSPlugin): PluginSandbox {
    // Isolated execution environment with limited API access
    return new PluginSandbox({
      allowedAPIs: plugin.permissions,
      memoryLimit: '256MB',
      cpuLimit: '50%',
      networkAccess: plugin.permissions.includes('network'),
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
    const plugins = await Promise.all(pluginDirs.map((dir) => this.loadPluginManifest(dir)))

    return plugins.filter((p) => p !== null)
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

## AI-Powered Features

### Content Generation

Addressing 47% CAGR in AI education:

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
      generatedAt: new Date(),
    }
  }

  public async generateSummary(content: string): Promise<string> {
    return await this.aiProvider.summarize(content, {
      maxLength: 500,
      style: 'educational',
    })
  }

  public async generateLearningObjectives(content: string): Promise<string[]> {
    const prompt = `Generate 3-5 SMART learning objectives for: ${content}`
    const response = await this.aiProvider.generate(prompt)
    return this.parseLearningObjectives(response)
  }
}
```

### Personalized Learning

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
      courseContent: await this.getCourseContent(courseId),
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
      performanceHistory: await this.getPerformanceHistory(studentId),
    })

    return recommendations[0]
  }
}
```

### Automated Assessment

```typescript
// AI essay scoring service
export class AutomatedAssessmentService {
  public async scoreEssay(essay: string, rubric: Rubric): Promise<EssayScore> {
    const analysis = await this.aiProvider.analyzeEssay(essay, {
      grammar: true,
      coherence: true,
      contentQuality: true,
      rubricAlignment: rubric,
    })

    return {
      overallScore: analysis.score,
      criteriaScores: analysis.criteriaBreakdown,
      feedback: analysis.constructiveFeedback,
      suggestions: analysis.improvementSuggestions,
      confidence: analysis.confidenceLevel,
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

### Intelligent Tutoring

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
      studentLevel: await this.assessStudentLevel(context.studentId),
    })

    return {
      answer: response.text,
      relatedResources: response.suggestedResources,
      followUpQuestions: response.followUpQuestions,
      confidence: response.confidence,
    }
  }
}
```

## Mobile-First Design (Progressive Web App)

### Offline Functionality

```typescript
// Service worker for offline support
export class OfflineContentService {
  public async downloadCourseForOffline(courseId: string): Promise<void> {
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

### Touch-Optimized Interface

- Gesture navigation (swipe, pinch, pull-to-refresh)
- Thumb-friendly design patterns (bottom navigation)
- Large touch targets (minimum 44x44px)
- Responsive typography and spacing

### Push Notifications

```typescript
// Web Push notification service
export class PushNotificationService {
  public async sendNotification(userId: string, notification: Notification): Promise<void> {
    const subscription = await this.getSubscription(userId)

    await webPush.sendNotification(subscription, {
      title: notification.title,
      body: notification.body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: notification.data,
      actions: notification.actions,
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
      SetValue: (element: string, value: string) => this.setValue(scoId, studentId, element, value),
      Commit: () => this.commit(scoId, studentId),
      GetLastError: () => this.getLastError(),
      GetErrorString: (errorCode: string) => this.getErrorString(errorCode),
      GetDiagnostic: (errorCode: string) => this.getDiagnostic(errorCode),
    }
  }

  private async setValue(
    scoId: string,
    studentId: string,
    element: string,
    value: string
  ): Promise<boolean> {
    // Store SCORM data model values
    await SCORMData.updateOrCreate({ scoId, studentId, element }, { value, updatedAt: new Date() })
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
        objectType: 'Agent',
      },
      verb: {
        id: verb.id,
        display: { 'en-US': verb.display },
      },
      object: {
        id: object.id,
        objectType: 'Activity',
        definition: {
          name: { 'en-US': object.name },
          description: { 'en-US': object.description },
          type: object.type,
        },
      },
      result,
      context,
      timestamp: new Date().toISOString(),
      stored: new Date().toISOString(),
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
    type: 'http://adlnet.gov/expapi/activities/module',
  },
  {
    score: { scaled: 0.85 },
    completion: true,
    duration: 'PT45M',
  }
)
```

### LTI 1.3 Integration

```typescript
// LTI 1.3 tool provider implementation
export class LTIService {
  public async handleLaunchRequest(request: LTILaunchRequest): Promise<LTIResponse> {
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
      sessionId: session.id,
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
      timestamp: new Date().toISOString(),
    })
  }

  public async handleDeepLinking(request: DeepLinkingRequest): Promise<DeepLinkingResponse> {
    // Return content items for deep linking
    return {
      contentItems: [
        {
          type: 'ltiResourceLink',
          title: 'Interactive Quiz',
          url: 'https://lms.example.com/quiz/123',
          custom: {
            quiz_id: '123',
          },
        },
      ],
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
        qtiVersion: '2.1',
      },
    }
  }
}
```
