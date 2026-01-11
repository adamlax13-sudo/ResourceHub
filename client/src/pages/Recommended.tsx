import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useRecommendations } from "@/hooks/use-profile";
import { useAddFavorite, useFavorites } from "@/hooks/use-favorites";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Loader2, Heart, ExternalLink, MapPin, Phone, Clock, User, LogOut, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useToast } from "@/hooks/use-toast";
import { ServiceModal } from "@/components/ServiceModal";
import { type ServiceDetail } from "@shared/schema";
import rocLogo from "@assets/About_Recovery_on_Campus_Alberta_1768060674341.png";

export default function Recommended() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: recommendations, isLoading, error } = useRecommendations();
  const { data: favorites } = useFavorites();
  const addFavorite = useAddFavorite();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedService, setSelectedService] = useState<ServiceDetail | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = "/api/login";
    }
  }, [user, authLoading]);

  const isFavorited = (serviceId: string) => {
    return favorites?.some(f => f.serviceId === serviceId);
  };

  const convertToServiceDetail = (rec: any): ServiceDetail => ({
    id: rec.id,
    name: rec.name,
    category: rec.category,
    description: rec.description,
    location: rec.location || "",
    contact: rec.contact || "",
    eligibility: rec.eligibility || "",
    process: rec.process || [],
    waitTimes: rec.waitTimes || "",
    requiredDocs: rec.requiredDocs || [],
  });

  const handleSave = async (rec: any) => {
    if (isFavorited(rec.id)) return;
    
    try {
      await addFavorite.mutateAsync({
        serviceId: rec.id,
        serviceName: rec.name,
        category: rec.category,
        serviceDetails: convertToServiceDetail(rec),
      });
      toast({
        title: t('toast.saved'),
        description: t('toast.resourceAdded'),
      });
    } catch (error) {
      toast({
        title: t('recommended.saveError'),
        variant: "destructive",
      });
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('recommended.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <img src={rocLogo} alt="ROC Logo" className="h-8 sm:h-10 w-auto" />
              <div className="flex items-center gap-1 sm:gap-2">
                <Sparkles className="w-5 sm:w-6 h-5 sm:h-6" />
                <h1 className="text-xl sm:text-3xl font-display font-bold">{t('recommended.title')}</h1>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-3">
              <LanguageSwitcher variant="ghost" className="text-white hover:bg-white/20" />
              <Link href="/profile">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 sm:hidden" data-testid="button-profile-mobile">
                  <User className="w-4 h-4" />
                </Button>
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/20 hidden sm:flex" data-testid="button-profile">
                  <User className="w-4 h-4 mr-2" />
                  {t('recommended.editProfile')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {error ? (
          <div className="text-center py-20">
            <p className="text-destructive mb-4">{t('recommended.error')}</p>
            <Button onClick={() => window.location.reload()} data-testid="button-retry">
              {t('recommended.retry')}
            </Button>
          </div>
        ) : recommendations?.recommendations && recommendations.recommendations.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {recommendations.summary && (
              <Card className="mb-8 bg-primary/5 border-primary/20">
                <CardContent className="py-6">
                  <div className="flex items-start gap-4">
                    <Sparkles className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                    <p className="text-foreground">{recommendations.summary}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recommendations.recommendations.map((rec: any, index: number) => (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card 
                    className="h-full flex flex-col hover-elevate cursor-pointer group"
                    onClick={() => setSelectedService(convertToServiceDetail(rec))}
                    data-testid={`card-recommendation-${rec.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          {rec.category}
                        </Badge>
                        {isFavorited(rec.id) && (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <Heart className="w-3 h-3 mr-1 fill-current" />
                            {t('service.saved')}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors break-words line-clamp-2">{rec.name}</CardTitle>
                      <CardDescription className="text-sm line-clamp-2">
                        {rec.description}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="flex-1 pb-3 flex flex-col">
                      <div className="bg-muted/50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-muted-foreground italic">
                          <Sparkles className="w-3 h-3 inline mr-1 text-primary" />
                          {rec.reasoning}
                        </p>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        {rec.location && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">{rec.location}</span>
                          </div>
                        )}
                        {rec.contact && (
                          <div className="flex items-start gap-2">
                            <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">{rec.contact}</span>
                          </div>
                        )}
                        {rec.waitTimes && (
                          <div className="flex items-start gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">{rec.waitTimes}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-auto pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          {rec.process && rec.process.length > 0 
                            ? `${rec.process.length} ${t('service.steps')} • ${t('service.clickDetails')}`
                            : t('service.clickDetails')
                          }
                        </p>
                      </div>
                    </CardContent>
                    
                    <CardFooter className="pt-3 border-t flex gap-2">
                      <Button
                        className="flex-1"
                        variant={isFavorited(rec.id) ? "secondary" : "default"}
                        disabled={isFavorited(rec.id) || addFavorite.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSave(rec);
                        }}
                        data-testid={`button-save-${rec.id}`}
                      >
                        {isFavorited(rec.id) ? (
                          <>
                            <Heart className="w-4 h-4 mr-2 fill-current" />
                            {t('service.saved')}
                          </>
                        ) : addFavorite.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Heart className="w-4 h-4 mr-2" />
                            {t('service.save')}
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedService(convertToServiceDetail(rec));
                        }}
                        data-testid={`button-details-${rec.id}`}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <img src={rocLogo} alt="ROC Logo" className="w-24 h-auto mx-auto mb-4 opacity-30" />
            <h2 className="text-xl font-semibold text-foreground mb-2">{t('recommended.emptyTitle')}</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {t('recommended.emptyDesc')}
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/profile">
                <Button data-testid="button-add-demographics">
                  <User className="w-4 h-4 mr-2" />
                  {t('recommended.addInfo')}
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" data-testid="button-search">
                  {t('recommended.searchServices')}
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </main>

      <ServiceModal
        service={selectedService}
        isOpen={!!selectedService}
        onClose={() => setSelectedService(null)}
      />
    </div>
  );
}
