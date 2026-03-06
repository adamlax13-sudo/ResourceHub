import { motion } from "framer-motion";
import { linkifyText } from "@/lib/linkify";

interface ProcessTimelineProps {
  steps: string[];
}

export function ProcessTimeline({ steps }: ProcessTimelineProps) {
  return (
    <div className="relative py-4">
      {/* Vertical Line */}
      <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200" />

      <div className="space-y-8">
        {steps.map((step, index) => (
          <motion.div 
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.15 }}
            className="relative pl-12"
          >
            {/* Dot Indicator */}
            <div className="absolute left-0 top-1 w-8 h-8 rounded-full bg-white border-2 border-primary flex items-center justify-center z-10 shadow-sm">
              <span className="text-xs font-bold text-primary">{index + 1}</span>
            </div>

            <div className="glass-card p-4 md:p-5 hover:shadow-md transition-shadow overflow-hidden">
              <h4 className="font-semibold text-foreground mb-1">Step {index + 1}</h4>
              <p className="text-muted-foreground text-sm leading-relaxed break-words overflow-wrap-anywhere">{linkifyText(step)}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
