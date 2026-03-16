import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Eye, CheckCircle, AlertTriangle } from "lucide-react";

interface PreviewItem {
  name: string;
  category: string;
}

interface ImportResult {
  success: boolean;
  dryRun?: boolean;
  preview?: PreviewItem[];
  count?: number;
  created?: { id: number; name: string }[];
  errors?: { name: string; error: string }[];
  totalCreated?: number;
  totalErrors?: number;
}

export default function ServiceImport() {
  const { toast } = useToast();
  const [jsonText, setJsonText] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const services = JSON.parse(jsonText);
      const payload = Array.isArray(services) ? { services, dryRun: true } : { services: [services], dryRun: true };
      const res = await apiRequest("POST", "/api/admin/services/import", payload);
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      setPreview(data);
      setImportResult(null);
    },
    onError: (err) => {
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const services = JSON.parse(jsonText);
      const payload = Array.isArray(services) ? { services, dryRun: false } : { services: [services], dryRun: false };
      const res = await apiRequest("POST", "/api/admin/services/import", payload);
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      setImportResult(data);
      setPreview(null);
      toast({ title: "Import complete", description: `Created: ${data.totalCreated}, Errors: ${data.totalErrors}` });
    },
    onError: (err) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setJsonText(ev.target?.result as string);
      setPreview(null);
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  let isValidJson = false;
  try {
    if (jsonText.trim()) {
      JSON.parse(jsonText);
      isValidJson = true;
    }
  } catch {
    // not valid
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Import Services</h2>

      {/* Input */}
      <Card className="bg-white border-gray-200 shadow-sm rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-gray-900 text-base">Service Data (JSON)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer hover:text-gray-700">
              <Upload className="h-4 w-4" />
              Upload JSON file
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
          <Textarea
            value={jsonText}
            onChange={(e) => { setJsonText(e.target.value); setPreview(null); setImportResult(null); }}
            placeholder={'[\n  {\n    "name": "Service Name",\n    "category": "Mental Health",\n    "description": "...",\n    "phone": "403-555-1234"\n  }\n]'}
            className="bg-gray-50 border-gray-300 text-gray-900 font-mono text-sm min-h-[200px]"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => previewMutation.mutate()}
              disabled={!isValidJson || previewMutation.isPending}
              variant="outline"
              className="border-gray-300"
            >
              {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              Preview
            </Button>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={!isValidJson || !preview || importMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Import
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview?.preview && (
        <Card className="bg-white border-gray-200 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-gray-900 text-base">
              Preview ({preview.count} service{preview.count === 1 ? "" : "s"})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">#</th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Name</th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((item, i) => (
                    <tr key={i} className="border-t border-gray-200">
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2 text-gray-900">{item.name}</td>
                      <td className="px-3 py-2">
                        <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-xs">
                          {item.category}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Result */}
      {importResult && (
        <Card className="bg-white border-gray-200 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-gray-900 text-base">Import Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">{importResult.totalCreated} created</span>
              </div>
              {(importResult.totalErrors ?? 0) > 0 && (
                <div className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">{importResult.totalErrors} errors</span>
                </div>
              )}
            </div>
            {importResult.errors && importResult.errors.length > 0 && (
              <div className="space-y-1">
                {importResult.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-500">
                    {err.name}: {err.error}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
