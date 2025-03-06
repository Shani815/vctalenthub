import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Book, Briefcase, Camera, Check, ChevronsUpDown, GraduationCap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PREDEFINED_SKILLS, PREDEFINED_UNIVERSITIES } from "@/pages/DashboardPage";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createElement, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

export const graduationYears = Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() + i).toString());

export const studentProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  university: z.string().min(2, "University is required"),
  graduationYear: z.string().min(4, "Graduation year is required"),
  major: z.string().min(2, "Major/Concentration is required"),
  bio: z.string().optional(),
  location: z.string().min(2, "Location is required"),
  linkedIn: z.string().url("Must be a valid LinkedIn URL").optional().or(z.literal('')),
  previousExperience: z.string().min(10, "Previous experience is required"),
  careerGoals: z.string().min(10, "Career goals are required"),
  skills: z.array(z.string()).min(1, "At least one skill is required"),
});

type StudentProfileFormData = z.infer<typeof studentProfileSchema>;

interface Step {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: readonly (keyof StudentProfileFormData)[];
  optionalFields?: readonly (keyof StudentProfileFormData)[];
}

const steps: readonly Step[] = [
  {
    title: "Personal Information",
    description: "Tell us about yourself",
    icon: GraduationCap,
    fields: ["name", "location"] as const,
    optionalFields: ["bio", "linkedIn"] as const,
  },
  {
    title: "Education",
    description: "Share your academic background",
    icon: Book,
    fields: ["university", "graduationYear", "major"] as const,
  },
  {
    title: "Experience & Goals",
    description: "Tell us about your career journey",
    icon: Briefcase,
    fields: ["previousExperience", "careerGoals", "skills"] as const,
  },
] as const;

type StudentProfileWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function StudentProfileWizard({ open, onOpenChange }: StudentProfileWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>();
  const [skillsPopoverOpen, setSkillsPopoverOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<StudentProfileFormData>({
    resolver: zodResolver(studentProfileSchema),
    defaultValues: {
      name: "",
      university: "",
      graduationYear: new Date().getFullYear().toString(),
      major: "",
      bio: "",
      location: "",
      linkedIn: "",
      previousExperience: "",
      careerGoals: "",
      skills: [],
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: StudentProfileFormData) => {
      const formData = new FormData();
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }
      
      Object.entries(data).forEach(([key, value]) => {
        if (value) {
          formData.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
        }
      });
      

      const res = await fetch('/api/student-profile', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      onOpenChange(false);
      toast({
        title: "Success",
        description: "Student profile created successfully",
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

  const next = async () => {
    const currentStepData = steps[currentStep];
    if (!currentStepData) return;
  
    const fieldsToValidate: Array<keyof StudentProfileFormData> = [
      ...currentStepData.fields,
      ...(currentStepData.optionalFields ?? []),
    ];
    const formData = form.getValues();
    const stepData = Object.fromEntries(
      fieldsToValidate.map(field => [field, formData[field]])
    );
  
    const stepValidationSchema = z.object(
      Object.fromEntries(
        fieldsToValidate.map(field => [
          field,
          currentStepData.optionalFields?.includes(field)
            ? studentProfileSchema.shape[field].optional()
            : studentProfileSchema.shape[field],
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
          const fieldName = err.path[0] as keyof StudentProfileFormData;
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
  

  const currentStepFields = [
    ...steps[currentStep].fields,
    ...(steps[currentStep].optionalFields ?? []),
  ];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative z-10">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                {createElement(steps[currentStep].icon, { className: "h-5 w-5" })}
                {steps[currentStep].title}
              </div>
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm mt-2">
            {steps[currentStep].description}
          </p>
        </div>

        <div className="flex justify-between items-center mt-4 px-6">
          <div className="flex items-center gap-2">
            {steps.map((_, index) => (
              <motion.div
                key={index}
                className={cn(
                  "h-2 rounded-full",
                  index === currentStep
                    ? "w-8 bg-primary"
                    : index < currentStep
                    ? "w-2 bg-primary/80"
                    : "w-2 bg-gray-200"
                )}
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

        {currentStep === 0 && (
          <div className="flex justify-center my-6 px-6">
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-primary/10">
                <AvatarImage src={avatarPreview} />
                <AvatarFallback>ST</AvatarFallback>
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

        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-6"
        >
          <Form {...form}>
            <form className="space-y-4 py-4" onSubmit={(e) => e.preventDefault()}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {currentStepFields.map(field => (
                    <FormField
                      key={field}
                      control={form.control}
                      name={field}
                      render={({ field: { onChange, value, ...rest } }) => (
                        <FormItem>
                          <FormLabel>{field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}</FormLabel>
                          <FormControl>
                            {field === "skills" ? (
                              <div className="space-y-2">
                                <Popover open={skillsPopoverOpen} onOpenChange={setSkillsPopoverOpen}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={skillsPopoverOpen}
                                      className="w-full justify-between"
                                    >
                                      {Array.isArray(value) && value.length > 0
                                        ? `${value.length} skill${value.length === 1 ? '' : 's'} selected`
                                        : "Select skills..."}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-full p-0">
                                    <Command>
                                      <CommandInput placeholder="Search skills..." />
                                      <CommandEmpty>No skill found.</CommandEmpty>
                                      <CommandGroup className="max-h-64 overflow-auto">
                                        {PREDEFINED_SKILLS.map((skill) => (
                                          <CommandItem
                                            key={skill}
                                            onSelect={() => {
                                              const currentValue = value as string[];
                                              const newValue = currentValue.includes(skill)
                                                ? currentValue.filter(s => s !== skill)
                                                : [...currentValue, skill];
                                              onChange(newValue);
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                Array.isArray(value) && value.includes(skill)
                                                  ? "opacity-100"
                                                  : "opacity-0"
                                              )}
                                            />
                                            {skill}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </Command>
                                  </PopoverContent>
                                </Popover>

                                <div className="flex flex-wrap gap-2">
                                  {Array.isArray(value) && value.map((skill: string) => (
                                    <Badge
                                      key={skill}
                                      variant="secondary"
                                      className="cursor-pointer"
                                      onClick={() => {
                                        onChange(value.filter((s: string) => s !== skill));
                                      }}
                                    >
                                      {skill} ×
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ) : field === "graduationYear" ? (
                              <Select value={value?.toString()} onValueChange={onChange}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {graduationYears.map(year => (
                                    <SelectItem key={year} value={year}>
                                      {year}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : field === "bio" || field === "previousExperience" || field === "careerGoals" ? (
                              <Textarea className="min-h-[100px]" {...rest} value={value} onChange={onChange} />
                            ) : field === "university" ? (
                              <Select onValueChange={onChange} value={value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select your university" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {PREDEFINED_UNIVERSITIES.map((university) => (
                                    <SelectItem key={university} value={university}>
                                      {university}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
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

        <div className="px-6 py-4 flex justify-between border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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