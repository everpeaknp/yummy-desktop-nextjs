import { SupplierDetailWorkspace } from "@/components/manage/suppliers/supplier-detail-workspace";

export default async function SupplierDetailPage({ params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params;
  const id = Number(supplierId);
  if (!Number.isInteger(id) || id <= 0) return <div className="p-6">Supplier not found.</div>;
  return <SupplierDetailWorkspace supplierId={id} />;
}
