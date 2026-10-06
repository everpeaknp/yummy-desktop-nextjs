"use client";

import { useState } from "react";
import { Mail, MessageSquare, Copy, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ShareCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  restaurantName: string;
}

export function ShareCodeDialog({
  open,
  onOpenChange,
  code,
  restaurantName,
}: ShareCodeDialogProps) {
  const [copied, setCopied] = useState(false);

  const message = `Hi! Join ${restaurantName} on Yummy using my promo code ${code} and we both get 1 month free! 🎉`;

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const handleEmail = () => {
    const subject = encodeURIComponent("Join Yummy and get 1 month free!");
    const body = encodeURIComponent(message);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Your Promo Code</DialogTitle>
          <DialogDescription>
            Send this message to invite other restaurants
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Message</label>
            <Textarea
              value={message}
              readOnly
              className="min-h-[100px] resize-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              onClick={handleWhatsApp}
              className="flex-col h-auto py-3"
            >
              <MessageSquare className="mb-1 h-5 w-5 text-green-600" />
              <span className="text-xs">WhatsApp</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleEmail}
              className="flex-col h-auto py-3"
            >
              <Mail className="mb-1 h-5 w-5 text-blue-600" />
              <span className="text-xs">Email</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyMessage}
              className="flex-col h-auto py-3"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="mb-1 h-5 w-5 text-primary" />
                  <span className="text-xs">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="mb-1 h-5 w-5" />
                  <span className="text-xs">Copy</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
