import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

// import { useToast } from "@/components/ui/use-toast";

interface PlanDetails {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
}

interface Subscription {
  id: string;
  status: string;
  priceId: string;
  currentPeriodEnd: string;
}

export default function PricingPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [search] = useSearch();
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [isYearly, setIsYearly] = useState(false);

  // Get URL parameters
  const params = new URLSearchParams(search);
  const sessionId = params.get("session_id");

  // Fetch subscription status
  const { data: subscription, refetch: refetchSubscription } =
    useQuery<Subscription>({
      queryKey: ["subscription-status"],
      queryFn: async () => {
        const response = await fetch("/api/stripe/subscription-status");
        if (!response.ok)
          throw new Error("Failed to fetch subscription status");
        return response.json();
      },
      enabled: !!user,
    });

  // Fetch available plans
  const { data: plans } = useQuery<Record<string, PlanDetails>>({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const response = await fetch("/api/stripe/plans");
      if (!response.ok) throw new Error("Failed to fetch plans");
      return response.json();
    },
  });

  // Handle successful subscription
  useEffect(() => {
    if (sessionId) {
      setShowSuccessDialog(true);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      refetchSubscription();
    }
  }, [sessionId, refetchSubscription]);

  // Get the current active plans based on billing period
  const activePlans = isYearly
    ? [plans?.STUDENT_YEARLY_PREMIUM, plans?.BUSINESS_YEARLY_PREMIUM].filter(
        Boolean
      )[0]
    : [plans?.STUDENT_MONTHLY_PREMIUM, plans?.BUSINESS_MONTHLY_PREMIUM].filter(
        Boolean
      )[0];

  const handleSubscribe = async () => {
    if (!user) {
      return setLocation("/login");
    }

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: activePlans.id }),
      });

      if (!response.ok) throw new Error("Failed to create checkout session");
      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error("Subscription error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start subscription process",
      });
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to create portal session");
      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error("Portal session error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to open subscription management",
      });
    }
  };

  if (!plans || !activePlans) return null;

  const monthlyPrice = [
    plans?.STUDENT_MONTHLY_PREMIUM?.price,
    plans?.BUSINESS_MONTHLY_PREMIUM?.price,
  ].filter(Boolean)[0];
  const yearlyPrice = [
    plans?.STUDENT_YEARLY_PREMIUM?.price,
    plans?.BUSINESS_YEARLY_PREMIUM?.price,
  ].filter(Boolean)[0];
  const savings =
    monthlyPrice && yearlyPrice ? monthlyPrice * 12 - yearlyPrice : 0;

  return (
    <div className="container py-16 px-4 mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
        <p className="text-muted-foreground text-lg mb-8">
          Choose the perfect plan for your needs
        </p>

        {/* Current Subscription Status */}
        {subscription && (
          <div className="mb-8 max-w-screen-sm mx-auto">
            <div className="p-4 bg-muted/50 backdrop-blur-sm rounded-lg border border-border/50">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-left">
                  <h3 className="font-semibold">Current Subscription</h3>
                  <p className="text-sm text-muted-foreground">
                    Status: {subscription.status}
                    {subscription.currentPeriodEnd && (
                      <>
                        {" "}
                        · Renews:{" "}
                        {new Date(
                          subscription.currentPeriodEnd
                        ).toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>
                <Button variant="outline" onClick={handleManageSubscription}>
                  Manage Subscription
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <span
            className={!isYearly ? "font-semibold" : "text-muted-foreground"}
          >
            Monthly
          </span>
          <Switch
            checked={isYearly}
            onCheckedChange={setIsYearly}
            className="data-[state=checked]:bg-primary"
          />
          <span
            className={isYearly ? "font-semibold" : "text-muted-foreground"}
          >
            Yearly
            <Badge variant="secondary" className="ml-2">
              Save ${savings}
            </Badge>
          </span>
        </div>

        {/* Pricing Card */}
        <Card
          className={cn(
            "relative overflow-hidden transition-all duration-300 max-w-screen-sm mx-auto",
            "hover:shadow-xl hover:-translate-y-1",
            "bg-gradient-to-br from-background/50 to-muted/30",
            "backdrop-blur-xl border-border/50",
            subscription?.priceId === activePlans.id && "border-primary"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10" />
          <div className="relative p-8">
            <Sparkles className="h-12 w-12 text-primary mb-6" />

            {/* Plan Badge */}
            {subscription?.priceId === activePlans.id && (
              <Badge
                variant="outline"
                className="absolute top-4 right-4 border-primary text-primary"
              >
                Current Plan
              </Badge>
            )}

            <h2 className="text-3xl font-bold mb-2">{activePlans.name}</h2>
            <p className="text-muted-foreground mb-6">
              {activePlans.description}
            </p>

            <div className="mb-8">
              <span className="text-5xl font-bold">${activePlans.price}</span>
              <span className="text-xl text-muted-foreground">
                /{isYearly ? "year" : "month"}
              </span>
              {isYearly && (
                <p className="text-sm text-primary mt-2">
                  Save ${savings} annually
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8 ">
              {activePlans.features.map((feature, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={
                subscription
                  ? handleManageSubscription
                  : user
                  ? handleSubscribe
                  : () => setLocation("/login")
              }
              variant={
                subscription?.priceId === activePlans.id ? "outline" : "default"
              }
            >
              {!user
                ? "Sign in to Subscribe"
                : subscription
                ? subscription.priceId === activePlans.id
                  ? "Manage Subscription"
                  : "Switch to this Plan"
                : "Subscribe Now"}
            </Button>

            {subscription && subscription.priceId !== activePlans.id && (
              <p className="text-sm text-muted-foreground mt-4">
                Switching plans will be prorated to your current billing period
              </p>
            )}
          </div>
        </Card>

        <p className="text-sm text-muted-foreground mt-8">
          All plans include a 14-day money-back guarantee
        </p>
      </div>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">
              🎉 Welcome to Premium!
            </DialogTitle>
            <DialogDescription className="text-center">
              <p className="text-lg text-green-600 dark:text-green-400 mt-2">
                Thank you for your subscription!
              </p>
              <p className="mt-2">
                You now have access to all premium features. Enjoy the full
                experience!
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
