# Quick Exit Button Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an emergency escape button to the header bar that instantly navigates to Google and replaces browser history.

**Architecture:** A standalone `QuickExitButton` component placed next to the `LanguageSwitcher` in the Hero header bar. Uses `window.location.replace()` for history-safe navigation. Translatable via react-i18next.

**Tech Stack:** React, Tailwind CSS, Shadcn/ui Button, Lucide icons, react-i18next

---

### Task 1: Create the QuickExitButton component

**Files:**
- Create: `client/src/components/QuickExitButton.tsx`

**Step 1: Create the component file**

```tsx
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickExitButtonProps {
  className?: string;
}

export function QuickExitButton({ className = '' }: QuickExitButtonProps) {
  const { t } = useTranslation();

  const handleExit = () => {
    window.location.replace('https://www.google.com');
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`gap-2 h-9 px-3 ${className}`}
      onClick={handleExit}
      data-testid="button-quick-exit"
    >
      <X className="w-4 h-4 flex-shrink-0" />
      <span className="hidden sm:inline text-sm font-medium">
        {t('quickExit')}
      </span>
    </Button>
  );
}
```

**Step 2: Commit**

```bash
git add client/src/components/QuickExitButton.tsx
git commit -m "feat: add QuickExitButton component"
```

---

### Task 2: Add QuickExitButton to the Hero header bar

**Files:**
- Modify: `client/src/components/Hero.tsx:392-395`

**Step 1: Add import at the top of Hero.tsx**

Add alongside the existing LanguageSwitcher import:

```tsx
import { QuickExitButton } from './QuickExitButton';
```

**Step 2: Add QuickExitButton next to LanguageSwitcher**

Replace the standalone `<LanguageSwitcher ... />` block (lines 392-395) with a flex container holding both buttons:

```tsx
          <div className="flex items-center gap-2">
            <QuickExitButton
              className="text-white hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all"
            />
            <LanguageSwitcher
              variant="ghost"
              className="text-white hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all"
            />
          </div>
```

**Step 3: Verify visually**

Run: `npm run dev`

Check that:
- Both buttons appear side-by-side in the top-right
- On mobile (<640px), only icons show (no labels)
- On desktop, both labels are visible
- Clicking "Quick Exit" navigates to google.com

**Step 4: Commit**

```bash
git add client/src/components/Hero.tsx
git commit -m "feat: add quick exit button to Hero header bar"
```

---

### Task 3: Add i18n translations for all 10 languages

**Files:**
- Modify: `client/src/locales/en.json`
- Modify: `client/src/locales/es.json`
- Modify: `client/src/locales/fr.json`
- Modify: `client/src/locales/zh.json`
- Modify: `client/src/locales/ar.json`
- Modify: `client/src/locales/hi.json`
- Modify: `client/src/locales/pt.json`
- Modify: `client/src/locales/de.json`
- Modify: `client/src/locales/ja.json`
- Modify: `client/src/locales/ko.json`

**Step 1: Add `quickExit` key to each locale file**

Add as a top-level key in each JSON file:

| File | Key | Value |
|------|-----|-------|
| `en.json` | `quickExit` | `"Quick Exit"` |
| `es.json` | `quickExit` | `"Salida rápida"` |
| `fr.json` | `quickExit` | `"Sortie rapide"` |
| `zh.json` | `quickExit` | `"快速退出"` |
| `ar.json` | `quickExit` | `"خروج سريع"` |
| `hi.json` | `quickExit` | `"त्वरित निकास"` |
| `pt.json` | `quickExit` | `"Saída rápida"` |
| `de.json` | `quickExit` | `"Schnell verlassen"` |
| `ja.json` | `quickExit` | `"緊急退出"` |
| `ko.json` | `quickExit` | `"빠른 나가기"` |

**Step 2: Verify translations load**

Run: `npm run dev`

Switch languages via the language selector and confirm the Quick Exit button label changes.

**Step 3: Commit**

```bash
git add client/src/locales/*.json
git commit -m "feat: add quick exit button translations for all 10 languages"
```

---

### Task 4: Type check and final verification

**Step 1: Run type checker**

Run: `npm run check`
Expected: No errors

**Step 2: Visual check on all breakpoints**

Run: `npm run dev`

Verify:
- Mobile: Two icon-only buttons side-by-side, no overflow
- Desktop: "Quick Exit" and language name both visible
- Quick Exit click → google.com, back button does NOT return to ResourceHub

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address quick exit button issues"
```
