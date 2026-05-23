# Product Vision & Strategy

> Moved from CLAUDE.md — this is strategic context, not development guidance.

## Market Positioning

Edonis LMS aims to succeed by combining:

- **Modern architecture** (AdonisJS/TypeScript) for superior developer experience
- **Mobile-first design** with Progressive Web App capabilities
- **Native AI integration** for personalized learning and content generation
- **Cost advantages and transparency** of open-source software
- **Apache 2.0 licensing** for enterprise adoption without licensing concerns

## Key Success Factors

1. **Modular Monolithic Architecture**: Start simple, scale when needed
2. **Educational Standards Compliance**: SCORM 2004, xAPI, LTI 1.3, QTI 2.1
3. **Hybrid Funding Model**: Open-core features + professional services
4. **Developer Experience First**: TypeScript-first, comprehensive docs, easy customization

## Target Scale

Architecture designed to support **10,000+ concurrent users** through:

- Horizontal scaling with multiple AdonisJS instances
- Read replicas for read-heavy operations
- Redis cluster for session storage and caching
- Connection pooling (pgBouncer) for database efficiency
