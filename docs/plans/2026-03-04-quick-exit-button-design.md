# Quick Exit Button — Design

## Purpose

A safety feature for users who need to quickly navigate away from ResourceHub without leaving a trace. Common on domestic violence and social services sites. Clicking it instantly replaces the page with Google's homepage and removes ResourceHub from the browser's back-button history.

## Component: `QuickExitButton`

- **Location:** `client/src/components/QuickExitButton.tsx`
- **UI:** Shadcn `Button`, `variant="ghost"`, `size="sm"`
- **Icon:** Lucide `X` (or `DoorOpen`) + "Quick Exit" label
- **Label:** Hidden on mobile (icon only), visible at `sm:` breakpoint — mirrors the LanguageSwitcher pattern
- **i18n:** Label uses `t('quickExit')` via `react-i18next`

## Placement

Inside the Hero header bar (`Hero.tsx`), to the left of the `LanguageSwitcher`:

```
[ UCalgary Logo  |  ...spacer...  |  Quick Exit  |  Globe English ]
```

Styled identically to the language selector: `text-white hover:bg-white/20 border border-white/20`.

## Behavior

- On click: `window.location.replace("https://www.google.com")`
- `replace()` removes ResourceHub from the browser history — the back button skips past it
- No confirmation dialog — immediate navigation

## i18n

Add `quickExit` key to all 10 translation files.

## Files Changed

1. `client/src/components/QuickExitButton.tsx` — new component
2. `client/src/components/Hero.tsx` — import and render next to LanguageSwitcher
3. `public/locales/*/translation.json` (10 files) — add `quickExit` translation key
