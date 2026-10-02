import { CustomerDetailWorkspace } from "@/components/customers/customer-detail-workspace";

export default function CustomerDetailPage({ params }: { params: { customerId: string } }) {
  return <CustomerDetailWorkspace customerId={Number(params.customerId)} />;
}
