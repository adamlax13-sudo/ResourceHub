import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites, useUpdateFavorite, useDeleteFavorite } from "@/hooks/use-favorites";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Trash2, PlayCircle, CheckCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import rocLogo from "@assets/About_Recovery_on_Campus_Alberta_1768060674341.png";
import type { Favorite } from "@shared/routes";

export default function MyResources() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: favorites, isLoading } = useFavorites();
  const updateFavorite = useUpdateFavorite();
  const deleteFavorite = useDeleteFavorite();
  const [filter, setFilter] = useState<string>("all");
  const { t } = useTranslation();

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = "/api/login";
    }
  }, [user, authLoading]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const categories = Array.from(new Set(favorites?.map(f => f.category) || []));
  const filteredFavorites = filter === "all" 
    ? favorites 
    : favorites?.filter(f => f.category === filter);

  const handleStatusToggle = (fav: Favorite) => {
    const newStatus = fav.status === "in_progress" ? "saved" : "in_progress";
    updateFavorite.mutate({ id: fav.id, status: newStatus, completedSteps: newStatus === "saved" ? [] : fav.completedSteps });
  };

  const handleStepToggle = (fav: Favorite, stepIndex: number) => {
    const currentSteps = Array.isArray(fav.completedSteps) ? fav.completedSteps : [];
    const newSteps = currentSteps.includes(stepIndex)
      ? currentSteps.filter(s => s !== stepIndex)
      : [...currentSteps, stepIndex];
    updateFavorite.mutate({ id: fav.id, completedSteps: newSteps });
  };

  const steps = [
    t('steps.step1'),
    t('steps.step2'),
    t('steps.step3'),
    t('steps.step4')
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <img src={rocLogo} alt="ROC Logo" className="h-8 w-auto" />
                <h1 className="text-2xl font-display font-bold">{t('myResources.title')}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher variant="ghost" className="text-white hover:bg-white/20" />
              <a href="/api/logout">
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/20" data-testid="button-logout">
                  {t('nav.logout')}
                </Button>
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Category Filter */}
        {categories.length > 0 && (
          <div className="mb-8">
            <Tabs defaultValue="all" onValueChange={setFilter}>
              <TabsList className="bg-muted">
                <TabsTrigger value="all" data-testid="tab-all">{t('myResources.all')}</TabsTrigger>
                {categories.map(cat => (
                  <TabsTrigger key={cat} value={cat} data-testid={`tab-${cat}`}>
                    {cat}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Favorites List */}
        <AnimatePresence mode="popLayout">
          {filteredFavorites && filteredFavorites.length > 0 ? (
            <div className="grid gap-6">
              {filteredFavorites.map((fav, index) => (
                <motion.div
                  key={fav.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="overflow-hidden">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              {fav.category}
                            </Badge>
                            {fav.status === "in_progress" && (
                              <Badge className="bg-orange-100 text-orange-700">
                                <PlayCircle className="w-3 h-3 mr-1" />
                                {t('myResources.inProgress')}
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-xl">{fav.serviceName}</CardTitle>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusToggle(fav)}
                            disabled={updateFavorite.isPending}
                            data-testid={`button-toggle-status-${fav.id}`}
                          >
                            {fav.status === "in_progress" ? (
                              <>
                                <CheckCircle className="w-4 h-4 mr-1" />
                                {t('myResources.markSaved')}
                              </>
                            ) : (
                              <>
                                <PlayCircle className="w-4 h-4 mr-1" />
                                {t('myResources.startProcess')}
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteFavorite.mutate(fav.id)}
                            disabled={deleteFavorite.isPending}
                            className="text-destructive hover:bg-destructive/10"
                            data-testid={`button-delete-${fav.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {/* Process Steps (only when in_progress) */}
                    {fav.status === "in_progress" && (
                      <CardContent className="pt-0">
                        <div className="bg-muted rounded-xl p-4">
                          <h4 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wider">
                            {t('myResources.trackProgress')}
                          </h4>
                          <div className="space-y-3">
                            {steps.map((step, idx) => {
                              const isCompleted = Array.isArray(fav.completedSteps) && fav.completedSteps.includes(idx);
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border"
                                >
                                  <Checkbox
                                    checked={isCompleted}
                                    onCheckedChange={() => handleStepToggle(fav, idx)}
                                    data-testid={`checkbox-step-${fav.id}-${idx}`}
                                  />
                                  <span className={`text-sm ${isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                    {step}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <img src={rocLogo} alt="ROC Logo" className="w-24 h-auto mx-auto mb-4 opacity-30" />
              <h2 className="text-xl font-semibold text-foreground mb-2">{t('myResources.empty')}</h2>
              <p className="text-muted-foreground mb-6">
                {t('myResources.emptyDesc')}
              </p>
              <Link href="/">
                <Button data-testid="button-find-resources">{t('myResources.findResources')}</Button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
