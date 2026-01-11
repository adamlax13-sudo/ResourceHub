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
import { Trash2, PlayCircle, CheckCircle, Loader2, LogOut, MapPin, Phone, Mail, FileText, Clock, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import rocLogo from "@assets/About_Recovery_on_Campus_Alberta_1768060674341.png";
import type { Favorite, ServiceDetail } from "@shared/routes";

export default function MyResources() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: favorites, isLoading } = useFavorites();
  const updateFavorite = useUpdateFavorite();
  const deleteFavorite = useDeleteFavorite();
  const [filter, setFilter] = useState<string>("all");
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const { t } = useTranslation();

  const toggleCardExpanded = (id: number) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

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
    
    // Auto-expand when starting process, collapse when marking as saved
    if (newStatus === "in_progress") {
      setExpandedCards(prev => new Set(prev).add(fav.id));
    } else {
      setExpandedCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(fav.id);
        return newSet;
      });
    }
  };

  const handleStepToggle = (fav: Favorite, stepIndex: number) => {
    const currentSteps = Array.isArray(fav.completedSteps) ? fav.completedSteps : [];
    const newSteps = currentSteps.includes(stepIndex)
      ? currentSteps.filter(s => s !== stepIndex)
      : [...currentSteps, stepIndex];
    updateFavorite.mutate({ id: fav.id, completedSteps: newSteps });
  };

  const getServiceSteps = (fav: Favorite): string[] => {
    const details = fav.serviceDetails as ServiceDetail | null;
    if (details?.process && details.process.length > 0) {
      return details.process;
    }
    return [
      t('steps.step1'),
      t('steps.step2'),
      t('steps.step3'),
      t('steps.step4')
    ];
  };

  const extractContactInfo = (text: string) => {
    const phoneMatch = text.match(/(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
    return { phone: phoneMatch?.[1], email: emailMatch?.[1], url: urlMatch?.[1] };
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <img src={rocLogo} alt="ROC Logo" className="h-8 sm:h-10 w-auto" />
              <Link href="/">
                <Button variant="ghost" className="text-white hover:bg-white/20" data-testid="button-home">
                  {t('nav.home')}
                </Button>
              </Link>
            </div>
            <h1 className="text-xl sm:text-3xl font-display font-bold">{t('myResources.title')}</h1>
            <div className="flex items-center gap-1 sm:gap-3">
              <LanguageSwitcher variant="ghost" className="text-white hover:bg-white/20" />
              <a href="/api/logout">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 sm:hidden" data-testid="button-logout-mobile">
                  <LogOut className="w-4 h-4" />
                </Button>
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/20 hidden sm:flex" data-testid="button-logout">
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
              <TabsList className="bg-muted flex-wrap h-auto gap-1 p-1">
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
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge variant="secondary" className="bg-primary/10 text-primary shrink-0">
                              {fav.category}
                            </Badge>
                            {fav.status === "in_progress" && (
                              <Badge className="bg-orange-100 text-orange-700 shrink-0">
                                <PlayCircle className="w-3 h-3 mr-1" />
                                {t('myResources.inProgress')}
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-lg sm:text-xl break-words line-clamp-2">{fav.serviceName}</CardTitle>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusToggle(fav)}
                            disabled={updateFavorite.isPending}
                            className="text-xs sm:text-sm"
                            data-testid={`button-toggle-status-${fav.id}`}
                          >
                            {fav.status === "in_progress" ? (
                              <>
                                <CheckCircle className="w-4 h-4 mr-1" />
                                <span className="hidden sm:inline">{t('myResources.markSaved')}</span>
                                <span className="sm:hidden">Done</span>
                              </>
                            ) : (
                              <>
                                <PlayCircle className="w-4 h-4 mr-1" />
                                <span className="hidden sm:inline">{t('myResources.startProcess')}</span>
                                <span className="sm:hidden">Start</span>
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
                          <button
                            onClick={() => toggleCardExpanded(fav.id)}
                            className="w-full flex items-center justify-between text-left"
                            data-testid={`button-toggle-expand-${fav.id}`}
                          >
                            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                              {t('myResources.trackProgress')}
                            </h4>
                            {expandedCards.has(fav.id) ? (
                              <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </button>
                          
                          <AnimatePresence initial={false}>
                            {expandedCards.has(fav.id) && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="space-y-3 mt-3">
                                  {getServiceSteps(fav).map((step, idx) => {
                                    const isCompleted = Array.isArray(fav.completedSteps) && fav.completedSteps.includes(idx);
                                    const contactInfo = extractContactInfo(step);
                                    return (
                                      <div
                                        key={idx}
                                        className={`p-3 bg-card rounded-lg border border-border transition-colors ${isCompleted ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : ''}`}
                                      >
                                        <div className="flex items-start gap-3">
                                          <Checkbox
                                            checked={isCompleted}
                                            onCheckedChange={() => handleStepToggle(fav, idx)}
                                            className="mt-0.5"
                                            data-testid={`checkbox-step-${fav.id}-${idx}`}
                                          />
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              <Badge variant="outline" className="text-xs shrink-0">
                                                {t('myResources.stepLabel', { num: idx + 1 })}
                                              </Badge>
                                            </div>
                                            <p className={`text-sm ${isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                              {step}
                                            </p>
                                            {(contactInfo.phone || contactInfo.email || contactInfo.url) && (
                                              <div className="flex flex-wrap gap-2 mt-2">
                                                {contactInfo.phone && (
                                                  <a 
                                                    href={`tel:${contactInfo.phone}`} 
                                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    <Phone className="w-3 h-3" />
                                                    {contactInfo.phone}
                                                  </a>
                                                )}
                                                {contactInfo.email && (
                                                  <a 
                                                    href={`mailto:${contactInfo.email}`} 
                                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    <Mail className="w-3 h-3" />
                                                    {contactInfo.email}
                                                  </a>
                                                )}
                                                {contactInfo.url && (
                                                  <a 
                                                    href={contactInfo.url} 
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    <ExternalLink className="w-3 h-3" />
                                                    {t('myResources.visitLink')}
                                                  </a>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                
                                {/* Service Contact Info Section */}
                                {fav.serviceDetails && (
                                  <div className="mt-4 pt-4 border-t border-border">
                                    <h5 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wider">
                                      {t('myResources.serviceInfo')}
                                    </h5>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {(fav.serviceDetails as ServiceDetail).location && (
                                        <div className="flex items-start gap-2 text-sm">
                                          <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                          <span className="text-muted-foreground">{(fav.serviceDetails as ServiceDetail).location}</span>
                                        </div>
                                      )}
                                      {(fav.serviceDetails as ServiceDetail).contact && (
                                        <div className="flex items-start gap-2 text-sm">
                                          <Phone className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                          <span className="text-muted-foreground">{(fav.serviceDetails as ServiceDetail).contact}</span>
                                        </div>
                                      )}
                                      {(fav.serviceDetails as ServiceDetail).waitTimes && (
                                        <div className="flex items-start gap-2 text-sm">
                                          <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                          <span className="text-muted-foreground">{(fav.serviceDetails as ServiceDetail).waitTimes}</span>
                                        </div>
                                      )}
                                      {(fav.serviceDetails as ServiceDetail).eligibility && (
                                        <div className="flex items-start gap-2 text-sm">
                                          <CheckCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                          <span className="text-muted-foreground">{(fav.serviceDetails as ServiceDetail).eligibility}</span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Required Documents */}
                                    {(fav.serviceDetails as ServiceDetail).requiredDocs && (fav.serviceDetails as ServiceDetail).requiredDocs.length > 0 && (
                                      <div className="mt-3 pt-3 border-t border-border">
                                        <h6 className="font-semibold text-xs mb-2 text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                          <FileText className="w-3 h-3" />
                                          {t('myResources.requiredDocs')}
                                        </h6>
                                        <ul className="space-y-1">
                                          {(fav.serviceDetails as ServiceDetail).requiredDocs.map((doc, idx) => (
                                            <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                              <span className="text-primary">•</span>
                                              {doc}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
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
              <img src={rocLogo} alt="ROC Logo" className="w-24 h-auto mx-auto mb-4 opacity-30" loading="lazy" />
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
