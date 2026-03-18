import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

type ThemeOption = "light" | "dark" | "system";

const OPTIONS: { value: ThemeOption; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "Auto" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="px-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
        Theme
      </p>
      <div className="flex bg-muted rounded-md p-0.5">
        {OPTIONS.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1 rounded text-xs transition-colors",
              theme === value
                ? "bg-background text-foreground shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={label}
          >
            <Icon className="h-3 w-3" />
          </button>
        ))}
      </div>
    </div>
  );
}
