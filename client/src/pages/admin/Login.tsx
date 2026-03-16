import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsPending(true);

    try {
      const res = await apiRequest("POST", "/api/admin/auth/login", { apiKey });
      const data = await res.json();
      if (data.success) {
        navigate("/admin");
      } else {
        setError("Invalid API key");
      }
    } catch (err: any) {
      if (err.message?.includes("401")) {
        setError("Invalid API key");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-white border-gray-200 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 rounded-full bg-teal-50 p-3 w-fit">
            <Shield className="h-6 w-6 text-teal-600" />
          </div>
          <CardTitle className="text-gray-900">Admin Login</CardTitle>
          <CardDescription className="text-gray-500">
            Enter your API key to access the admin panel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="apiKey" className="text-gray-700">
                API Key
              </Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter admin API key"
                className="mt-1 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                required
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white" disabled={isPending || !apiKey}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
