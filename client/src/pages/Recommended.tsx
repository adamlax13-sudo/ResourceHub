import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useRecommendations } from "@/hooks/use-profile";
import { useAddFavorite, useFavorites } from "@/hooks/use-favorites";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, Loader2, Heart, MapPin, Phone, Clock, User, ArrowRight, Menu, Home, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { ServiceModal } from "@/components/ServiceModal";
import { type ServiceDetail } from "@shared/schema";
import rocLogo from "@/assets/About_Recovery_on_Campus_Alberta_1768060674341.png";

function linkifyText(text: string): React.ReactNode {
  if (!text) return text;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  
  const combinedRegex = /(https?:\/\/[^\s,]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})|([a-zA-Z0-9][-a-zA-Z0-9]*\.(?:ca|com|org|net|edu)(?:\/[^\s,]*)?)/gi;
  
  let match;
  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    const matched = match[0];
    if (match[1]) {
      parts.push(
        <a key={key++} href={matched} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
          {matched}
        </a>
      );
    } else if (match[2]) {
      parts.push(
        <a key={key++} href={`mailto:${matched}`} className="text-primary hover:underline">
          {matched}
        </a>
      );
    } else if (match[3]) {
      const cleanPhone = matched.replace(/[^\d+]/g, '');
      parts.push(
        <a key={key++} href={`tel:${cleanPhone}`} className="text-primary hover:underline">
          {matched}
        </a>
      );
    } else if (match[4]) {
      const url = matched.startsWith('http') ? matched : `https://${matched}`;
      parts.push(
        <a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
          {matched}
        </a>
      );
    }
    
    lastIndex = match.index + matched.length;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
}

