# Search Context Line

Replace the current translucent query understanding bar with a single line of helper text above the results toolbar. Visible on all screen sizes.

## What It Does

Translates the system's `queryUnderstanding` response into a natural language sentence so users know what's influencing their results. Provides transparency and confidence without adding UI clutter.

## Placement

Above the results toolbar (the row with List/Map toggle, Shortlist, Refine buttons). Below the Hero search bar. Visible on desktop and mobile.

## Appearance

- Small search icon (muted color) followed by a text sentence
- Styling: `text-sm text-muted-foreground` — caption-weight, no background, no border, no card
- Animated entry: fade in with slight upward slide (consistent with existing Framer Motion patterns)
- Only renders when `queryUnderstanding` contains at least an intent or location

## Content Patterns

| Data available | Output |
|---|---|
| Intent + demographic + location | "Mental health services for women near Calgary" |
| Intent + location | "Addiction recovery services near Edmonton" |
| Intent only | "Mental health services" |
| Location only | "Services near Calgary" |
| Intent + serviceFormat | "Mental health services · Online" |
| Intent + demographic | "Housing services for youth" |
| Intent + demographic + location + format | "Mental health services for women near Calgary · Online" |

## Data Mapping

### Intent Labels

Transform raw intent strings to human-readable labels:
- Replace underscores with spaces
- Capitalize first word only
- Append "services" to the label

Examples: `addiction_recovery` -> "Addiction recovery services", `mental_health` -> "Mental health services", `housing` -> "Housing services"

### Other Fields

- `location`: pass through as-is (already human-readable, e.g., "Calgary")
- `attributes.demographic`: pass through as-is (e.g., "women", "youth")
- `attributes.serviceFormat`: map `in_person` -> "In-person", `online` -> "Online", `in_person_and_online` -> "In-person & Online"

## What Gets Removed

The current query understanding element in the results toolbar (Home.tsx lines 414-429): the `hidden md:flex` div with `bg-muted/60 border border-border/50` styling that shows raw intent labels and is hidden on mobile.

## Component Structure

No new component file needed. The logic is a small `buildContextLine()` helper function in Home.tsx (or inline) that takes the `queryUnderstanding` object and returns a string. Rendered as a `<p>` tag with a Lucide `Search` icon inside the existing results `<motion.div>`.

## Non-Goals

- No interactivity (no clicks, no dismiss, no filter removal)
- No new API changes — uses existing `queryUnderstanding` response data
- No card, border, or background styling
