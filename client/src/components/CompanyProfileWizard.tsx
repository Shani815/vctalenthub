import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, Camera, GraduationCap, Target, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createElement, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUser } from "@/hooks/use-user";
import { IndustriesList } from "@/constants";
import MultiSelectField from "./ui/multi-select";

export const companySizeOptions = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
] as const;

export const fundingSizeOptions = [
  "Pre-seed",
  "Seed",
  "Series A",
  "Series B",
  "Series C+",
  "Growth",
  "N/A",
] as const;

export const companyProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  company: z.string().min(2, "Company name must be at least 2 characters"),
  bio: z.string().min(10, "Description must be at least 10 characters"),
  website: z.string().url("Must be a valid URL"),
  linkedIn: z.string().url("Must be a valid LinkedIn URL"),
  industry: z.array(z.string()).min(1, "At least one industry is required"),
  companySize: z.enum(companySizeOptions),
  fundingStage: z.enum(fundingSizeOptions),
  location: z.string().min(2, "Location is required"),
  mission: z.string().min(10, "Mission statement is required"),
  cultureValues: z.string().min(10, "Culture and values are required"),
  investmentThesis: z.string().optional(),
  portfolioSize: z.string().optional(),
  investmentRange: z.string().optional(),
});

type CompanyProfileFormData = z.infer<typeof companyProfileSchema>;

const steps = [
  {
    title: "Basic Information",
    description: "Let's start with your company's core details",
    icon: Building2,
    fields: ["name", "company", "bio", "website", "linkedIn"] as const,
  },
  {
    title: "Company Details",
    description: "Tell us more about your organization",
    icon: Users,
    fields: ["industry", "companySize", "fundingStage", "location"] as const,
  },
  {
    title: "Culture & Mission",
    description: "Share your company's vision and values",
    icon: Target,
    fields: ["mission", "cultureValues"] as const,
  },
];

type CompanyProfileWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CompanyProfileWizard({ open, onOpenChange }: CompanyProfileWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>();
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();

  // removing the investment step for startups this is for vc's only
  if (user?.role === 'venture_capitalist' &&steps.length === 3) {
    // only add it once
      steps.push({
        title: "Investment Focus",
        description: "Specify your investment preferences",
        icon: GraduationCap,
        fields: ["investmentThesis", "portfolioSize", "investmentRange"] as const,
      })
    
  }

  // Track scroll progress
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollPercent = (scrollTop / (scrollHeight - clientHeight)) * 100;
      setScrollProgress(Math.min(scrollPercent, 100));
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentStep]); // Reset and recalculate when step changes

  const form = useForm<CompanyProfileFormData>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      name: "",
      company: "",
      bio: "",
      website: "",
      linkedIn: "",
      industry: [],
      companySize: "1-10",
      fundingStage: "N/A",
      location: "",
      mission: "",
      cultureValues: "",
      investmentThesis: "",
      portfolioSize: "",
      investmentRange: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: CompanyProfileFormData) => {
      const formData = new FormData();
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }
      Object.entries(data).forEach(([key, value]) => {
        if (value) {
          formData.append(key, value);
        }
      });

      const res = await fetch('/api/company-profile', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      onOpenChange(false);
      toast({
        title: "Success",
        description: "Company profile created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const currentStepFields = steps[currentStep].fields;
  const isLastStep = currentStep === steps.length - 1;

  const next = async () => {
    const currentStepData = steps[currentStep];
    if (!currentStepData) return;

    const fieldsToValidate = currentStepData.fields;
    const formData = form.getValues();
    const stepData = Object.fromEntries(
      fieldsToValidate.map(field => [field, formData[field]])
    );

    const stepValidationSchema = z.object(
      Object.fromEntries(
        fieldsToValidate.map(field => [
          field,
          // For the investment step, make fields optional
          currentStep === 3
            ? companyProfileSchema.shape[field].optional()
            : companyProfileSchema.shape[field]
        ])
      )
    );

    try {
      stepValidationSchema.parse(stepData);

      if (isLastStep) {
        await form.handleSubmit(data => mutation.mutate(data))();
      } else {
        setCurrentStep(prevStep => prevStep + 1);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => {
          const fieldName = err.path[0] as keyof CompanyProfileFormData;
          form.setError(fieldName, {
            type: "manual",
            message: err.message,
          });

          toast({
            variant: "destructive",
            title: "Validation Error",
            description: `${fieldName}: ${err.message}`,
          });
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
        <div className="flex-none px-6 pt-6 pb-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative z-10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {createElement(steps[currentStep].icon, { className: "h-5 w-5" })}
              {steps[currentStep].title}
            </DialogTitle>
            <p className="text-muted-foreground text-sm">
              {steps[currentStep].description}
            </p>
          </DialogHeader>

          <div className="flex justify-between items-center mt-4">
            <div className="flex items-center gap-2">
              {steps.map((_, index) => (
                <motion.div
                  key={index}
                  className={`h-2 rounded-full ${index === currentStep
                      ? "w-8 bg-primary"
                      : index < currentStep
                        ? "w-2 bg-primary/80"
                        : "w-2 bg-gray-200"
                    }`}
                  initial={false}
                  animate={{ width: index === currentStep ? 32 : 8 }}
                  transition={{ duration: 0.3 }}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
            <motion.div
              className="h-full bg-primary/80 backdrop-blur"
              initial={{ width: 0 }}
              animate={{ width: `${scrollProgress}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>

          {currentStep === 0 && (
            <div className="flex justify-center my-6">
              <div className="relative">
                <Avatar className="h-24 w-24 border-2 border-primary/10">
                  <AvatarImage src={avatarPreview} />
                  <AvatarFallback>Csddd</AvatarFallback>
                </Avatar>
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 p-1 bg-background border border-border rounded-full cursor-pointer hover:bg-accent"
                >
                  <Camera className="h-4 w-4" />
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto min-h-0 px-6 relative"
        >
          <Form {...form}>
            <form className="space-y-4 py-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {currentStepFields.map(field => (
                    field === "industry" ?
                      <MultiSelectField name={field} label={field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')} form={form} options={IndustriesList} />
                      :
                      <FormField
                        key={field}
                        control={form.control}
                        name={field}
                        render={({ field: { onChange, value, ...rest } }) => (
                          <FormItem>
                            <FormLabel>{field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}</FormLabel>
                            <FormControl>
                              {field === "companySize" ? (
                                <Select value={value} onValueChange={onChange}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {companySizeOptions.map(option => (
                                      <SelectItem key={option} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : field === "fundingStage" ? (
                                <Select value={value} onValueChange={onChange}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {fundingSizeOptions.map(option => (
                                      <SelectItem key={option} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : field === "bio" || field === "mission" || field === "cultureValues" || field === "investmentThesis" ? (
                                <Textarea className="min-h-[100px]" {...rest} value={value} onChange={onChange} />
                              ) : (
                                <Input {...rest} value={value} onChange={onChange} />
                              )}
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                  ))}
                </motion.div>
              </AnimatePresence>
            </form>
          </Form>
        </div>

        <div className="flex-none px-6 py-4 flex justify-between border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(s => s - 1)}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={next} disabled={mutation.isPending}>
            {isLastStep ? (
              mutation.isPending ? "Creating..." : "Create Profile"
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}