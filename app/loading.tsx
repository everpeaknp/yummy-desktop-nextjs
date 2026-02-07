import Image from "next/image";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex h-screen w-full items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="relative flex items-center justify-center">
        {/* Spinner Ring */}
        <div className="absolute h-32 w-32 animate-spin rounded-full border-4 border-primary/30 border-t-primary shadow-[0_0_15px_rgba(249,115,22,0.3)]"></div>

        {/* Inner Static Circle */}
        <div className="relative h-28 w-28 overflow-hidden rounded-full bg-card p-5 shadow-lg flex items-center justify-center border border-border">
          <Image
            src="/refresh_icon.png"
            alt="Loading..."
            className="object-contain animate-pulse duration-[2000ms]"
            width={64}
            height={64}
            priority
          />
        </div>
      </div>
    </div>
  );
}
