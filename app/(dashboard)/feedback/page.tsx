"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ImageIcon, X, Loader2, Send, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { FeedbackApis } from "@/lib/api/endpoints";
import apiClient from "@/lib/api-client";
import { MenuImageService } from "@/services/menu-image-service";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function FeedbackPage() {
  const { user } = useAuth();
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please provide a description.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let photoUrl = null;

      if (selectedFile) {
        // Reusing MenuImageService for now as it handles Supabase upload
        // In a real scenario, we might want a separate 'feedback' bucket
        photoUrl = await MenuImageService.uploadMenuImage(selectedFile, user?.restaurant_id || 0);
      }

      await apiClient.post(FeedbackApis.submit, {
        description: description.trim(),
        photo_url: photoUrl,
      });

      setIsSuccess(true);
      setDescription("");
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (err: any) {
      console.error("Feedback submission failed:", err);
      setError(err.response?.data?.detail || "Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full text-center p-8 animate-in fade-in zoom-in duration-300">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <CardTitle className="text-2xl mb-2">Thank You!</CardTitle>
          <CardDescription className="text-base mb-8">
            Your feedback has been submitted successfully. We value your input and will use it to improve Yummy.
          </CardDescription>
          <Button onClick={() => setIsSuccess(false)} className="w-full">
            Submit Another
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Submit Feedback</h1>
        <p className="text-muted-foreground">
          We value your feedback! Please describe the issue or suggestion you have.
        </p>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-semibold">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Tell us what's on your mind..."
                className="min-h-[150px] resize-none text-base focus-visible:ring-primary"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Attach Photo (Optional)</Label>
              <div className="flex flex-col gap-4">
                {previewUrl ? (
                  <div className="relative w-full aspect-video sm:aspect-[2/1] bg-muted rounded-xl border-2 border-dashed border-border overflow-hidden group">
                    <img
                      src={previewUrl}
                      alt="Feedback preview"
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-sm"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      id="photo"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Label
                      htmlFor="photo"
                      className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-all group"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="p-3 bg-primary/10 rounded-full mb-3 group-hover:scale-110 transition-transform">
                          <ImageIcon className="h-6 w-6 text-primary" />
                        </div>
                        <p className="mb-1 text-sm font-semibold">Click to upload photo</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, WebP (max. 5MB)</p>
                      </div>
                    </Label>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full font-bold text-base h-12"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  Submit Feedback
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <div className="mt-8 p-4 bg-muted/30 rounded-xl border border-border/40">
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" />
          What happens next?
        </h3>
        <p className="text-xs text-muted-foreground">
          Your feedback will be reviewed by our team. We use your input to prioritize new features and fix issues to provide the best experience for your restaurant.
        </p>
      </div>
    </div>
  );
}