export default function Recommended() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: recommendations, isLoading, error } = useRecommendations();
  const { data: favorites } = useFavorites();
  const addFavorite = useAddFavorite();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
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
        action: (
          <ToastAction 
            altText={t('toast.viewResources')} 
            onClick={() => setLocation('/my-resources')}
            data-testid="toast-action-view-resources"
          >
            {t('toast.viewResources')}
          </ToastAction>
        ),
      });
    } catch (error) {
      toast({
        title: t('recommended.saveError'),
        variant: "destructive",
      });
    }
  };

  // Skeleton loading component for better UX
  const SkeletonCard = () => (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardHeader>
      <CardContent className="flex-1 pb-6 flex flex-col">
        <div className="bg-muted/50 rounded-lg p-3 mb-4">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-4 border-t flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-10" />
      </CardFooter>
    </Card>
  );

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-primary text-primary-foreground py-6">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <img src={rocLogo} alt="ROC Logo" className="h-8 sm:h-10 w-auto" />
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <Sparkles className="w-5 sm:w-6 h-5 sm:h-6" />
                <h1 className="text-xl sm:text-3xl font-display font-bold">{t('recommended.title')}</h1>
              </div>
              <div className="w-24" />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="mb-8 bg-primary/5 border-primary/20">
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <Loader2 className="w-6 h-6 text-primary animate-spin flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">{t('recommended.loading')}</p>
                  <p className="text-sm text-muted-foreground">{t('recommended.loadingDesc')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <SkeletonCard />
              </motion.div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-4 sm:py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Logo as home link */}
            <Link href="/">
              <img src={rocLogo} alt="ROC Logo" className="h-8 sm:h-10 w-auto cursor-pointer" data-testid="logo-home" />
            </Link>
            
            {/* Center: Title */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Sparkles className="w-5 sm:w-6 h-5 sm:h-6" />
              <h1 className="text-lg sm:text-3xl font-display font-bold">{t('recommended.title')}</h1>
            </div>
            
            {/* Right: Navigation */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Mobile: Dropdown menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild className="md:hidden">
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-mobile-menu">
                    <Menu className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem 
                    className="cursor-pointer" 
                    data-testid="menu-home"
                    onSelect={() => setLocation('/')}
                  >
                    <Home className="w-4 h-4 mr-2" />
                    {t('nav.home')}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="cursor-pointer" 
                    data-testid="menu-my-resources"
                    onSelect={() => setLocation('/my-resources')}
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    {t('nav.myResources')}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="cursor-pointer" 
                    data-testid="menu-profile"
                    onSelect={() => setLocation('/profile')}
                  >
                    <User className="w-4 h-4 mr-2" />
                    {t('nav2.profile')}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="cursor-pointer text-destructive" 
                    data-testid="menu-logout"
                    onSelect={() => { window.location.href = '/api/logout'; }}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {t('nav.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Desktop: Full navigation */}
              <Link href="/" className="hidden md:block">
                <Button variant="ghost" className="text-white hover:bg-white/20" data-testid="button-home">
                  {t('nav.home')}
                </Button>
              </Link>
              <Link href="/my-resources" className="hidden md:block">
                <Button variant="ghost" className="text-white hover:bg-white/20" data-testid="link-my-resources">
                  {t('nav.myResources')}
                </Button>
              </Link>
              <Link href="/profile" className="hidden md:block">
                <Button variant="ghost" className="text-white hover:bg-white/20" data-testid="link-profile">
                  <User className="w-4 h-4 mr-2" />
                  {t('nav2.profile')}
                </Button>
              </Link>
              <LanguageSwitcher variant="ghost" className="text-white hover:bg-white/20" />
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recommendations.recommendations.map((rec: any, index: number) => (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card 
                    className="h-full flex flex-col hover-elevate cursor-pointer group overflow-hidden"
                    onClick={() => setSelectedService(convertToServiceDetail(rec))}
                    data-testid={`card-recommendation-${rec.id}`}
                  >
                    <CardHeader className="pb-4 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          {rec.category}
                        </Badge>
                        {isFavorited(rec.id) && (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <Heart className="w-3 h-3 mr-1 fill-current" aria-hidden="true" />
                            {t('service.saved')}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors min-w-0 break-words hyphens-auto line-clamp-2">{rec.name}</CardTitle>
                      <CardDescription className="text-sm min-w-0 break-words line-clamp-2">
                        {rec.description}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="flex-1 pb-6 flex flex-col min-w-0">
                      <div className="bg-muted/50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-muted-foreground italic line-clamp-3 break-words">
                          <Sparkles className="w-3 h-3 inline mr-1 text-primary" aria-hidden="true" />
                          {rec.reasoning}
                        </p>
                      </div>
                      
                      <div className="space-y-3 text-sm min-w-0">
                        {rec.location && (
                          <div className="flex items-start gap-2 min-w-0">
                            <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
                            <span className="text-muted-foreground break-words line-clamp-2 min-w-0"><span className="sr-only">Location: </span>{linkifyText(rec.location)}</span>
                          </div>
                        )}
                        {rec.contact && (
                          <div className="flex items-start gap-2 min-w-0">
                            <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
                            <span className="text-muted-foreground break-words line-clamp-2 min-w-0"><span className="sr-only">Contact: </span>{linkifyText(rec.contact)}</span>
                          </div>
                        )}
                        {rec.waitTimes && (
                          <div className="flex items-start gap-2 min-w-0">
                            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
                            <span className="text-muted-foreground break-words line-clamp-2 min-w-0"><span className="sr-only">Wait time: </span>{linkifyText(rec.waitTimes)}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-auto pt-8">
                        <div className="flex items-center gap-2">
                          {rec.process && rec.process.length > 0 && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary font-semibold">
                              {rec.process.length} {t('service.steps')}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{t('service.clickDetails')}</span>
                        </div>
                      </div>
                    </CardContent>
                    
                    <CardFooter className="pt-4 border-t flex gap-2">
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
            <a href="https://www.recoveryoncampusalberta.ca/" target="_blank" rel="noopener noreferrer">
              <img src={rocLogo} alt="ROC Logo" className="w-24 h-auto mx-auto mb-4 opacity-30 hover:opacity-50 transition-opacity" loading="lazy" />
            </a>
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
