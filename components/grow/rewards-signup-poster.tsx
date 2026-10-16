"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type RewardsSignupPosterProps = {
  restaurantName: string;
  restaurantId: string | number;
  signupQr: string;
};

function fileStem(name: string, restaurantId: string | number) {
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `yummy-rewards-${safeName || restaurantId}`;
}

export function RewardsSignupPoster({ restaurantName, restaurantId, signupQr }: RewardsSignupPosterProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const download = async (format: "png" | "pdf") => {
    if (!posterRef.current || exporting) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(posterRef.current, { scale: 3, backgroundColor: "#fffaf5", useCORS: true });
      const stem = fileStem(restaurantName, restaurantId);
      if (format === "png") {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `${stem}.png`;
        link.click();
      } else {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 148, 210);
        pdf.save(`${stem}.pdf`);
      }
      toast.success(`Rewards sign downloaded as ${format.toUpperCase()}`);
    } catch {
      toast.error("The rewards sign could not be downloaded. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} disabled={!signupQr}>
        <Printer aria-hidden="true" className="mr-2 h-4 w-4" /> Preview signup sign
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] max-w-xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle>Print your rewards sign</DialogTitle>
            <DialogDescription>Display this at your counter or on a table. This QR joins your rewards list; it does not place an order.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center rounded-xl bg-muted/50 p-3 sm:p-5">
            <div ref={posterRef} className="relative flex aspect-[148/210] w-full max-w-[20rem] flex-col items-center overflow-hidden rounded-2xl border border-[#e8e4df] bg-white px-6 py-6 text-center text-[#171717]">
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-[#f4511e]" />
              <div className="w-full">
                <div className="flex shrink-0 items-center justify-center gap-2">
                  <img src="/logos/yummy_logo.png" alt="" className="h-7 w-7 object-contain" />
                  <span className="text-sm font-extrabold tracking-tight">Yummy <span className="font-semibold text-[#e84b1b]">Rewards</span></span>
                </div>
                <h2 className="mt-5 break-words text-[1.75rem] font-bold leading-tight tracking-tight">{restaurantName}</h2>
                <p className="mt-2 text-sm leading-5 text-[#565656]">Get rewarded at your favorite restaurant.</p>
              </div>
              <div className="my-3 grid min-h-0 flex-1 place-items-center">
                <div className="rounded-2xl border border-[#e8e4df] bg-white p-2 shadow-sm">
                  {/* QR is deliberately linked to reward enrollment, not a table order. */}
                  <img src={signupQr} alt="QR code to join this restaurant's Yummy Rewards list" className="block h-auto w-[min(10.5rem,55vw)] object-contain" />
                </div>
              </div>
              <div className="w-full shrink-0 border-t border-[#e8e4df] pt-3">
                <p className="text-base font-bold">Scan to join</p>
                <p className="mt-1 text-xs leading-4 text-[#686868]">Offers are optional.</p>
              </div>
              <p className="mt-2 shrink-0 text-[9px] text-[#777]">Powered by Yummy</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => void download("png")} disabled={exporting}>
              {exporting ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : <Download aria-hidden="true" className="mr-2 h-4 w-4" />}
              Download PNG
            </Button>
            <Button type="button" onClick={() => void download("pdf")} disabled={exporting}>
              {exporting ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : <Download aria-hidden="true" className="mr-2 h-4 w-4" />}
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
