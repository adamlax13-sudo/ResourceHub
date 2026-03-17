import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

export function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 inline-block ml-1 cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[250px] text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
