import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication - Yummy',
  description: 'Login to access the restaurant management dashboard.',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-4">{children}</div>
    </div>
  );
}
