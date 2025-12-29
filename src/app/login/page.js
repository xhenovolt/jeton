/**
 * Login Page
 * User authentication interface
 */

import { Metadata } from 'next';
import LoginForm from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Sign In - Jeton',
  description: 'Sign in to your Jeton account',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Sign In
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Welcome back to Jeton
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm p-6">
          <LoginForm />
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            Protected by industry-standard security.{' '}
            <a
              href="#"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              Learn more
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
