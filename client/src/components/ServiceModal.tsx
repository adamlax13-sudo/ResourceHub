import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { type ServiceDetail } from "@shared/schema";
import { ProcessTimeline } from "./ProcessTimeline";
import { FileText, Clock, Phone, MapPin, ExternalLink, Mail, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ServiceModalProps {
  service: ServiceDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ServiceModal({ service, isOpen, onClose }: ServiceModalProps) {
  if (!service) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-slate-50 border-0 shadow-2xl rounded-2xl md:rounded-3xl">
        <div className="flex flex-col h-full max-h-[90vh]">
          {/* Header */}
          <div className="bg-white px-6 py-6 md:px-8 md:py-8 border-b border-slate-100 flex-shrink-0">
            <div className="flex flex-col gap-2">
              <Badge className="w-fit bg-primary/10 text-primary hover:bg-primary/20 pointer-events-none mb-2">
                {service.category}
              </Badge>
              <DialogTitle className="text-2xl md:text-3xl font-display font-bold text-foreground">
                {service.name}
              </DialogTitle>
              <DialogDescription className="text-base text-slate-500 mt-1">
                {service.description}
              </DialogDescription>
            </div>
          </div>

          <ScrollArea className="flex-grow">
            <div className="p-6 md:p-8 grid md:grid-cols-12 gap-8">
              
              {/* Left Column: Process & Requirements */}
              <div className="md:col-span-7 space-y-8">
                
                {/* Process Section */}
                <section>
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-foreground">
                    <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">1</span>
                    Access Process
                  </h3>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <ProcessTimeline steps={service.process} />
                  </div>
                </section>

                {/* Required Documents Section */}
                <section>
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-foreground">
                    <span className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary text-sm font-bold">2</span>
                    Required Documents
                  </h3>
                  <div className="grid gap-3">
                    {service.requiredDocs.map((doc, idx) => (
                      <div key={idx} className="flex items-start gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <FileText className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-600 font-medium">{doc}</span>
                      </div>
                    ))}
                    {service.requiredDocs.length === 0 && (
                      <div className="text-sm text-slate-500 italic p-4 bg-white rounded-xl border border-slate-100">
                        No specific documents listed. Please contact the provider to confirm.
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Right Column: Key Info Card */}
              <div className="md:col-span-5">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 sticky top-0 space-y-6">
                  <h3 className="font-bold text-lg border-b border-slate-100 pb-4">Key Information</h3>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Estimated Wait Time</div>
                        <div className="font-medium text-slate-700 mt-0.5">{service.waitTimes}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Eligibility</div>
                        <div className="font-medium text-slate-700 mt-0.5">{service.eligibility}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-orange-600" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Location</div>
                        <div className="font-medium text-slate-700 mt-0.5">{service.location}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                        <Phone className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Contact</div>
                        <div className="font-medium text-slate-700 mt-0.5 break-words">{service.contact}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <Button className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-12 rounded-xl shadow-lg shadow-primary/20">
                      Contact Service Provider
                      <ExternalLink className="ml-2 w-4 h-4" />
                    </Button>
                    <p className="text-center text-xs text-slate-400 mt-3">
                      External link opens in a new tab
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
