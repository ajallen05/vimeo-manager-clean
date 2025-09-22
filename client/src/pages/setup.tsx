import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { vimeoCredentialsSetupSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Settings, Key, CheckCircle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { VimeoCredentialsSetup } from "@shared/schema";

interface SetupPageProps {
  onSetupComplete: () => void;
}

export default function Setup({ onSetupComplete }: SetupPageProps) {
  const { toast } = useToast();

  const form = useForm<VimeoCredentialsSetup>({
    resolver: zodResolver(vimeoCredentialsSetupSchema),
    defaultValues: {
      accessToken: "",
      clientId: "",
      clientSecret: "",
    },
  });

  const setupMutation = useMutation({
    mutationFn: async (data: VimeoCredentialsSetup) => {
      const response = await fetch("/api/credentials/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to setup credentials");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Setup Complete",
        description: "Vimeo credentials have been saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/credentials/check"] });
      onSetupComplete();
    },
    onError: (error) => {
      toast({
        title: "Setup Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: VimeoCredentialsSetup) => {
    setupMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <Settings className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Setup Vimeo Integration</CardTitle>
          <p className="text-muted-foreground text-sm">
            Enter your Vimeo API credentials to get started
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="accessToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Token</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your Vimeo access token"
                        {...field}
                        data-testid="input-access-token"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your Vimeo client ID"
                        {...field}
                        data-testid="input-client-id"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Secret</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your Vimeo client secret"
                        {...field}
                        data-testid="input-client-secret"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={setupMutation.isPending}
                data-testid="button-setup"
              >
                {setupMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Setup Credentials
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium mb-1">Get your credentials:</p>
                <p className="text-muted-foreground">
                  Visit{" "}
                  <a 
                    href="https://developer.vimeo.com/apps" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Vimeo Developer Console
                  </a>
                  {" "}to create an app and get your API credentials.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}