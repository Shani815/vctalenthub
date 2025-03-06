import { Calendar, GraduationCap, Loader2, MapPin, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { applicationStatusEnum } from "@/db/schema";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

type ApplicationStatus = typeof applicationStatusEnum.enumValues[number];

interface Job {
  id: number;
  title: string;
  type: string;
  location: string;
  userId: number;
}

interface UserProfile {
  name: string;
  university?: string | null;
  graduationYear?: string | null;
  location?: string | null;
  skills?: string[];
  bio?: string | null;
  linkedIn?: string | null;
  website?: string | null;
}

interface Application {
  id: number;
  jobId: number;
  userId: number;
  resumeUrl: string;
  coverLetter?: string | null;
  status: ApplicationStatus;
  createdAt: string;
  user: {
    profile: UserProfile;
  };
  job: Job;
}

const statusColors: Record<ApplicationStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  reviewed: "bg-blue-100 text-blue-800",
  interviewing: "bg-purple-100 text-purple-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export function ApplicationsDashboard() {
  const { toast } = useToast();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
  const [universityFilter, setUniversityFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [skillsFilter, setSkillsFilter] = useState("");

  // First fetch jobs posted by the current user
  const { data: jobs, isLoading: isLoadingJobs } = useQuery<Job[]>({
    queryKey: ['/api/jobs', { userId: user?.id }],
    queryFn: async () => {
      const response = await fetch('/api/jobs', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch jobs');
      const allJobs = await response.json();
      const userJobs = allJobs.filter((job: Job) => job.userId === user?.id);
      return userJobs;
    },
    enabled: !!user?.id
  });

  // Then fetch applications for those jobs
  const { data: applications, isLoading: isLoadingApplications, error: applicationsError } = useQuery<Application[]>({
    queryKey: ['/api/applications/hire', { jobIds: jobs?.map(j => j.id) }],
    queryFn: async () => {
      const jobIds = jobs?.map(j => j.id);

      if (!jobIds?.length) {
        return [];
      }

      try {
        const response = await fetch('/api/applications/hire', {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch applications: ${response.status}`);
        }

        const text = await response.text();

        // Check if response starts with HTML
        if (text.trim().startsWith('<!DOCTYPE')) {
          throw new Error('Received HTML response instead of JSON');
        }

        let allApplications;
        try {
          allApplications = text ? JSON.parse(text) : null;
          if (!Array.isArray(allApplications)) {
            throw new Error('Applications response is not an array');
          }
        } catch (e) {
          throw new Error('Invalid application data received');
        }

        if (!Array.isArray(allApplications)) {
          throw new Error('Invalid applications data format');
        }

        const filteredApplications = allApplications.filter((app: Application) => {
          return jobIds.includes(app.jobId);
        });

        return filteredApplications;
      } catch (error) {
        throw error;
      }
    },
    enabled: !!jobs && jobs.length > 0
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ applicationId, status }: { applicationId: number; status: ApplicationStatus }) => {
      const response = await fetch(`/api/applications/${applicationId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to update status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/applications/hire'] });
      toast({
        title: "Status Updated",
        description: "Application status has been successfully updated.",
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

  // Add interview request mutation
  const interviewRequestMutation = useMutation({
    mutationFn: async ({ candidateId, roleId }: { candidateId: number; roleId: number }) => {
      const res = await fetch("/api/candidates/interview-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ candidateId, roleId }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Interview Request Sent",
        description: "The candidate has been notified of your interview request.",
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

  // Filter applications based on selected criteria
  const filteredApplications = applications?.filter(application => {
    if (selectedJobId !== "all" && application.jobId !== selectedJobId) {
      return false;
    }

    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      application.user.profile.name.toLowerCase().includes(searchLower) ||
      application.user.profile.university?.toLowerCase().includes(searchLower) ||
      application.user.profile.location?.toLowerCase().includes(searchLower);

    const matchesStatus = statusFilter === "all" || application.status === statusFilter;

    const matchesUniversity = !universityFilter ||
      application.user.profile.university?.toLowerCase().includes(universityFilter.toLowerCase());

    const matchesLocation = !locationFilter ||
      application.user.profile.location?.toLowerCase().includes(locationFilter.toLowerCase());

    const matchesSkills = !skillsFilter || (
      application.user.profile.skills?.some(skill =>
        skill.toLowerCase().includes(skillsFilter.toLowerCase())
      )
    );

    return matchesSearch && matchesStatus && matchesUniversity && 
           matchesLocation && matchesSkills;
  });

  if (isLoadingJobs || isLoadingApplications) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show empty state if user has no jobs
  if (jobs && jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          You haven't posted any jobs yet. Post a job to start receiving applications.
        </CardContent>
      </Card>
    );
  }

  if (applicationsError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          An error occurred while loading applications. Please try again.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Application Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Select
                value={selectedJobId.toString()}
                onValueChange={(value) => setSelectedJobId(value === "all" ? "all" : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by job posting" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Job Postings</SelectItem>
                  {jobs?.map((job) => (
                    <SelectItem key={job.id} value={job.id.toString()}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as ApplicationStatus | "all")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.keys(statusColors).map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, university, or location"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter by university"
                  className="pl-9"
                  value={universityFilter}
                  onChange={(e) => setUniversityFilter(e.target.value)}
                />
              </div>

              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter by location"
                  className="pl-9"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                />
              </div>

              <Input
                placeholder="Filter by skills"
                value={skillsFilter}
                onChange={(e) => setSkillsFilter(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {filteredApplications?.map((application) => (
            <Card key={application.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{application.user.profile.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Applied for: {application.job.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Add Interview Request Button */}
                    <Button
                      variant="secondary"
                      onClick={() => 
                        interviewRequestMutation.mutate({
                          candidateId: application.userId,
                          roleId: application.jobId,
                        })
                      }
                      disabled={interviewRequestMutation.isPending}
                    >
                      {interviewRequestMutation.isPending ? "Sending..." : "Request Interview"}
                    </Button>

                    {/* Existing Status Select */}
                    <Select
                      value={application.status}
                      onValueChange={(value: ApplicationStatus) =>
                        updateStatusMutation.mutate({
                          applicationId: application.id,
                          status: value
                        })
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue>
                          <Badge className={statusColors[application.status]}>
                            {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(statusColors).map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {application.user.profile.university && (
                    <p className="text-sm">
                      <span className="font-medium">University:</span> {application.user.profile.university}
                      {application.user.profile.graduationYear && ` (${application.user.profile.graduationYear})`}
                    </p>
                  )}
                  {application.user.profile.location && (
                    <p className="text-sm">
                      <span className="font-medium">Location:</span> {application.user.profile.location}
                    </p>
                  )}
                  {application.user.profile.skills && application.user.profile.skills.length > 0 && (
                    <p className="text-sm">
                      <span className="font-medium">Skills:</span> {application.user.profile.skills.join(", ")}
                    </p>
                  )}
                  <p className="text-sm">
                    <span className="font-medium">Applied:</span> {format(new Date(application.createdAt), 'PPP')}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <a
                      href={application.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      View Resume
                    </a>
                    {application.coverLetter && (
                      <Button
                        variant="link"
                        className="text-sm p-0 h-auto"
                        onClick={() => {
                          toast({
                            title: "Application Message",
                            description: application.coverLetter,
                          });
                        }}
                      >
                        View Message
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {(applications?.length === 0 || filteredApplications?.length === 0) && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No applications found matching your filters.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}