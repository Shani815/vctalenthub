import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Job } from "@/db/schema";
import { Loader2 } from "lucide-react";
import { PaywallModal } from "@/components/PaywallModal";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface UserWithTemp {
  tier: 'free' | 'premium';
  temp?: {
    totalJobApplications: number;
  };
}

const applicationSchema = z.object({
  resumeFile: z.instanceof(File, { message: "Resume file is required" }),
  coverLetter: z.string().optional(),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

interface QuickApplyDialogProps {
  job: Job;
  trigger?: React.ReactNode;
}

export function QuickApplyDialog({ job, trigger }: QuickApplyDialogProps) {
  const [open, setOpen] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser() as { user: UserWithTemp | null };

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
  });

  const handleOpenChange = (newOpen: boolean) => {
    // Check application limit before opening
    if (newOpen && user?.tier === 'free' && (user.temp?.totalJobApplications ?? 0) >= 2) {
      setShowPaywallModal(true);
      return;
    }
    setOpen(newOpen);
  };

  const applicationMutation = useMutation({
    mutationFn: async (data: ApplicationFormData) => {
      const formData = new FormData();
      formData.append("resumeFile", data.resumeFile);
      if (data.coverLetter) {
        formData.append("coverLetter", data.coverLetter);
      }

      const res = await fetch(`/api/jobs/${job.id}/apply`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });

      setOpen(false);
      toast({
        title: "Application Submitted",
        description: "Your application has been submitted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ApplicationFormData) => {
    applicationMutation.mutate(data);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {trigger || <Button>Quick Apply</Button>}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Apply - {job.title}</DialogTitle>
            <DialogDescription>{job.description}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="resumeFile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resume</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            field.onChange(file);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="coverLetter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personalize your Application with a Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Why are you interested in this position?"
                        className="h-32"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={applicationMutation.isPending}
              >
                {applicationMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Application"
                )}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <PaywallModal
        isOpen={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        feature="jobApplications"
      />
    </>
  );
}