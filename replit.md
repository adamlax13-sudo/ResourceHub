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
  - `users` - User profiles with Replit ID and optional demographics (age, gender, race, sexuality, education, religion, inAddiction, university, location, customLocation, disability, serviceFormat, supportStyle, profileCompleted)
  - `searches` - Cached AI search results
  - `favorites` - User saved resources with progress tracking
  - `recommendations_cache` - Cached AI recommendations based on profile hash

### User Profile & Personalization
- **Optional Demographics**: 13 fields total - age range, gender identity, race/ethnicity, sexual orientation, education level, religion/spirituality, addiction recovery status, university/college (includes "Not in university" and "In High School" options), location (major Alberta cities dropdown), custom location (text input when "Other" selected), disability status, service format preference (virtual/in-person), support style preference (one-on-one/group) (all optional)
- **Location-Based Recommendations**: User's location is used to prioritize geographically relevant services in AI recommendations
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
- **Search results**: Cached in database with normalized keys (trim + lowercase) for better hit rates
- **Recommendations cache**: Server-side caching based on user profile hash (demographics + favorite categories)
- **Cache invalidation**: Recommendations cache auto-invalidates when profile changes or favorites change
- **Duplicate prevention**: Favorites API returns 409 if service already saved
- **React Query**: staleTime: Infinity prevents unnecessary refetches

### Background Prefetching
- **Recommendations**: Prefetched after sign-in using requestIdleCallback
- **Low priority**: Runs only when browser is idle (after 1.5s fallback)
- **Hook**: client/src/hooks/use-prefetch-recommendations.ts
- **Cache**: Data ready before user navigates to Recommended page

### AI Optimizations
- **Streamlined prompts**: Reduced token count while maintaining quality requirements
- **Variable temperature**: temperature: 0.3-0.4 depending on task complexity
- **Service-specific steps**: AI generates organization-specific intake processes with 3-8 steps based on service complexity
- **Skeleton loading**: Recommended page shows skeleton cards during AI processing for better perceived performance
- **Comprehensive Reference Database**: 250+ line ALBERTA_SERVICES_REFERENCE in server/routes.ts covering:
  - 24/7 Crisis Lines (211, 311, 811, 988, Mental Health Helpline, Addiction Helpline, Distress Centre, ConnecTeen, Kids Help Phone, Hope for Wellness, Indigenous Support Line)
  - Calgary Mental Health Urgent Care Centres (Sheldon Chumir 24/7, South Calgary, Airdrie, Banff, Canmore, Cochrane, Okotoks)
  - Calgary/Edmonton Mental Health & Addiction Services (RAAM, Renfrew Recovery, Calgary Dream Centre, CMHA, etc.)
  - Low-Cost/Sliding Scale Counselling (Calgary Counselling Centre, Community Connect YYC, Jade Counselling)
  - Indigenous Services (Miskanawah, AFCC, Niitoiyis, Sunrise Healing Lodge, Poundmaker's Lodge, Hope for Wellness)
  - Peer-Based Recovery Support (AA, NA, SMART Recovery, Al-Anon, gambling/eating disorder support)
  - University/College Campus Services (UCalgary, UofA, MRU, MacEwan, NAIT, SAIT, etc.)
  - LGBTQ2S+ Services (Calgary Outlink, Skipping Stone, Pride Centre, Camp fYrefly)
  - Domestic Violence & Sexual Assault resources (CCASA, Fear Is Not Love, Ruth House)
  - Baby & Parenting Resources (Calgary Pregnancy Care, Best Beginning, Made by Momma)
  - Free Food Resources (Calgary Food Bank, The Alex CFC, Calgary Drop-In, community churches)
  - Basic Needs & Community Resources (WINS Hubs, Mustard Seed, Rise Calgary, clothing rooms)
  - Detox & Residential Treatment Programs (Renfrew, Lander, Oxford House, George Spady)

### Accessibility
- **WCAG Compliance**: Hero search with proper labels, roles, and aria-describedby
- **Screen Reader Support**: sr-only labels, aria-hidden on decorative icons, aria-labels on buttons
- **Keyboard Navigation**: Service cards are keyboard-navigable with tabIndex and Enter key support
- **Reduced motion**: CSS @media (prefers-reduced-motion: reduce) disables animations
- **Smooth scrolling**: Only for users who prefer motion
- **Focus visible**: Clear outline styles for keyboard navigation
- **Skip link**: CSS class available for skip-to-content links