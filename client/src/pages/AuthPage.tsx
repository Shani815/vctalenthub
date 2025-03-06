import { useState } from "react";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import bbLogo from '@/assets/bluebox.jpeg';

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["student", "venture_capitalist", "startup"] as const),
  referralCode: z.string().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const { login, register } = useUser();
  const { toast } = useToast();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      role: "student",
      referralCode: "",
    },
  });

  async function onLogin(values: LoginFormData) {
    try {
      await login(values);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error instanceof Error ? error.message : "An error occurred",
      });
    }
  }

  async function onRegister(values: RegisterFormData) {
    try {
    const res = await register(values);
    if (res.ok) {
      registerForm.reset();
      setIsLogin(true);
    }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: error instanceof Error ? error.message : "An error occurred",
      });
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/50 p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <img src={bbLogo} alt="BB Logo" className="mx-auto h-12 w-12" />
          <h1 className="mt-4 text-4xl font-bold">BlueBox</h1>
          <p className="mt-2 text-muted-foreground">
            The Invite-Only Network Connecting Top MBA Talent with Leading Startups & VCs
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isLogin ? "Sign In" : "Apply for a BlueBox Account"}</CardTitle>
            <CardDescription>
              {isLogin
                ? "Enter your credentials to access your account"
                : "Join the exclusive community of top MBA talent, alumni, founders & VCs."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLogin ? (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    {...loginForm.register("username")}
                  />
                  {loginForm.formState.errors.username && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.username.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    {...loginForm.register("password")}
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting}>
                  {loginForm.formState.isSubmitting ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-username">Username</Label>
                  <Input
                    id="reg-username"
                    {...registerForm.register("username")}
                  />
                  {registerForm.formState.errors.username && (
                    <p className="text-sm text-destructive">
                      {registerForm.formState.errors.username.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    {...registerForm.register("email")}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    {...registerForm.register("password")}
                  />
                  {registerForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {registerForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>I am a...</Label>
                  <RadioGroup
                    defaultValue="student"
                    onValueChange={(value) => registerForm.setValue("role", value as "student" | "venture_capitalist" | "startup")}
                    value={registerForm.watch("role")}
                    className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="student" id="student" />
                      <Label htmlFor="student">MBA Student</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="venture_capitalist" id="venture_capitalist" />
                      <Label htmlFor="venture_capitalist">Venture Capitalist</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="startup" id="startup" />
                      <Label htmlFor="startup">Startup</Label>
                    </div>
                  </RadioGroup>
                  {registerForm.formState.errors.role && (
                    <p className="text-sm text-destructive">
                      {registerForm.formState.errors.role.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-referral">Referral Code (Optional)</Label>
                  <Input
                    id="reg-referral"
                    {...registerForm.register("referralCode")}
                  />
                  {registerForm.formState.errors.referralCode && (
                    <p className="text-sm text-destructive">
                      {registerForm.formState.errors.referralCode.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={registerForm.formState.isSubmitting}>
                  {registerForm.formState.isSubmitting ? "Applying..." : "Apply for a BlueBox Account"}
                </Button>
              </form>
            )}
            <div className="mt-4 text-center">
              <Button
                variant="link"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground"
              >
                {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}