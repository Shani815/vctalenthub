import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle,
  GraduationCap,
  Handshake,
  Medal,
  Network,
  Search,
  Target,
  UserCircle,
  Users
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createElement, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { CompanyProfileWizard } from "./CompanyProfileWizard";
import { StudentProfileWizard } from "./StudentProfileWizard";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

const studentSteps = [
  {
    icon: UserCircle,
    title: "Complete Your Profile",
    description: "Start by filling out your professional profile. Add your skills, experience, and a profile photo to stand out.",
    color: "text-blue-500",
  },
  {
    icon: Network,
    title: "Build Your Network",
    description: "Connect with other professionals, MBA students, and industry leaders to expand your opportunities.",
    color: "text-purple-500",
  },
  {
    icon: Building2,
    title: "Discover Companies",
    description: "Explore companies that match your interests and career goals.",
    color: "text-green-500",
  },
  {
    icon: Briefcase,
    title: "Find Opportunities",
    description: "Browse and apply to job opportunities that align with your career aspirations.",
    color: "text-orange-500",
  },
  {
    icon: Medal,
    title: "Earn Achievements",
    description: "Complete actions to earn achievements and showcase your engagement in the community.",
    color: "text-yellow-500",
  },
];

const companySteps = [
  {
    icon: Building2,
    title: "Company Profile",
    description: "Set up your company profile with key information about your organization, culture, and mission.",
    color: "text-blue-500",
  },
  {
    icon: Search,
    title: "Talent Discovery",
    description: "Access our pool of talented MBA candidates and filter by skills, experience, and interests.",
    color: "text-purple-500",
  },
  {
    icon: Briefcase,
    title: "Post Opportunities",
    description: "Create job listings to attract top MBA talent to your organization.",
    color: "text-green-500",
  },
  {
    icon: Users,
    title: "Team Management",
    description: "Add team members to collaborate on recruitment and talent engagement.",
    color: "text-orange-500",
  },
  {
    icon: Handshake,
    title: "Engage With Talent",
    description: "Connect directly with candidates and participate in our exclusive networking events.",
    color: "text-yellow-500",
  },
];

export function OnboardingDialog() {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showProfileWizard, setShowProfileWizard] = useState(false);
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !user.hasCompletedOnboarding) {
      setOpen(true);
    }
  }, [user]);

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setOpen(false);
    },
  });

  const handleNext = () => {
    if (currentStep === 0) {
      // Show profile wizard on first next click
      setShowProfileWizard(true);
    } else if (currentStep === (user?.role === 'student' ? studentSteps : companySteps).length - 1) {
      completeMutation.mutate();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleProfileWizardClose = (isOpen: boolean) => {
    setShowProfileWizard(isOpen);
    if (!isOpen) {
      // When profile wizard is closed, move to next step
      setCurrentStep(prev => prev + 1);
      toast({
        title: "Profile setup completed",
        description: "Let's continue with the next steps",
      });
    }
  };

  const steps = user?.role === 'student' ? studentSteps : companySteps;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px] h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Welcome Onboarding</DialogTitle>
          </DialogHeader>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="p-6"
            >
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    {steps.map((_, index) => (
                      <motion.div
                        key={index}
                        className={`h-2 rounded-full ${
                          index === currentStep
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

                <div className="flex items-center gap-4">
                  {createElement(steps[currentStep].icon, {
                    className: `h-12 w-12 ${steps[currentStep].color}`,
                  })}
                  <div>
                    <h2 className="text-2xl font-semibold mb-1">
                      {steps[currentStep].title}
                    </h2>
                    <p className="text-muted-foreground">
                      {steps[currentStep].description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                {currentStep > 0 && !showProfileWizard && (
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(prev => prev - 1)}
                  >
                    Back
                  </Button>
                )}
                <Button 
                  onClick={handleNext} 
                  disabled={showProfileWizard}
                >
                  {currentStep === steps.length - 1 ? (
                    <>
                      Get Started
                      <CheckCircle className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Next Step
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {user?.role === 'student' ? (
        <StudentProfileWizard
          open={showProfileWizard}
          onOpenChange={handleProfileWizardClose}
        />
      ) : (
        <CompanyProfileWizard
          open={showProfileWizard}
          onOpenChange={handleProfileWizardClose}
        />
      )}
    </>
  );
}