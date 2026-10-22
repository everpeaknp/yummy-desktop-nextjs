"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Camera, Loader2, Store, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import apiClient from "@/lib/api-client";
import { RestaurantApis } from "@/lib/api/endpoints";
import { getImageUrl } from "@/lib/utils";
import { ImageService } from "@/services/image-service";

type BrandingField = "profile_picture" | "cover_photo";

type RestaurantBrandingEditorProps = {
  restaurantId: number;
  profilePicture?: string | null;
  coverPhoto?: string | null;
  onUpdated?: (field: BrandingField, value: string) => void | Promise<void>;
};

export function RestaurantBrandingEditor({
  restaurantId,
  profilePicture,
  coverPhoto,
  onUpdated,
}: RestaurantBrandingEditorProps) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "cover",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const setUploading = type === "logo" ? setUploadingLogo : setUploadingCover;
    const field: BrandingField =
      type === "logo" ? "profile_picture" : "cover_photo";
    setUploading(true);
    setUploadError(null);
    try {
      const publicUrl = await ImageService.uploadRestaurantImage(
        file,
        type,
        restaurantId,
      );
      const response = await apiClient.put(
        RestaurantApis.update(restaurantId),
        {
          [field]: publicUrl,
        },
      );
      if (response.data?.status !== "success") {
        throw new Error(response.data?.message || `Failed to save ${type}`);
      }
      await onUpdated?.(field, publicUrl);
      toast.success(`${type === "logo" ? "Logo" : "Cover image"} updated`);
    } catch (error) {
      console.error(`Failed to upload ${type}`, error);
      const message = `The ${type === "logo" ? "logo" : "cover image"} could not be updated.`;
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative mb-16 w-full rounded-2xl border border-border bg-muted/30 shadow-sm">
        <div className="relative h-48 overflow-hidden rounded-t-2xl bg-muted md:h-64">
          {uploadingCover ? (
            <div
              className="absolute inset-0 flex items-center justify-center"
              role="status"
              aria-label="Uploading cover image"
            >
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : coverPhoto ? (
            <Image
              src={getImageUrl(coverPhoto)}
              alt="Restaurant cover"
              fill
              sizes="(min-width: 1024px) 800px, 100vw"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <Camera className="mb-2 h-8 w-8" />
              <span className="text-xs">Add a landscape cover image</span>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2">
          <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-background shadow-md">
            {uploadingLogo ? (
              <div role="status" aria-label="Uploading restaurant logo">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : profilePicture ? (
              <Image
                src={getImageUrl(profilePicture)}
                alt="Restaurant logo"
                fill
                sizes="128px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex flex-col items-center text-muted-foreground">
                <Store className="mb-1 h-8 w-8" />
                <span className="text-[10px]">Add a square logo</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploadingCover}
          onClick={() => coverInputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploadingCover ? "Uploading cover" : "Change cover"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploadingLogo}
          onClick={() => logoInputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploadingLogo ? "Uploading logo" : "Change logo"}
        </Button>
      </div>

      {uploadError ? (
        <p className="text-center text-sm text-destructive" role="alert">
          {uploadError} Try another image.
        </p>
      ) : null}

      <Input
        ref={coverInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={(event) => upload(event, "cover")}
      />
      <Input
        ref={logoInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={(event) => upload(event, "logo")}
      />
    </div>
  );
}
