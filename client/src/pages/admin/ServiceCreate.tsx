import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ServiceForm, type ServiceFormData } from "@/components/admin/ServiceForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { Link } from "wouter";

export default function ServiceCreate() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [debouncedName, setDebouncedName] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNameChange = useCallback((name: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Only search if name has at least 3 characters
      const trimmed = name.trim();
      setDebouncedName(trimmed.length >= 3 ? trimmed : "");
    }, 500);
  }, []);

  // Debounced duplicate search by name
  const { data: similarData } = useQuery<{
    success: boolean;
    services: Array<{ id: number; name: string; category: string; isActive: boolean }>;
    total: number;
  }>({
    queryKey: ["/api/admin/services", "dup-check", debouncedName],
    queryFn: async () => {
      const nameWords = debouncedName.split(/\s*\u2014\s*/)[0].trim().split(' ').slice(0, 3).join(' ');
      const res = await apiRequest("GET", `/api/admin/services?q=${encodeURIComponent(nameWords)}&status=all&limit=5`);
      return res.json();
    },
    enabled: debouncedName.length >= 3,
    staleTime: 30_000,
  });

  const similarServices = similarData?.services || [];

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
      <h2 className="text-xl font-semibold text-foreground mb-4">Create New Service</h2>

      {/* Duplicate warning banner */}
      {similarServices.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-4">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700">
            <p className="font-medium">Similar services already exist:</p>
            <ul className="mt-1 space-y-0.5">
              {similarServices.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/services?selected=${s.id}`} className="underline hover:text-amber-900">
                    {s.name}
                  </Link>
                  <span className="text-amber-500 ml-1">({s.category}{!s.isActive ? ', inactive' : ''})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground text-base">Service Details</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ServiceForm
            onSubmit={(data) => createMutation.mutate(data)}
            isPending={createMutation.isPending}
            submitLabel="Create Service"
            onNameChange={handleNameChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}
