"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Copy,
  Download,
  Loader2,
  MoreVertical,
  Printer,
  QrCode,
  RotateCw,
  Share2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { useRestaurant } from "@/hooks/use-restaurant";
import apiClient from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { RestaurantJoinApis } from "@/lib/api/endpoints";
import { cn, getImageUrl } from "@/lib/utils";

type JoinCodeLoadState = "loading" | "loaded" | "error";

function safeFileName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "restaurant"
  );
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] || character,
  );
}

export function StaffJoinCodePanel({
  canManage,
  compactMobile = false,
}: {
  canManage: boolean;
  compactMobile?: boolean;
}) {
  const restaurant = useRestaurant((state) => state.restaurant);
  const [loadState, setLoadState] = useState<JoinCodeLoadState>("loading");
  const [joinCode, setJoinCode] = useState("");
  const [joinLink, setJoinLink] = useState("");
  const [qr, setQr] = useState("");
  const [rotating, setRotating] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const displayJoinCode = useCallback(
    async (code: string, backendPayload?: string) => {
      if (!code) {
        setJoinCode("");
        setJoinLink("");
        setQr("");
        return;
      }
      const localHost = ["localhost", "127.0.0.1", "::1"].includes(
        window.location.hostname,
      );
      const universalLink = localHost
        ? `${window.location.origin}/join?code=${encodeURIComponent(code)}`
        : backendPayload ||
          `${window.location.origin}/join?code=${encodeURIComponent(code)}`;
      setJoinCode(code);
      setJoinLink(universalLink);
      setQr(
        await QRCode.toDataURL(universalLink, {
          width: 640,
          margin: 2,
          color: { dark: "#111827", light: "#ffffff" },
          errorCorrectionLevel: "H",
        }),
      );
    },
    [],
  );

  const loadJoinCode = useCallback(async () => {
    if (!canManage) return;
    setLoadState("loading");
    try {
      const response = await apiClient.get(RestaurantJoinApis.currentCode);
      const code = String(response.data?.data?.code || "");
      await displayJoinCode(
        code,
        String(response.data?.data?.qr_payload || ""),
      );
      setLoadState("loaded");
    } catch (error) {
      const response = (
        error as {
          response?: {
            status?: number;
            data?: { message?: unknown; detail?: unknown };
          };
        }
      )?.response;
      const message = String(
        response?.data?.message ?? response?.data?.detail ?? "",
      );
      if (
        response?.status === 404 &&
        message.toLowerCase().includes("join code has not been generated")
      ) {
        setJoinCode("");
        setJoinLink("");
        setQr("");
        setLoadState("loaded");
        return;
      }
      console.warn("Failed to load the staff join code", error);
      setLoadState("error");
    }
  }, [canManage, displayJoinCode]);

  useEffect(() => {
    void loadJoinCode();
  }, [loadJoinCode]);

  const rotate = async () => {
    if (!canManage || rotating) return;
    if (
      joinCode &&
      !window.confirm(
        "Rotate the join code? Existing printed QR posters and copied links will stop working immediately.",
      )
    )
      return;
    setRotating(true);
    try {
      const response = await apiClient.post(RestaurantJoinApis.rotateCode);
      const code = String(response.data?.data?.code || "");
      await displayJoinCode(
        code,
        String(response.data?.data?.qr_payload || ""),
      );
      setLoadState("loaded");
      toast.success(joinCode ? "Join code rotated" : "Join QR created");
    } catch (error: unknown) {
      toast.error(
        getApiErrorMessage(error, "Unable to generate the join code"),
      );
    } finally {
      setRotating(false);
    }
  };

  const copyLink = async () => {
    if (!joinLink) return;
    await navigator.clipboard.writeText(joinLink);
    toast.success("Join link copied");
  };

  const shareLink = async () => {
    if (!joinLink) return;
    if (navigator.share) {
      await navigator.share({
        title: `Join ${restaurant?.name || "our restaurant"} on Yummy`,
        text: `Request access to ${restaurant?.name || "our restaurant"} using code ${joinCode}.`,
        url: joinLink,
      });
      return;
    }
    await copyLink();
  };

  const downloadQr = async () => {
    if (!qr) return;
    try {
      const loadImage = (source: string, crossOrigin = false) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = document.createElement("img");
          if (crossOrigin) image.crossOrigin = "anonymous";
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = source;
        });
      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 1200;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#fff7ed";
      context.fillRect(0, 0, canvas.width, 300);
      context.fillStyle = "#f97316";
      context.fillRect(0, 0, canvas.width, 18);

      const logoUrl = restaurant?.profile_picture
        ? getImageUrl(restaurant.profile_picture)
        : "";
      if (logoUrl) {
        try {
          const logo = await loadImage(logoUrl, true);
          const maxSize = 110;
          const scale = Math.min(
            maxSize / logo.naturalWidth,
            maxSize / logo.naturalHeight,
          );
          const width = logo.naturalWidth * scale;
          const height = logo.naturalHeight * scale;
          context.drawImage(
            logo,
            (canvas.width - width) / 2,
            52 + (maxSize - height) / 2,
            width,
            height,
          );
        } catch {
          // The restaurant name still brands the poster if the image blocks canvas use.
        }
      }

      context.textAlign = "center";
      context.fillStyle = "#111827";
      context.font = "700 44px Arial";
      context.fillText(
        restaurant?.name || "Restaurant",
        canvas.width / 2,
        220,
        760,
      );
      context.fillStyle = "#6b7280";
      context.font = "24px Arial";
      context.fillText(
        "Scan with your phone camera to request access",
        canvas.width / 2,
        268,
      );

      const qrImage = await loadImage(qr);
      context.fillStyle = "#ffffff";
      context.fillRect(135, 325, 630, 630);
      context.drawImage(qrImage, 170, 360, 560, 560);
      context.fillStyle = "#111827";
      context.font = "800 52px monospace";
      context.fillText(joinCode, canvas.width / 2, 1010);
      context.fillStyle = "#4b5563";
      context.font = "22px Arial";
      context.fillText(
        "Every request needs manager approval and a role assignment.",
        canvas.width / 2,
        1070,
      );
      context.fillStyle = "#9ca3af";
      context.font = "18px Arial";
      context.fillText(
        joinLink.length > 82 ? `${joinLink.slice(0, 79)}...` : joinLink,
        canvas.width / 2,
        1125,
        780,
      );

      const anchor = document.createElement("a");
      anchor.href = canvas.toDataURL("image/png");
      anchor.download = `${safeFileName(restaurant?.name || "restaurant")}-join-poster.png`;
      anchor.click();
    } catch {
      toast.error("Unable to create the branded QR poster");
    }
  };

  const printQr = () => {
    if (!qr) return;
    const popup = window.open("", "_blank", "width=720,height=900");
    if (!popup) return toast.error("Allow popups to print the QR poster");
    const name = escapeHtml(restaurant?.name || "Restaurant");
    const logo = restaurant?.profile_picture
      ? escapeHtml(restaurant.profile_picture)
      : "";
    popup.document.write(
      `<!doctype html><html><head><title>${name} join QR</title><style>body{font-family:Inter,Arial,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;color:#111827}.poster{text-align:center;border:1px solid #e5e7eb;border-radius:28px;padding:48px;width:480px}.logo{width:76px;height:76px;object-fit:contain;border-radius:18px;margin-bottom:18px}h1{font-size:30px;margin:0}p{color:#6b7280;font-size:16px}.qr{width:340px;height:340px}.code{font-family:monospace;font-size:34px;letter-spacing:8px;font-weight:800;margin:18px 0}.hint{font-size:13px}</style></head><body><main class="poster">${logo ? `<img class="logo" src="${logo}" alt="">` : ""}<h1>Join ${name}</h1><p>Scan with your phone camera, sign in, and request access.</p><img class="qr" src="${qr}" alt="Join QR"><div class="code">${escapeHtml(joinCode)}</div><p class="hint">A manager must approve every request and choose a role.</p></main><script>window.onload=()=>window.print()</script></body></html>`,
    );
    popup.document.close();
  };

  if (loadState === "loading") {
    return <LoadingState label="Loading join code…" />;
  }

  if (loadState === "error") {
    return (
      <ErrorState
        title="Join code could not be loaded"
        description="Check the connection and try again."
        actionLabel="Retry"
        onAction={() => void loadJoinCode()}
      />
    );
  }

  const qrActions = (
    <>
      <Button type="button" variant="outline" onClick={() => void copyLink()}>
        <Copy className="mr-2 h-4 w-4" />
        Copy
      </Button>
      <Button type="button" variant="outline" onClick={() => void shareLink()}>
        <Share2 className="mr-2 h-4 w-4" />
        Share
      </Button>
      <Button type="button" variant="outline" onClick={() => void downloadQr()}>
        <Download className="mr-2 h-4 w-4" />
        Save
      </Button>
      <Button type="button" variant="outline" onClick={printQr}>
        <Printer className="mr-2 h-4 w-4" />
        Print
      </Button>
    </>
  );

  const renderJoinCodeMenu = (includeUtilities = false) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-xl"
          aria-label="Join code actions"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {includeUtilities ? (
          <DropdownMenuItem
            className="min-h-11"
            onClick={() => void shareLink()}
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          className={cn(includeUtilities && "min-h-11")}
          disabled={rotating}
          onClick={() => void rotate()}
        >
          {rotating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCw className="mr-2 h-4 w-4" />
          )}
          Rotate code
        </DropdownMenuItem>
        {includeUtilities ? (
          <>
            <DropdownMenuItem
              className="min-h-11"
              onClick={() => void downloadQr()}
            >
              <Download className="mr-2 h-4 w-4" />
              Download QR
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11" onClick={printQr}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const joinCodeMenu = compactMobile ? (
    <>
      <div className="lg:hidden">{renderJoinCodeMenu(true)}</div>
      <div className="hidden lg:block">{renderJoinCodeMenu()}</div>
    </>
  ) : (
    renderJoinCodeMenu()
  );

  return (
    <section
      aria-label="Join code"
      className={cn(
        "overflow-hidden",
        compactMobile
          ? "border-b border-border py-3 lg:rounded-2xl lg:border lg:bg-card lg:py-0"
          : "rounded-2xl border border-border bg-card",
      )}
    >
      <div className={cn("lg:hidden", !compactMobile && "p-4")}>
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground",
              compactMobile && "hidden",
            )}
          >
            <QrCode className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">Join code</h3>
            <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
              {compactMobile
                ? "Staff scan this code to request access."
                : "Staff can scan this code to request access. Every request still needs approval."}
            </p>
          </div>
          {joinCode ? joinCodeMenu : null}
        </div>
        {joinCode ? (
          <>
            <p
              className={cn(
                "font-mono text-lg font-semibold tracking-[0.16em] text-foreground",
                compactMobile ? "mt-3" : "mt-4",
              )}
            >
              {joinCode}
            </p>
            <div
              className={cn(
                "grid grid-cols-2 gap-2",
                compactMobile ? "mt-3" : "mt-4",
              )}
            >
              <Button
                type="button"
                className={cn(compactMobile && "h-10")}
                onClick={() => setQrOpen(true)}
              >
                <QrCode className="mr-2 h-4 w-4" />
                View QR
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(compactMobile && "h-10")}
                onClick={() => void copyLink()}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
            {!compactMobile ? (
              <Button
                type="button"
                variant="ghost"
                className="mt-2 w-full"
                onClick={() => void shareLink()}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            ) : null}
          </>
        ) : (
          <Button
            type="button"
            className={cn("mt-4", compactMobile ? "w-auto" : "w-full")}
            disabled={rotating}
            onClick={() => void rotate()}
          >
            {rotating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <QrCode className="mr-2 h-4 w-4" />
            )}
            Generate join code
          </Button>
        )}
      </div>

      <div className="hidden grid-cols-[minmax(16rem,.8fr)_minmax(18rem,1fr)] lg:grid">
        <div className="flex flex-col justify-center border-r p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Join code</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Scanning opens a request-only join flow. A manager still assigns
                the role and approves access.
              </p>
            </div>
            {joinCode ? joinCodeMenu : null}
          </div>
          {joinCode ? (
            <>
              <p className="mt-5 font-mono text-2xl font-semibold tracking-[0.18em]">
                {joinCode}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">{qrActions}</div>
            </>
          ) : (
            <Button
              type="button"
              className="mt-5 w-fit"
              disabled={rotating}
              onClick={() => void rotate()}
            >
              {rotating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <QrCode className="mr-2 h-4 w-4" />
              )}
              Generate join code
            </Button>
          )}
        </div>
        <div className="flex min-h-72 items-center justify-center p-6">
          {qr ? (
            <div className="text-center">
              <div className="mx-auto w-fit rounded-xl border bg-white p-3">
                <Image
                  src={qr}
                  alt={`${restaurant?.name || "Restaurant"} join QR`}
                  width={240}
                  height={240}
                  unoptimized
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Scan to request access
              </p>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              Generate a join code to create the QR.
            </div>
          )}
        </div>
      </div>

      <Sheet open={qrOpen} onOpenChange={setQrOpen}>
        <SheetContent
          side="right"
          className="flex w-full max-w-none flex-col overflow-y-auto sm:max-w-lg"
        >
          <SheetHeader className="text-left">
            <SheetTitle>Join QR</SheetTitle>
            <SheetDescription>
              Scanning submits an access request; it never grants membership
              directly.
            </SheetDescription>
          </SheetHeader>
          {qr ? (
            <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
              <div className="rounded-2xl border bg-white p-3">
                <Image
                  src={qr}
                  alt={`${restaurant?.name || "Restaurant"} join QR`}
                  width={320}
                  height={320}
                  unoptimized
                />
              </div>
              <p className="mt-5 font-mono text-2xl font-semibold tracking-[0.18em]">
                {joinCode}
              </p>
              <div className="mt-6 grid w-full grid-cols-2 gap-2">
                {qrActions}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}
