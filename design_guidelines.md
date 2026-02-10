# Recovery on Campus Resource Hub - Design Guidelines

## Design Approach

**Hybrid Reference Model**: Calm app's supportive warmth + Linear's clean functionality + Notion's information density

**Core Principles**:
- Safe, welcoming atmosphere through soft geometric elements
- Effortless discovery with prominent AI search
- Clear information hierarchy for stressed students
- Crystalline triangle motifs as subtle trust signals

## Typography System

**Heading Stack**:
- H1: 3.5rem (56px) / 4rem mobile, font-weight 700, tracking-tight
- H2: 2.5rem (40px) / 3rem mobile, font-weight 600
- H3: 1.75rem (28px), font-weight 600
- H4: 1.25rem (20px), font-weight 500

**Body Text**:
- Large: 1.125rem (18px), line-height relaxed (1.625)
- Base: 1rem (16px), line-height relaxed
- Small: 0.875rem (14px)

**Font Selection**: Inter or DM Sans for clean, approachable readability

## Layout & Spacing

**Spacing Scale**: Use Tailwind units of 3, 4, 6, 8, 12, 16, 20, 24
- Component padding: p-6 to p-8
- Section spacing: py-16 to py-24
- Card gaps: gap-6 or gap-8
- Container: max-w-7xl with px-6

## Component Library

**Hero Section** (100vh):
- Full-width background image: Warm, diverse students in supportive campus environment (bright, hopeful, inclusive)
- Centered content with backdrop-blur-md container (bg-white/10 dark:bg-black/20)
- Large heading: "Find Support. Start Your Recovery Journey."
- Subheading explaining AI-powered discovery
- Prominent AI search bar (h-16, rounded-2xl, white bg with shadow-2xl)
- Floating crystalline triangle elements (translucent) in corners

**AI Search Component**:
- Generous height (h-14 to h-16), rounded-2xl
- Large placeholder text: "Describe what you're looking for..."
- Magic wand or sparkle icon indicating AI
- Instant results dropdown with categorized suggestions
- Search cards show: service name, type badge, distance, availability status

**Resource Cards** (3-column grid on desktop, 1-col mobile):
- Soft rounded-xl borders
- Top accent stripe using mauve variations
- Service icon + category badge
- Title (H4), brief description (2 lines)
- Key details: Location, Hours, Contact method
- Subtle crystalline triangle watermark in corner
- Hover: gentle lift (translate-y-1) and shadow increase

**Category Navigation**:
- Horizontal pill-style filters (sticky below header)
- Icons + labels: Counseling, Crisis Support, Peer Groups, Wellness, Academic Support
- Active state: filled mauve background

**Trust & Support Section**:
- 2-column layout: Left = supportive image (counselor with student, warm lighting), Right = reassuring text
- Stats row: "500+ students helped", "24/7 crisis support", "Confidential services"
- Crystalline triangle pattern divider

**Footer**:
- 4-column grid: Quick Links, Resources, Crisis Contacts (prominent), Newsletter
- Crisis hotline emphasized (larger text, mauve background card)
- Triangle pattern texture as footer background element

## Geometric Elements - Crystalline Triangles

**Integration Strategy**:
- Hero: Large semi-transparent triangles (20-30% opacity) floating at edges
- Section dividers: Small triangle clusters creating subtle patterns
- Card corners: Tiny triangle watermarks
- Loading states: Animated triangular spinner
- Never overwhelming - always subtle, supportive accent

**Technical Specs**: 
- Use CSS clip-path or SVG for crisp triangles
- Varying sizes: 80px, 120px, 200px clusters
- Rotation variations: 0°, 45°, 90° for organic feel

## Images Required

1. **Hero Background**: Wide landscape shot of diverse students in campus outdoor space, natural lighting, laughing/talking supportively (conveys hope and community)
2. **Support Section**: Counselor and student in warm, private office setting, natural poses (builds trust)
3. **Category Icons**: Use Heroicons library for all service categories

**Button Treatment on Images**: Apply backdrop-blur-lg with bg-white/20 dark:bg-black/30 to all CTAs placed over hero or section images

## Dark Mode Considerations

- Mauve purple remains consistent (adjust lightness +5% for dark)
- Crystalline triangles: Lower opacity in dark mode (10-15%)
- Cards: bg-slate-800/50 with subtle borders
- Search bar: bg-slate-800 instead of white
- Maintain high contrast for accessibility