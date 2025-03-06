import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useLocation } from "wouter";

interface PaywallModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    feature: 
      | "jobApplications"
      | "connections"
      | "introRequests"
      | "jobListings"
      | "profileAccess"
      | "viewConnections";
}
  
const featureMessages = {
    jobApplications: {
      title: "Job Application Limit Reached",
      description: "Free accounts are limited to 2 job applications. Upgrade to premium for unlimited applications.",
    },
    connections: {
      title: "Weekly Connection Limit Reached",
      description: "Free accounts can send 4 connection requests per week. Your limit will reset next week.",
    },
    viewConnections: {
      title: "Premium Feature: View Connections",
      description: "Upgrade to premium to view complete connection lists and network insights.",
    },
    introRequests: {
      title: "Premium Feature: BlueBox Intros",
      description: "Upgrade to premium to request introductions with the professionals you need.",
    },
    jobListings: {
      title: "View All Job Listings",
      description: "Free accounts can view 10 jobs. Upgrade to see all available positions.",
    },
    profileAccess: {
      title: "Premium Feature: Full Profile Access",
      description: "Upgrade to view complete profiles and professional highlights.",
    },
};

export function PaywallModal({
    isOpen,
    onClose,
    title,
    description,
    feature,
}: PaywallModalProps) {
    const [, setLocation] = useLocation();
  
    const handleUpgrade = () => {
      onClose();
      setLocation("/pricing");
    };
  
    const featureMessage = featureMessages[feature];
  
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">
              {title || featureMessage.title}
            </DialogTitle>
            <DialogDescription className="text-center">
              {description || featureMessage.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Premium benefits:</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Unlimited job applications</li>
                <li>• Unlimited connection requests</li>
                <li>• Access to all job listings</li>
                <li>• Request intros with anyone</li>
                <li>• View complete profiles</li>
                <li>• Priority support</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <div className="flex w-full flex-col gap-2">
              <Button onClick={handleUpgrade} className="w-full">
                Upgrade Now
              </Button>
              <Button onClick={onClose} variant="outline" className="w-full">
                Maybe Later
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
} 