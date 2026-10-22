"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

interface RequestPreferenceLinkProps {
  publicSlug: string | null;
}

export function RequestPreferenceLink({ publicSlug }: RequestPreferenceLinkProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(!publicSlug ? "Restaurant information missing. Please use the link from your campaign." : "");
  const [success, setSuccess] = useState(false);
  const [preferenceToken, setPreferenceToken] = useState("");
  const [customerName, setCustomerName] = useState("");

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value.length <= 10) {
      setPhone(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!publicSlug) {
      setError("Restaurant information missing. Please use the link from your campaign.");
      return;
    }

    if (phone.length !== 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("phone", phone);
      if (email.trim()) {
        params.set("email", email);
      }

      const response = await fetch(
        `/api/backend/public/growth/restaurants/${publicSlug}/request-preference-link?${params}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Failed to generate preference link");
      }

      setSuccess(true);
      setPreferenceToken(result.data.preference_token);
      setCustomerName(result.data.customer_name || "");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success && preferenceToken) {
    const preferenceUrl = `${window.location.origin}/grow/preferences?token=${preferenceToken}`;

    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900">
              Your Preference Link is Ready!
            </h1>

            {customerName && (
              <p className="text-gray-600">
                Hi {customerName}, manage your communication preferences below:
              </p>
            )}
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <p className="text-sm text-gray-600 mb-3">Your preference management link:</p>
            <div className="bg-white rounded border border-orange-300 p-3 break-all text-sm text-gray-700">
              {preferenceUrl}
            </div>
          </div>

          <button
            onClick={() => router.push(`/grow/preferences?token=${preferenceToken}`)}
            className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 transition-colors font-medium"
          >
            Manage My Preferences
          </button>

          <p className="text-xs text-center text-gray-500">
            This link is valid for 1 year and can be used to update your communication
            preferences anytime.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-orange-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            Request Preference Link
          </h1>
          <p className="text-gray-600">
            Enter your details to get a new link to manage your communication preferences
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="9876543210"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the 10-digit phone number you used to subscribe
            </p>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email (Optional)
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              If provided, we'll verify it matches our records
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || phone.length !== 10}
            className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Generating Link..." : "Get Preference Link"}
          </button>
        </form>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-start gap-3 text-sm text-gray-600">
            <svg
              className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span>
              Your data is secure. We'll only use this to verify your identity and generate a
              preference management link.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
