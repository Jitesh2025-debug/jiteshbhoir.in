import LoginForm from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-3xl font-bold">
          RecruitFlow
        </h1>

        <p className="mb-6 text-center text-sm text-gray-500">
          Login to continue
        </p>

        <LoginForm />
      </div>
    </main>
  );
}