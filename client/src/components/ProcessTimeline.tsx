import { motion } from "framer-motion";

interface ProcessTimelineProps {
  steps: string[];
}

function linkifyText(text: string): React.ReactNode {
  if (!text) return text;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  
  // Match: full URLs, emails, phone numbers, and domain names (like recoverycollegecalgary.ca)
  const combinedRegex = /(https?:\/\/[^\s,]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})|([a-zA-Z0-9][-a-zA-Z0-9]*\.(?:ca|com|org|net|edu|gov)(?:\/[^\s,]*)?)/gi;
  
  let match;
  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    const matched = match[0];
    if (match[1]) {
      parts.push(
        <a key={key++} href={matched} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
          {matched}
        </a>
      );
    } else if (match[2]) {
      parts.push(
        <a key={key++} href={`mailto:${matched}`} className="text-primary hover:underline">
          {matched}
        </a>
      );
    } else if (match[3]) {
      const cleanPhone = matched.replace(/[^\d+]/g, '');
      parts.push(
        <a key={key++} href={`tel:${cleanPhone}`} className="text-primary hover:underline">
          {matched}
        </a>
      );
    } else if (match[4]) {
      const url = matched.startsWith('http') ? matched : `https://${matched}`;
      parts.push(
        <a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
          {matched}
        </a>
      );
    }
    
    lastIndex = match.index + matched.length;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
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
            transition={{ delay: Math.min(index * 0.15, 0.6) }}
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
