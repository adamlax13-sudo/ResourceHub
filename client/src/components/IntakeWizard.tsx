import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CATEGORIES } from "@/components/CategoryTiles";
import type { SearchFilters } from "@shared/routes";

interface IntakeWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (query: string, filters: SearchFilters) => void;
}

const WHO_OPTIONS = [
  { id: 'self', icon: '🙋', label: 'Me' },
  { id: 'family', icon: '👪', label: 'Someone I care for' },
  { id: 'client', icon: '🤝', label: "A client I'm helping" },
] as const;

const REQUIREMENTS = [
  { id: 'women_only', label: 'Women-only', filterKey: 'genderRestriction', filterValue: 'women_only' },
  { id: 'french', label: 'French language', filterKey: 'languagesSupported', filterValue: ['French'] },
  { id: 'walk_in', label: 'Walk-in', queryAppend: ' walk-in' },
  { id: '24_7', label: '24/7', filterKey: 'is24_7', filterValue: true },
  { id: 'faith', label: 'Faith-based', filterKey: 'isFaithBased', filterValue: true },
  { id: 'no_referral', label: 'No referral needed', queryAppend: ' no referral' },
] as const;

function assembleSearch(
  who: string,
  categoryQuery: string,
  requirements: Set<string>
): { query: string; filters: SearchFilters } {
  let query = categoryQuery;
  const filters: SearchFilters = {};

  if (who === 'family') query = 'for family member ' + query;
  if (who === 'client') query = 'for client ' + query;

  for (const reqId of Array.from(requirements)) {
    const req = REQUIREMENTS.find(r => r.id === reqId);
    if (!req) continue;
    if ('queryAppend' in req) query += req.queryAppend;
    if ('filterKey' in req) (filters as any)[req.filterKey] = req.filterValue;
  }

  return { query, filters };
}

const TOTAL_STEPS = 3;

export function IntakeWizard({ isOpen, onClose, onComplete }: IntakeWizardProps) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [who, setWho] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [requirements, setRequirements] = useState<Set<string>>(new Set());

  // Reset state whenever the wizard opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setStep(1);
      setDirection(1);
      setWho('');
      setSelectedCategory('');
      setRequirements(new Set());
    } else {
      onClose();
    }
  };

  const goNext = () => {
    setDirection(1);
    setStep(s => s + 1);
  };

  const goBack = () => {
    setDirection(-1);
    setStep(s => s - 1);
  };

  const handleComplete = () => {
    const { query, filters } = assembleSearch(who, selectedCategory, requirements);
    onComplete(query, filters);
  };

  const toggleRequirement = (id: string) => {
    setRequirements(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 50 : -50, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -50 : 50, opacity: 0 }),
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg w-full overflow-hidden">
        <DialogHeader>
          <DialogTitle className="sr-only">Guided Resource Finder</DialogTitle>
        </DialogHeader>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6 mt-1">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i + 1 <= step
                  ? 'w-6 bg-primary'
                  : 'w-2 bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="relative min-h-[280px]">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                <h2 className="text-xl font-semibold text-foreground text-center mb-6">
                  Who needs help?
                </h2>
                <div className="flex flex-col gap-3">
                  {WHO_OPTIONS.map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setWho(option.id)}
                      className={`flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-left transition-all duration-150 ${
                        who === option.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50'
                      }`}
                    >
                      <span className="text-2xl" aria-hidden="true">{option.icon}</span>
                      <span className="font-medium text-base">{option.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                <h2 className="text-xl font-semibold text-foreground text-center mb-6">
                  What's most urgent right now?
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => setSelectedCategory(cat.query)}
                      className={`
                        flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-150 text-center
                        bg-gradient-to-br ${cat.gradient}
                        ${selectedCategory === cat.query
                          ? 'border-primary ring-2 ring-primary/30 scale-105'
                          : 'border-border/50 hover:border-primary/40 hover:scale-102'
                        }
                      `}
                    >
                      <span className="text-2xl" aria-hidden="true">{cat.icon}</span>
                      <span className="text-xs font-semibold text-foreground leading-tight">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                <h2 className="text-xl font-semibold text-foreground text-center mb-6">
                  Any specific requirements?
                </h2>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Optional — select all that apply
                </p>
                <div className="flex flex-col gap-2">
                  {REQUIREMENTS.map(req => (
                    <label
                      key={req.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                        requirements.has(req.id)
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={requirements.has(req.id)}
                        onChange={() => toggleRequirement(req.id)}
                        className="w-4 h-4 accent-primary rounded"
                      />
                      <span className={`font-medium text-sm ${requirements.has(req.id) ? 'text-primary' : 'text-foreground'}`}>
                        {req.label}
                      </span>
                    </label>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={goNext}
              disabled={step === 1 ? !who : step === 2 ? !selectedCategory : false}
              className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all"
            >
              Find Resources
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
