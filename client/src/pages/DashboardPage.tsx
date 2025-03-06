import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditProfileDialog } from "@/components/EditProfileDialog";
import { Input } from "@/components/ui/input";
import { JobCard } from "@/components/JobCard";
import { Label } from "@/components/ui/label";
import PendingIntros from '@/components/PendingIntros';
import { ProfileCard } from "@/components/ProfileCard";
import { ProfileQRCode } from "@/components/ProfileQRCode";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { useUser } from "@/hooks/use-user";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { IndustriesList, UniversitiesList } from "@/constants";

// Predefined skills list
export const PREDEFINED_SKILLS = [
  "Financial Modeling & Valuation",
  "Business Analytics",
  "Market Research & Competitive Analysis",
  "Forecasting & Projections",
  "Due Diligence",
  "Data Analysis (Excel, SQL, Tableau, etc.)",
  "Performance Metrics (CAC, LTV, ROI, etc.)",
  "Capital Structuring",
  "Fundraising Strategy",
  "Risk Assessment",
  "Pitch Deck Creation",
  "Investor Relations",
  "Strategic Planning",
  "Business Development",
  "Deal Sourcing",
  "Growth Strategy",
  "Product Management",
  "Operations Management",
  "Team Leadership",
  "Stakeholder Management",
  "Budgeting & Cost Management",
  "Legal & Compliance Understanding",
  "Contract Negotiation",
  "Networking & Relationship Building",
  "Storytelling & Presentation Skills",
  "Startup Ecosystem Knowledge",
  "Industry Expertise (e.g., SaaS, FinTech, HealthTech, etc.)",
  "Agile Project Management",
  "Time Management & Prioritization",
  "Decision-Making & Problem-Solving",
  "Cross-Functional Collaboration",
  "People Management",
  "Leadership & Mentorship",
  "Fund Operations (for VC roles)",
  "Portfolio Management",
  "Exit Strategy Planning",
  "Market Expansion Strategy",
  "Technical Literacy",
  "Customer Discovery & Research",
  "Go-to-Market Strategy",
  "Brand Development & Marketing Strategy",
  "Sales Strategy & Negotiation",
  "Growth Hacking & User Acquisition",
  "Data-Driven Decision Making",
  "Ecosystem Mapping",
  "Conflict Resolution",
  "Adaptability & Resilience",
  "Pitching to Stakeholders",
  "Financial Reporting & KPIs Tracking",
  "Equity & Cap Table Management",
  "Venture Accounting Basics",
  "Public Speaking & Communication",
  "Team Building",
  "Organizational Design",
  "Investor Reporting & Fundraising Materials Preparation",
  "Emerging Trends Analysis",
  "Intellectual Curiosity & Continuous Learning"
].sort();

// Add this constant after PREDEFINED_SKILLS
export const PREDEFINED_UNIVERSITIES = [
  ...UniversitiesList
].sort();

// Add this constant after PREDEFINED_UNIVERSITIES
export const PREDEFINED_INDUSTRIES = [
  ...IndustriesList
].sort();

// Add after PREDEFINED_INDUSTRIES constant
export const GRADUATION_YEARS = Array.from(
  { length: 2025 - 1960 + 1 },
  (_, i) => (1960 + i).toString()
).sort((a, b) => b.localeCompare(a)); // Sort in descending order (most recent first)

// Profile schema should conditionally require company fields only for company users
const profileSchema = z.object({
  name: z.string().min(3),
  bio: z.string().optional(),
  skills: z.array(z.string()).default([]),
  location: z.string(),
  university: z.string().optional(),
  graduationYear: z.string().optional(),
  company: z.string().optional(),
  companySize: z.string().optional(),
  industry: z.array(z.string()).default([]),
});

const jobSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  type: z.enum(["full_time", "part_time", "internship", "contract"]),
  location: z.string().min(1, "Location is required"),
  salaryMin: z.coerce.number().min(0),
  salaryMax: z.coerce.number().min(0),
  isRemote: z.boolean(),
  internshipType: z.enum(["paid", "unpaid", "not_applicable","contract"]).optional(),
  requirements: z.array(z.string()).optional(),
  category: z.enum(["technical", "business", "design", "other"]).optional(),
  experienceLevel: z.enum(["entry", "mid", "senior", "executive"]).optional(),
  department: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type JobFormData = z.infer<typeof jobSchema>;

export type Profile = {
  id: number;
  userId: number;
  name: string;
  bio: string | null;
  skills: string[];
  location: string;
  university: string | null;
  graduationYear: string | null;
  company: string | null;
  companySize: string | null;
  industry: string[];
  linkedIn: string | null;
  avatarUrl: string | null;
  website: string | null;
  mission: string | null;
  fundingStage: string | null;
};

export type JobWithCompany = {
  id: number;
  title: string;
  description: string;
  location: string;
  type: 'full_time' | 'part_time' | 'internship' | 'contract';
  internshipType: 'paid' | 'unpaid' | 'not_applicable';
  salaryMin: number | null;
  salaryMax: number | null;
  isRemote: boolean;
  userId: number;
  requirements: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
  company: {
    name: string;
  };
};

export type JobApplication = {
  id: number;
  jobId: number;
  userId: number;
  status: string;
  createdAt: string;
};

