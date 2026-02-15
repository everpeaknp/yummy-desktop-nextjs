"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function FinanceRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.push("/finance/income");
    }, [router]);

    return (
        <div className="h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
}
