import { AlertTriangle } from "lucide-react";

type MappingExceptionBannerProps = {
  missingCount?: number;
  suspenseAmount?: number;
  message?: string;
};

export function MappingExceptionBanner({
  missingCount = 0,
  suspenseAmount = 0,
  message,
}: MappingExceptionBannerProps) {
  if (missingCount <= 0 && !message) {
    return null;
  }

  return (
    <div className="flex items-start gap-3 border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1">
        <div className="font-semibold">Mapping exceptions need review</div>
        {message ? (
          <div>{message}</div>
        ) : (
          <div>
            {missingCount} mapping gaps are posting through suspense. Suspense amount: Rs.{" "}
            {Number(suspenseAmount || 0).toLocaleString()}.
          </div>
        )}
      </div>
    </div>
  );
}
