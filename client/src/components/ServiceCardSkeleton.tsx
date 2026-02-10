import { motion } from "framer-motion";

interface ServiceCardSkeletonProps {
  index: number;
}

export function ServiceCardSkeleton({ index }: ServiceCardSkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="h-full"
    >
      <div className="glass-card h-full p-6 flex flex-col relative overflow-hidden animate-pulse" style={{ animationDuration: '3s' }}>
        <div className="flex justify-between items-start mb-4">
          <div className="h-6 w-24 bg-muted rounded-full" />
        </div>

        <div className="h-6 w-3/4 bg-muted rounded mb-2" />
        <div className="h-5 w-1/2 bg-muted rounded mb-4" />
        
        <div className="space-y-2 mb-6 flex-grow">
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-2/3 bg-muted rounded" />
        </div>

        <div className="space-y-3 mt-auto">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-muted rounded mr-2" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-muted rounded mr-2" />
            <div className="h-4 w-24 bg-muted rounded" />
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="w-4 h-4 bg-muted rounded" />
        </div>
      </div>
    </motion.div>
  );
}
