"use client";

import { useState, useEffect } from "react";
import { X, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function PromoBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      // Show static text for 5 seconds then hide
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      // Wait for 2 iterations of animation (each takes ~10s) then hide
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 20000); // 2 iterations
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
  };

  const handleClick = () => {
    router.push("/premium");
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 dark:border-orange-800/30",
        "transition-all duration-500",
        !isVisible && "opacity-0 h-0"
      )}
      style={{ height: isVisible ? "36px" : "0px" }}
    >
      <div
        className="flex h-full cursor-pointer items-center gap-3 px-4"
        onClick={handleClick}
      >
        {/* Promotion Tag */}
        <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-orange-500 px-2 py-0.5">
          <Tag className="h-3 w-3 text-white" />
          <span className="text-xs font-semibold text-white">Promotion</span>
        </div>

        {/* Scrolling Text Container */}
        <div className="relative flex-1 overflow-hidden">
          <div
            className={cn(
              "whitespace-nowrap text-xs font-medium text-orange-700 dark:text-orange-300",
              isAnimating && "animate-marquee"
            )}
          >
            Share your promo code with other restaurants and both restaurants get 1 month free!
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="shrink-0 rounded-md p-1 text-orange-600 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-900/30 transition-colors"
          aria-label="Close promotion banner"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Add CSS animation */}
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }

        .animate-marquee {
          animation: marquee 10s linear 2;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-marquee {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
