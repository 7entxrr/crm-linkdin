"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Bird, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signIn } from "@/lib/firebase/auth";
import { useAuth } from "@/context/auth-context";
import { loginSchema, type LoginFormValues } from "@/lib/validations/auth";
import { APP_NAME } from "@/lib/constants";

export default function LoginPage() {
  const router = useRouter();
  const { firebaseUser, loading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (!authLoading && firebaseUser) {
      router.replace("/dashboard");
    }
  }, [authLoading, firebaseUser, router]);

  const onSubmit = async (data: LoginFormValues) => {
    setSubmitting(true);
    try {
      await signIn(data.email, data.password);
      toast.success("Welcome back!");
      router.replace("/dashboard");
    } catch {
      toast.error("Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden app-mesh-bg px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <Card className="shimmer-border border-border/60 bg-white/80 shadow-2xl shadow-primary/10 backdrop-blur-xl">
          <CardHeader className="space-y-4 pb-2 text-center">
            <motion.div
              whileHover={{ scale: 1.05, rotate: -5 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-teal-600 text-primary-foreground shadow-lg shadow-primary/30"
            >
              <Bird className="h-8 w-8" />
            </motion.div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                {APP_NAME}
              </CardTitle>
              <CardDescription className="mt-2 flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Healthcare recruitment outreach automation
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@nightingale.com"
                  className="h-10"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="h-10"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>
              <Button type="submit" className="h-10 w-full" size="lg" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Admin and Recruiter accounts supported
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
