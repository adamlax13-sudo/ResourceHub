import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn("bg-white border-gray-100 shadow-sm rounded-xl", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
            {trend && (
              <p className={cn("text-xs font-medium flex items-center gap-1", trend.value >= 0 ? "text-emerald-500" : "text-red-500")}>
                {trend.value >= 0 ? "\u2191" : "\u2193"} {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-teal-50 p-2.5">
            <Icon className="h-5 w-5 text-teal-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
