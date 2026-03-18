import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

export function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground inline-block ml-1 cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[250px] text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
    </TooltipProvider>
  );
}