export default function DashboardPage() {
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const { user } = useUser();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: loadingProfile } = useQuery<Profile>({
    queryKey: ['/api/profile'],
  });

  const { data: pendingIntros, isLoading: loadingPendingIntros } = useQuery<any[]>({
    queryKey: ['/api/intros/pending'],
  });

  const { data: jobs, isLoading: loadingJobs } = useQuery<any>({
    queryKey: ['/api/jobs'],
  });

  const { data: applications, isLoading: loadingApplications } = useQuery<JobApplication[]>({
    queryKey: ['/api/applications'],
    enabled: user?.role === 'student',
  });

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile?.name || "",
      bio: profile?.bio || "",
      skills: profile?.skills || [],
      location: profile?.location || "",
      university: profile?.university || "",
      graduationYear: profile?.graduationYear || "",
      company: profile?.company || "",
      companySize: profile?.companySize || "",
      industry: profile?.industry || [],
    },
  });

  const jobForm = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: "",
      description: "",
      requirements: [],
      location: "",
      type: "full_time",
      internshipType: 'not_applicable',
      salaryMin: 0,
      salaryMax: 0,
      isRemote: false,
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
    },
  });

  const jobMutation = useMutation({
    mutationFn: async (data: JobFormData) => {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setJobDialogOpen(false);
      jobForm.reset();
    },
  });

  if (loadingProfile || loadingJobs || loadingApplications || loadingPendingIntros) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredJobs = jobs?.filter(job =>
    (user?.role === 'startup' || user?.role === 'venture_capitalist') ? job.userId === user.id : true
  ) || [];

  // Get applied jobs
  const appliedJobs = applications && jobs
    ? jobs.filter(job => applications.some(app => app.jobId === job.id))
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              {!profile ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Complete Your Profile</CardTitle>
                    <CardDescription>
                      Tell us about yourself to get started
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EditProfileDialog 
                      profile={{
                        id: 0,
                        userId: user?.id || 0,
                        name: "",
                        bio: null,
                        skills: [],
                        location: null,
                        avatarUrl: null,
                        university: null,
                        graduationYear: null,
                        major: null,
                        previousExperience: null,
                        careerGoals: null,
                        company: null,
                        website: null,
                        linkedIn: null,
                        industry: [],
                        companySize: null,
                        fundingStage: null,
                        mission: null,
                        cultureValues: null,
                        investmentThesis: null,
                        portfolioSize: null,
                        investmentRange: null,
                      }}
                      isNewProfile={true}
                      trigger={
                        <Button className="w-full">
                          Complete Your Profile
                        </Button>
                      }
                    />
                  </CardContent>
                </Card>
              ) : (
                <ProfileCard
                  profile={profile}
                  userId={user?.id || 0}
                  role={user?.role as 'student' | 'venture_capitalist' | 'startup'}
                  showEditButton
                />
              )}
            </CardContent>
          </Card>
          <PendingIntros pendingIntros={pendingIntros} />
          {profile && <ProfileQRCode profile={profile} />}
        </section>

        <section>
          {(user?.role === 'venture_capitalist' || user?.role === 'startup') ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Your Job Postings</h2>
                <Dialog open={jobDialogOpen} onOpenChange={setJobDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Post Job
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] max-h-[90%] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create Job Posting</DialogTitle>
                    </DialogHeader>
                    <Form {...jobForm}>
                      <form onSubmit={jobForm.handleSubmit(data => jobMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={jobForm.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Job Title</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={jobForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea {...field} className="min-h-[100px]" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={jobForm.control}
                          name="requirements"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Requirements (one per line)</FormLabel>
                              <FormControl>
                                <Textarea 
                                  {...field}
                                  className="min-h-[100px]"
                                  value={field.value?.join('\n') || ''}
                                  onChange={e => {
                                    const requirements = e.target.value
                                      .split('\n')
                                      .filter(line => line.trim() !== '');
                                    field.onChange(requirements);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={jobForm.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Location</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={jobForm.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Job Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select job type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="full_time">Full Time</SelectItem>
                                  <SelectItem value="part_time">Part Time</SelectItem>
                                  <SelectItem value="internship">Internship</SelectItem>
                                  <SelectItem value="contract">Contract</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="isRemote">Remote Work</Label>
                            <FormField
                              control={jobForm.control}
                              name="isRemote"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      id="isRemote"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={jobForm.control}
                              name="salaryMin"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Min Salary (optional)</FormLabel>
                                  <FormControl>
                                    <Input type="number" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={jobForm.control}
                              name="salaryMax"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Max Salary (optional)</FormLabel>
                                  <FormControl>
                                    <Input type="number" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        <Button type="submit" className="w-full" disabled={jobMutation.isPending}>
                          {jobMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Posting...
                            </>
                          ) : (
                            "Post Job"
                          )}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="space-y-4">
                {filteredJobs.map((job) => (
                  <JobCard key={job.id} job={job} showApply={false} />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Recent Opportunities</h2>
              <div className="space-y-4">
                {filteredJobs.slice(0, 3).map((job) => (
                  <JobCard key={job.id} job={job} showApply />
                ))}
                {filteredJobs.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No job opportunities available at the moment.
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}