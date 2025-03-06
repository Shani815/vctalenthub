import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderOpen, Users, ClipboardList } from "lucide-react";
import { ApplicationsDashboard } from "@/components/ApplicationsDashboard";
import { MyJobs } from "@/components/MyJobs";
import { TalentBrowser } from "@/components/TalentBrowser";
import { useUser } from "@/hooks/use-user";

export default function HirePage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState("my-jobs");

  // Allow both VC and startup roles to access this page
  const hasAccess = user?.role === 'venture_capitalist' || user?.role === 'startup';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, []);

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              You don't have permission to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-7xl px-4 sm:px-6 lg:px-8">
      <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="my-jobs" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            My Job Postings
          </TabsTrigger>
          <TabsTrigger value="applications" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Applications
          </TabsTrigger>
          <TabsTrigger value="browse" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Browse Talent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-jobs">
          <MyJobs />
        </TabsContent>

        <TabsContent value="applications">
          <ApplicationsDashboard />
        </TabsContent>

        <TabsContent value="browse">
          <TalentBrowser />
        </TabsContent>
      </Tabs>
    </div>
  );
}