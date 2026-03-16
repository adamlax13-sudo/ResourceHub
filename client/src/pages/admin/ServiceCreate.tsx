import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ServiceForm, type ServiceFormData } from "@/components/admin/ServiceForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ServiceCreate() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const res = await apiRequest("POST", "/api/admin/services", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Service created", description: `ID: ${data.service?.id}` });
      navigate("/admin/services");
    },
    onError: (err) => {
      toast({ title: "Creation failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-xl font-semibold text-white mb-4">Create New Service</h2>
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base">Service Details</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ServiceForm
            onSubmit={(data) => createMutation.mutate(data)}
            isPending={createMutation.isPending}
            submitLabel="Create Service"
          />
        </CardContent>
      </Card>
    </div>
  );
}
