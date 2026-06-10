import { JournalVoucherDetailClient } from "@/components/finance/accounting/journal-voucher-detail-client";

type PageProps = {
  params: {
    id: string;
  };
};

export default function JournalVoucherDetailPage({ params }: PageProps) {
  return <JournalVoucherDetailClient voucherId={Number(params.id)} />;
}
