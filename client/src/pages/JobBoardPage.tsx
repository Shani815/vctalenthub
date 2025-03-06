import { Card, CardContent } from "@/components/ui/card";
import { Loader2, SearchIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCallback, useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { JobCard } from "@/components/JobCard";
import { Label } from "@/components/ui/label";
import { PaywallModal } from "@/components/PaywallModal";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";

// Type definitions
type Company = {
  name: string;
  profile: Profile;
};

type Job = {
  id: number;
  userId: number;
  title: string;
  description: string;
  location: string;
  type: 'full_time' | 'part_time' | 'internship' | 'contract';
  internshipType: 'paid' | 'unpaid' | 'not_applicable';
  salaryMin: number | null;
  salaryMax: number | null;
  isRemote: boolean;
  requirements: string[] | null;
  createdAt: string | null;
  updatedAt: string | null;
  company: Company;
};

type Application = {
  id: number;
  jobId: number;
  userId: number;
  status: string;
  createdAt: string;
};

type Profile = {
  id: number;
  userId: number;
  name: string;
  bio: string | null;
  skills: string[];
  location: string | null;
  university: string | null;
  graduationYear: string | null;
  company: string | null;
  companySize: string | null;
  industry: string | null;
};

export default function JobBoardPage() {
  const { user } = useUser();
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [uiFilters, setUIFilters] = useState({
    type: "all",
    internshipType: "all",
    salaryRange: [0, 200000],
    isRemote: false,
    search: "",
  });

  // Separate state for debounced API filters
  const [apiFilters, setAPIFilters] = useState(uiFilters);

  // Debounce API filter updates
  useEffect(() => {
    const timer = setTimeout(() => {
      setAPIFilters(uiFilters);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [uiFilters]);

  const { data: jobs, isLoading: isLoadingJobs } = useQuery<Job[]>({
    queryKey: ['/api/jobs', apiFilters], // Use apiFilters instead of uiFilters
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      if (apiFilters.type !== "all") {
        searchParams.append('type', apiFilters.type);
      }

      if (apiFilters.internshipType !== "all") {
        searchParams.append('internshipType', apiFilters.internshipType);
      }

      searchParams.append('salaryMin', apiFilters.salaryRange[0].toString());
      searchParams.append('salaryMax', apiFilters.salaryRange[1].toString());
      searchParams.append('isRemote', apiFilters.isRemote.toString());

      if (apiFilters.search) {
        searchParams.append('search', apiFilters.search);
      }

      const response = await fetch(`/api/jobs?${searchParams.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }

      return response.json();
    },
  });

  const { data: applications, isLoading: isLoadingApplications } = useQuery<Application[]>({
    queryKey: ['/api/applications'],
    queryFn: async () => {
      const response = await fetch('/api/applications', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch applications');
      return response.json();
    },
    enabled: user?.role === 'student'
  });

  // Filter applied jobs
  const appliedJobs = jobs?.filter(job => 
    applications?.some(app => app.jobId === job.id)
  );

  // Update handlers
  const handleFilterChange = useCallback((key: string, value: any) => {
    setUIFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const shouldBlurJob = (index: number) => {
    return user?.role === 'student' && user?.tier === 'free' && index >= 10;
  };

  const getVisibleJobs = () => {
    if (!jobs) return [];
    if (user?.role !== 'student' || user?.tier !== 'free') return jobs;
    
    // Show all jobs up to index 12 (10 clear + 2 blurred)
    return jobs.slice(0, 12);
  };

  if (isLoadingJobs || isLoadingApplications) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PaywallModal 
        isOpen={showPaywallModal} 
        onClose={() => setShowPaywallModal(false)}
        feature="jobListings"
      />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Jobs</h1>
          <p className="text-muted-foreground mt-2">
            Find the perfect opportunity that matches your career goals
          </p>
        </div>

        {user?.role === 'student' ? (
          <Tabs defaultValue="jobBoard" className="space-y-6">
            <TabsList>
              <TabsTrigger value="jobBoard">Job Board</TabsTrigger>
              <TabsTrigger value="appliedTo">Applied To</TabsTrigger>
            </TabsList>

            <TabsContent value="jobBoard">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Job Type</Label>
                      <Select
                        value={uiFilters.type}
                        onValueChange={(value) => handleFilterChange('type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="full_time">Full Time</SelectItem>
                          <SelectItem value="part_time">Part Time</SelectItem>
                          <SelectItem value="internship">Internship</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Internship Type</Label>
                      <Select
                        value={uiFilters.internshipType}
                        onValueChange={(value) => handleFilterChange('internshipType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Salary Range</Label>
                      <Slider
                        min={0}
                        max={200000}
                        step={10000}
                        value={uiFilters.salaryRange}
                        onValueChange={(value) => handleFilterChange('salaryRange', value)}
                        className="py-4"
                      />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>${uiFilters.salaryRange[0].toLocaleString()}</span>
                        <span>${uiFilters.salaryRange[1].toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="remote"
                          checked={uiFilters.isRemote}
                          onCheckedChange={(checked) => handleFilterChange('isRemote', checked)}
                        />
                        <Label htmlFor="remote">Remote Only</Label>
                      </div>

                      <div className="relative">
                        <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search jobs..."
                          value={uiFilters.search}
                          onChange={(e) => handleFilterChange('search', e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4 mt-6">
                <div className="space-y-4">
                  {getVisibleJobs().map((job, index) => (
                    <div key={job.id} className="relative">
                      {shouldBlurJob(index) && (
                        <div 
                          className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 cursor-pointer"
                          onClick={() => setShowPaywallModal(true)}
                        >
                          {index === 10 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="bg-background/80 backdrop-blur-lg p-10 rounded-lg shadow-lg">
                                <p className="text-center">
                                  <span className="font-semibold">Upgrade to Premium</span>
                                  <br />
                                  to view all jobs
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <JobCard 
                        job={job}
                        showApply={!applications?.some(app => app.jobId === job.id)}
                        applicationStatus={applications?.find(app => app.jobId === job.id)?.status}
                      />
                    </div>
                  ))}
                  {jobs?.length === 0 && (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No jobs found matching your criteria.
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="appliedTo">
              <div className="space-y-4">
                {appliedJobs?.map((job) => (
                  <JobCard 
                    key={job.id} 
                    job={job}
                    showApply={false}
                    applicationStatus={applications?.find(app => app.jobId === job.id)?.status}
                  />
                ))}
                {(!appliedJobs || appliedJobs.length === 0) && (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      You haven't applied to any jobs yet.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Job Type</Label>
                    <Select
                      value={uiFilters.type}
                      onValueChange={(value) => handleFilterChange('type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="full_time">Full Time</SelectItem>
                        <SelectItem value="part_time">Part Time</SelectItem>
                        <SelectItem value="internship">Internship</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Internship Type</Label>
                    <Select
                      value={uiFilters.internshipType}
                      onValueChange={(value) => handleFilterChange('internshipType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Salary Range</Label>
                    <Slider
                      min={0}
                      max={200000}
                      step={10000}
                      value={uiFilters.salaryRange}
                      onValueChange={(value) => handleFilterChange('salaryRange', value)}
                      className="py-4"
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>${uiFilters.salaryRange[0].toLocaleString()}</span>
                      <span>${uiFilters.salaryRange[1].toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="remote"
                        checked={uiFilters.isRemote}
                        onCheckedChange={(checked) => handleFilterChange('isRemote', checked)}
                      />
                      <Label htmlFor="remote">Remote Only</Label>
                    </div>

                    <div className="relative">
                      <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search jobs..."
                        value={uiFilters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {jobs?.map((job) => (
                <JobCard 
                  key={job.id} 
                  job={job}
                  showApply={false} 
                />
              ))}
              {jobs?.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No jobs found matching your criteria.
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}