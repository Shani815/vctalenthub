import * as z from "zod";

import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobCard } from "./JobCard";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { zodResolver } from "@hookform/resolvers/zod";

// Schema and type definitions
const jobFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  type: z.enum(["full_time", "part_time", "internship", "contract"]),
  location: z.string().min(1, "Location is required"),
  salaryMin: z.coerce.number().min(0),
  salaryMax: z.coerce.number().min(0),
  isRemote: z.boolean(),
  internshipType: z.enum(["paid", "unpaid", "not_applicable"]).optional(),
  requirements: z.array(z.string()).optional(),
  category: z.enum(["technical", "business", "design", "other"]).optional(),
  experienceLevel: z.enum(["entry", "mid", "senior", "executive"]).optional(),
  department: z.string().optional(),
});

type JobFormValues = z.infer<typeof jobFormSchema>;

export function MyJobs() {
  const { toast } = useToast();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Check for venture_capitalist or startup role
  const hasAccess = user?.role === 'venture_capitalist' || user?.role === 'startup';

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['/api/jobs', { filter: 'posted' }],
    queryFn: async () => {
      try {
        const response = await fetch('/api/jobs?filter=posted', {
          credentials: 'include'
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText);
        }

        const data = await response.json();
        return data.filter((job: any) => job.userId === user?.id);
      } catch (error) {
        throw error;
      }
    },
    enabled: hasAccess
  });

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "full_time",
      location: "",
      salaryMin: 0,
      salaryMax: 0,
      isRemote: false,
      category: "other",
      experienceLevel: "mid",
    },
  });

  if (!hasAccess) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            You don't have permission to post jobs. Role: {user?.role}
          </p>
        </CardContent>
      </Card>
    );
  }

  async function onSubmit(data: JobFormValues) {
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          requirements: data.requirements || [],
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      queryClient.invalidateQueries({ queryKey: ['/api/jobs', { filter: 'posted' }] });
      setIsDialogOpen(false);
      form.reset();

      toast({
        title: "Success",
        description: "Job posted successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to post job",
      });
    }
  }

  async function handleDeleteJob(jobId: number) {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      queryClient.invalidateQueries({ queryKey: ['/api/jobs', { filter: 'posted' }] });
      toast({
        title: "Success",
        description: "Job deleted successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete job",
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">My Job Postings</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Post New Job
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90%] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Post a New Job</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
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
                  control={form.control}
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

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="salaryMin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Salary</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="salaryMax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Salary</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="isRemote"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Remote Position</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full">
                  Post Job
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {jobs.length > 0 ? (
        <div className="grid gap-6">
          {jobs.map((job: any) => (
            <JobCard
              key={job.id}
              job={job}
              // onDelete={() => handleDeleteJob(job.id)}
              showDelete
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No job postings yet. Click the button above to create your first job posting.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}