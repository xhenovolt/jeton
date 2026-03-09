/**
 * Register Page - Futuristic Glassmorphism Design
 * New account creation interface
 */

import RegisterForm from '@/components/auth/RegisterForm';
import AnimatedAuthBackground from '@/components/auth/AnimatedAuthBackground';

export const metadata = {
  title: 'Create Account - Jeton',
  description: 'Create a new Jeton account',
};

export default function RegisterPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
      <AnimatedAuthBackground />
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25 mb-4">
            <span className="text-2xl font-bold text-white">J</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Create Account
          </h1>
          <p className="text-gray-400">
            Get started with Jeton today
          </p>
        </div>

        {/* Glassmorphism Card */}
        <div className="backdrop-blur-xl bg-white/[0.07] border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/20 p-8">
          <RegisterForm />
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Protected by enterprise-grade security
          </p>
        </div>
      </div>
    </div>
  );
}
