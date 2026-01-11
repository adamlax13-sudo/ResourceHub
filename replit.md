# Recovery Hub - Campus Resource Search Application

## Overview

Recovery Hub is a campus resource discovery platform that helps users find recovery and support services. The application uses AI-powered search to match user queries with relevant resources, allowing users to save favorites and track their progress through service steps. Built with a React frontend and Express backend, it integrates with Replit Auth for authentication and OpenAI for intelligent search capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## Branding & Visual Design

### Logo
- **Asset**: attached_assets/About_Recovery_on_Campus_Alberta_1768060674341.png
- **Description**: ROC (Recovery on Campus) crystalline triangle logo in mauve purple
- **Placement**: Hero navigation (top left), MyResources header, Home footer

### Color Scheme
- **Primary Color**: HSL 285 35% 48% (mauve purple matching ROC logo)
- **Theme**: Purple/white based with dark mode support
- **Design Language**: Geometric/crystalline inspired by the triangular logo structure

### Geometric Design Elements
- Hero background features SVG triangle patterns inspired by the logo
- ServiceCard components have subtle triangle accents in corners
- Overall aesthetic emphasizes clean, modern, supportive feel

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for page transitions and interactions
- **Build Tool**: Vite with path aliases (@/, @shared/, @assets/)
- **Internationalization**: react-i18next with 10 languages (English, Spanish, French, Chinese, Arabic, Hindi, Portuguese, German, Japanese, Korean)

### Internationalization (i18n)
- **Configuration**: client/src/lib/i18n.ts
- **Translation Files**: client/src/locales/{lang}.json (en, es, fr, zh, ar, hi, pt, de, ja, ko)
- **Language Persistence**: Uses localStorage ('i18nextLng' key) to remember user preference
- **RTL Support**: Automatic document direction (rtl/ltr) for Arabic language
- **Default Language**: English
- **Components**: LanguageSwitcher dropdown in Hero and MyResources pages

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Structure**: RESTful endpoints defined in shared/routes.ts with Zod validation
- **Authentication**: Replit Auth with OpenID Connect (OIDC)
- **Session Management**: express-session with PostgreSQL store (connect-pg-simple)

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: shared/schema.ts
- **Tables**: 
  - `sessions` - Authentication session storage
  - `users` - User profiles with Replit ID and optional demographics (age, gender, race, sexuality, education, religion, inAddiction, university, profileCompleted)
  - `searches` - Cached AI search results
  - `favorites` - User saved resources with progress tracking

### User Profile & Personalization
- **Optional Demographics**: 8 fields total - age range, gender identity, race/ethnicity, sexual orientation, education level, religion/spirituality, addiction recovery status, university/college (all optional)
- **Profile Page**: /profile - Form to manage demographic preferences with descriptive help text
- **Recommendations Page**: /recommended - AI-powered personalized service recommendations
- **Privacy**: Demographics used only for recommendations, never shared with third parties
- **Onboarding Flow**: WelcomeModal prompts new users to complete profile after first login; uses session-based dismissal and backend profileCompleted flag
- **Profile Completion Tracking**: profileCompleted timestamp stored in database, set when user saves demographic info

### Key Design Patterns
- **Shared Types**: TypeScript types and Zod schemas shared between frontend and backend via @shared/ alias
- **API Route Definitions**: Centralized in shared/routes.ts with method, path, input validation, and response schemas
- **Storage Abstraction**: DatabaseStorage class implements IStorage interface for data access
- **Replit Integrations**: Modular integration patterns in server/replit_integrations/ for auth, chat, batch processing, and image generation

### Build Configuration
- Development: `tsx server/index.ts` with Vite dev server middleware
- Production: Custom build script bundles server with esbuild, client with Vite
- Output: dist/index.cjs (server) and dist/public/ (static assets)

## External Dependencies

### AI Services
- **OpenAI API**: Used for intelligent resource search (gpt-5.1 model)
- **Configuration**: AI_INTEGRATIONS_OPENAI_API_KEY and AI_INTEGRATIONS_OPENAI_BASE_URL environment variables
- **Image Generation**: gpt-image-1 model available via replit_integrations/image

### Authentication
- **Replit Auth**: OIDC-based authentication
- **Required Environment Variables**: ISSUER_URL, REPL_ID, SESSION_SECRET

### Database
- **PostgreSQL**: Required for production
- **Environment Variable**: DATABASE_URL
- **ORM**: Drizzle with drizzle-kit for schema migrations (`npm run db:push`)

### Third-Party Libraries
- **UI Components**: Full shadcn/ui component set with Radix UI primitives
- **Form Handling**: react-hook-form with @hookform/resolvers and Zod
- **Date Utilities**: date-fns
- **Icons**: Lucide React

## Performance Optimizations

### Code Splitting
- **Route-level**: All pages lazy-loaded via React.lazy (Home, MyResources, Profile, Recommended)
- **Component-level**: ServiceModal and WelcomeModal load on-demand
- **Suspense boundaries**: PageLoader component shows while chunks load

### Translation Loading
- **On-demand**: Only selected language loads; others fetch when switched
- **Default**: English loads immediately, other 9 languages lazy-load
- **Configuration**: client/src/lib/i18n.ts with partialBundledLanguages

### Image Optimization
- **Lazy loading**: Footer and empty-state logos use loading="lazy"
- **Header logos**: Load eagerly for branding visibility

### Caching
- **Search results**: Cached in database to avoid repeat AI calls
- **React Query**: staleTime: Infinity prevents unnecessary refetches

### Background Prefetching
- **Recommendations**: Prefetched after sign-in using requestIdleCallback
- **Low priority**: Runs only when browser is idle (after 1.5s fallback)
- **Hook**: client/src/hooks/use-prefetch-recommendations.ts
- **Cache**: Data ready before user navigates to Recommended page

### Accessibility
- **Reduced motion**: CSS @media (prefers-reduced-motion: reduce) disables animations
- **Smooth scrolling**: Only for users who prefer motion
- **Focus visible**: Clear outline styles for keyboard navigation
- **Skip link**: CSS class available for skip-to-content links