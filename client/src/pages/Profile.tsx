import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateDemographicsSchema, type UpdateDemographics } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { User, Loader2, Check, LogOut, Sparkles, Heart, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useToast } from "@/hooks/use-toast";
import rocLogo from "@assets/About_Recovery_on_Campus_Alberta_1768060674341.png";

const AGE_OPTIONS = [
  { value: "under-18", label: "Under 18" },
  { value: "18-24", label: "18-24" },
  { value: "25-34", label: "25-34" },
  { value: "35-44", label: "35-44" },
  { value: "45-54", label: "45-54" },
  { value: "55+", label: "55+" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const GENDER_OPTIONS = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non-binary", label: "Non-binary" },
  { value: "two-spirit", label: "Two-Spirit" },
  { value: "genderqueer", label: "Genderqueer" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const RACE_OPTIONS = [
  { value: "indigenous", label: "Indigenous (First Nations, Métis, Inuit)" },
  { value: "black", label: "Black" },
  { value: "east-asian", label: "East Asian" },
  { value: "south-asian", label: "South Asian" },
  { value: "southeast-asian", label: "Southeast Asian" },
  { value: "middle-eastern", label: "Middle Eastern" },
  { value: "latin-american", label: "Latin American" },
  { value: "white", label: "White" },
  { value: "mixed", label: "Mixed/Multiracial" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const SEXUALITY_OPTIONS = [
  { value: "straight", label: "Straight/Heterosexual" },
  { value: "gay", label: "Gay" },
  { value: "lesbian", label: "Lesbian" },
  { value: "bisexual", label: "Bisexual" },
  { value: "pansexual", label: "Pansexual" },
  { value: "asexual", label: "Asexual" },
  { value: "queer", label: "Queer" },
  { value: "two-spirit", label: "Two-Spirit" },
  { value: "questioning", label: "Questioning" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const EDUCATION_OPTIONS = [
  { value: "high-school", label: "High School" },
  { value: "some-college", label: "Some College/University" },
  { value: "undergraduate", label: "Undergraduate Student" },
  { value: "graduate", label: "Graduate Student" },
  { value: "completed-degree", label: "Completed Degree" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const RELIGION_OPTIONS = [
  { value: "none", label: "No religion" },
  { value: "christian", label: "Christian" },
  { value: "catholic", label: "Catholic" },
  { value: "muslim", label: "Muslim" },
  { value: "jewish", label: "Jewish" },
  { value: "hindu", label: "Hindu" },
  { value: "buddhist", label: "Buddhist" },
  { value: "sikh", label: "Sikh" },
  { value: "indigenous-spiritual", label: "Indigenous Spirituality" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const ADDICTION_OPTIONS = [
  { value: "yes-currently", label: "Yes, currently in recovery" },
  { value: "yes-past", label: "Yes, in the past" },
  { value: "no", label: "No" },
  { value: "supporting-someone", label: "Supporting someone in recovery" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const UNIVERSITY_OPTIONS = [
  { value: "not-in-university", label: "Not currently in post-secondary" },
  { value: "in-highschool", label: "In High School" },
  { value: "university-of-alberta", label: "University of Alberta" },
  { value: "university-of-calgary", label: "University of Calgary" },
  { value: "university-of-lethbridge", label: "University of Lethbridge" },
  { value: "macewan-university", label: "MacEwan University" },
  { value: "mount-royal-university", label: "Mount Royal University" },
  { value: "athabasca-university", label: "Athabasca University" },
  { value: "nait", label: "NAIT" },
  { value: "sait", label: "SAIT" },
  { value: "norquest-college", label: "NorQuest College" },
  { value: "bow-valley-college", label: "Bow Valley College" },
  { value: "lethbridge-college", label: "Lethbridge College" },
  { value: "red-deer-polytechnic", label: "Red Deer Polytechnic" },
  { value: "grande-prairie-regional-college", label: "Grande Prairie Regional College" },
  { value: "keyano-college", label: "Keyano College" },
  { value: "lakeland-college", label: "Lakeland College" },
  { value: "medicine-hat-college", label: "Medicine Hat College" },
  { value: "olds-college", label: "Olds College" },
  { value: "other", label: "Other Alberta Institution" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const LOCATION_OPTIONS = [
  { value: "calgary", label: "Calgary" },
  { value: "edmonton", label: "Edmonton" },
  { value: "red-deer", label: "Red Deer" },
  { value: "lethbridge", label: "Lethbridge" },
  { value: "st-albert", label: "St. Albert" },
  { value: "medicine-hat", label: "Medicine Hat" },
  { value: "grande-prairie", label: "Grande Prairie" },
  { value: "airdrie", label: "Airdrie" },
  { value: "spruce-grove", label: "Spruce Grove" },
  { value: "leduc", label: "Leduc" },
  { value: "fort-mcmurray", label: "Fort McMurray" },
  { value: "lloydminster", label: "Lloydminster" },
  { value: "camrose", label: "Camrose" },
  { value: "brooks", label: "Brooks" },
  { value: "cold-lake", label: "Cold Lake" },
  { value: "wetaskiwin", label: "Wetaskiwin" },
  { value: "banff", label: "Banff" },
  { value: "canmore", label: "Canmore" },
  { value: "okotoks", label: "Okotoks" },
  { value: "cochrane", label: "Cochrane" },
  { value: "sherwood-park", label: "Sherwood Park" },
  { value: "fort-saskatchewan", label: "Fort Saskatchewan" },
  { value: "other", label: "Other (specify below)" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const DISABILITY_OPTIONS = [
  { value: "none", label: "No disability" },
  { value: "physical", label: "Physical/Mobility disability" },
  { value: "sensory", label: "Sensory disability (vision, hearing)" },
  { value: "cognitive", label: "Cognitive/Learning disability" },
  { value: "mental-health", label: "Mental health condition" },
  { value: "chronic", label: "Chronic illness/Invisible disability" },
  { value: "multiple", label: "Multiple disabilities" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const SERVICE_FORMAT_OPTIONS = [
  { value: "virtual", label: "Virtual/Online" },
  { value: "in-person", label: "In-Person" },
  { value: "no-preference", label: "No preference" },
];

const SUPPORT_STYLE_OPTIONS = [
  { value: "one-on-one", label: "One-on-One" },
  { value: "group", label: "Peer Support/Group" },
  { value: "no-preference", label: "No preference" },
];

export default function Profile() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<UpdateDemographics>({
    resolver: zodResolver(updateDemographicsSchema),
    defaultValues: {
      age: null,
      gender: null,
      race: null,
      sexuality: null,
      education: null,
      religion: null,
      inAddiction: null,
      university: null,
      location: null,
      customLocation: null,
      disability: null,
      serviceFormat: null,
      supportStyle: null,
    },
  });

  const watchLocation = form.watch("location");

  useEffect(() => {
    if (profile) {
      form.reset({
        age: profile.age || null,
        gender: profile.gender || null,
        race: profile.race || null,
        sexuality: profile.sexuality || null,
        education: profile.education || null,
        religion: profile.religion || null,
        inAddiction: profile.inAddiction || null,
        university: profile.university || null,
        location: profile.location || null,
        customLocation: profile.customLocation || null,
        disability: profile.disability || null,
        serviceFormat: profile.serviceFormat || null,
        supportStyle: profile.supportStyle || null,
      });
    }
  }, [profile, form]);

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = "/api/login";
    }
  }, [user, authLoading]);

  const onSubmit = async (data: UpdateDemographics) => {
    try {
      await updateProfile.mutateAsync(data);
      toast({
        title: t('profile.saved'),
        description: t('profile.savedDesc'),
      });
      setLocation("/");
      window.scrollTo(0, 0);
    } catch (error) {
      toast({
        title: t('profile.error'),
        description: t('profile.errorDesc'),
        variant: "destructive",
      });
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <a href="https://www.recoveryoncampusalberta.ca/" target="_blank" rel="noopener noreferrer">
                <img src={rocLogo} alt="ROC Logo" className="h-8 sm:h-10 w-auto" />
              </a>
              <Link href="/">
                <Button variant="ghost" className="text-white hover:bg-white/20" data-testid="button-home">
                  {t('nav.home')}
                </Button>
              </Link>
            </div>
            <h1 className="text-xl sm:text-3xl font-display font-bold">{t('profile.title')}</h1>
            <div className="flex items-center gap-1 sm:gap-2">
              <Link href="/recommended">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 md:hidden" data-testid="link-recommended-mobile">
                  <Sparkles className="w-4 h-4" />
                </Button>
                <Button variant="ghost" className="text-white hover:bg-white/20 hidden md:flex" data-testid="link-recommended">
                  <Sparkles className="w-4 h-4 mr-2" />
                  {t('nav2.recommended')}
                </Button>
              </Link>
              <Link href="/my-resources">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 md:hidden" data-testid="link-my-resources-mobile">
                  <Heart className="w-4 h-4" />
                </Button>
                <Button variant="ghost" className="text-white hover:bg-white/20 hidden md:flex" data-testid="link-my-resources">
                  {t('nav.myResources')}
                </Button>
              </Link>
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

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{t('profile.demographicsTitle')}</CardTitle>
                  <CardDescription>{t('profile.demographicsDesc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.age')}</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-age">
                              <SelectValue placeholder={t('profile.selectPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {AGE_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{t('profile.ageDesc')}</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.gender')}</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-gender">
                              <SelectValue placeholder={t('profile.selectPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GENDER_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{t('profile.genderDesc')}</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="race"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.race')}</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-race">
                              <SelectValue placeholder={t('profile.selectPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RACE_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{t('profile.raceDesc')}</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sexuality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.sexuality')}</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-sexuality">
                              <SelectValue placeholder={t('profile.selectPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SEXUALITY_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{t('profile.sexualityDesc')}</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="education"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.education')}</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-education">
                              <SelectValue placeholder={t('profile.selectPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EDUCATION_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{t('profile.educationDesc')}</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="religion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.religion')}</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-religion">
                              <SelectValue placeholder={t('profile.selectPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RELIGION_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{t('profile.religionDesc')}</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="inAddiction"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.inAddiction')}</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-addiction">
                              <SelectValue placeholder={t('profile.selectPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ADDICTION_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{t('profile.inAddictionDesc')}</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="university"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.university')}</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-university">
                              <SelectValue placeholder={t('profile.selectPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {UNIVERSITY_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{t('profile.universityDesc')}</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {t('profile.location')}
                        </FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-location">
                              <SelectValue placeholder={t('profile.selectPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LOCATION_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{t('profile.locationDesc')}</FormDescription>
                      </FormItem>
                    )}
                  />

                  {watchLocation === "other" && (
                    <FormField
                      control={form.control}
                      name="customLocation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.customLocation')}</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder={t('profile.customLocationPlaceholder')}
                              value={field.value || ""}
                              onChange={field.onChange}
                              data-testid="input-custom-location"
                            />
                          </FormControl>
                          <FormDescription>{t('profile.customLocationDesc')}</FormDescription>
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="disability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.disability')}</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-disability">
                              <SelectValue placeholder={t('profile.selectPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DISABILITY_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{t('profile.disabilityDesc')}</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="serviceFormat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.serviceFormat')}</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-service-format">
                              <SelectValue placeholder={t('profile.selectPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SERVICE_FORMAT_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{t('profile.serviceFormatDesc')}</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="supportStyle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.supportStyle')}</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-support-style">
                              <SelectValue placeholder={t('profile.selectPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SUPPORT_STYLE_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{t('profile.supportStyleDesc')}</FormDescription>
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3 pt-4">
                    <Button 
                      type="submit" 
                      disabled={updateProfile.isPending}
                      data-testid="button-save-profile"
                    >
                      {updateProfile.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      {t('profile.saveButton')}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => form.reset({ age: null, gender: null, race: null, sexuality: null, education: null, religion: null, inAddiction: null, university: null, serviceFormat: null, supportStyle: null })}
                      data-testid="button-clear-profile"
                    >
                      {t('profile.clearButton')}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">{t('profile.privacyTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('profile.privacyDesc')}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
