import { motion } from "framer-motion";
import { ArrowRight, MapPin, Clock } from "lucide-react";
import { type ServiceSummary } from "@shared/routes";
import { Badge } from "@/components/ui/badge";

interface ServiceCardProps {
  service: ServiceSummary;
  onClick: () => void;
  index: number;
}

export function ServiceCard({ service, onClick, index }: ServiceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="group cursor-pointer h-full"
      role="button"
      tabIndex={0}
      aria-label={`View details for ${service.name} - ${service.category}`}
      data-testid={`card-service-${service.id}`}
    >
      <div className="glass-card h-full p-6 flex flex-col relative overflow-hidden group-hover:-translate-y-1 transition-transform duration-300">
        {/* Geometric triangle accent - inspired by ROC logo */}
        <svg className="absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 text-primary/10 group-hover:text-primary/20 transition-colors" viewBox="0 0 100 100" fill="none">
          <polygon points="50,10 10,90 90,90" stroke="currentColor" strokeWidth="1" fill="none" />
          <polygon points="50,25 25,75 75,75" stroke="currentColor" strokeWidth="0.5" fill="none" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="0.3" />
        </svg>

        <div className="flex justify-between items-start mb-4 min-w-0">
          <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors px-3 py-1 text-xs font-semibold uppercase tracking-wider whitespace-normal text-left max-w-full">
            {service.category}
          </Badge>
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors min-w-0 break-words hyphens-auto line-clamp-2">
          {service.name}
        </h3>
        
        <p className="text-muted-foreground mb-6 flex-grow min-w-0 break-words whitespace-normal overflow-wrap-anywhere">
          {service.description}
        </p>

        <div className="space-y-3 mt-auto">
          <div className="flex items-start text-sm text-slate-600">
            <MapPin className="w-4 h-4 mr-2 mt-0.5 text-primary/60 flex-shrink-0" aria-hidden="true" />
            <span className="break-words"><span className="sr-only">Location: </span>{service.location}</span>
          </div>
          <div className="flex items-start text-sm text-slate-600">
            <Clock className="w-4 h-4 mr-2 mt-0.5 text-primary/60 flex-shrink-0" aria-hidden="true" />
            <span className="break-words"><span className="sr-only">Wait time: </span>{service.waitTimes}</span>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-primary font-medium text-sm">
          <span>View Details</span>
          <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
}
