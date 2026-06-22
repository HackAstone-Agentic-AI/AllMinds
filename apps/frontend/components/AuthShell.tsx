import Image from 'next/image';

interface AuthShellProps {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}

export default function AuthShell({
  children,
  eyebrow,
  title,
  description,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#f3f7f6] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(440px,560px)]">
      <section className="relative hidden overflow-hidden bg-[#0b4f5c] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-y-0 right-0 w-1 bg-[#ff6b57]" />

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white">
            <Image
              src="/allminds-logo.png"
              alt=""
              width={42}
              height={42}
              className="h-10 w-10 object-contain"
              priority
            />
          </div>
          <div>
            <p className="text-xl font-bold">All Minds</p>
            <p className="text-sm text-teal-100">Teacher workspace</p>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="mb-5 text-sm font-semibold uppercase text-[#ffb5a9]">
            Built for inclusive classrooms
          </p>
          <h2 className="text-4xl font-bold leading-tight">
            Teaching is complex. Your workspace should feel clear.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-8 text-teal-50">
            Plan, support, and stay connected to every learner from one calm place.
          </p>
        </div>

        <p className="text-sm text-teal-100">Made with teachers, for teachers.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow-sm">
              <Image
                src="/allminds-logo.png"
                alt=""
                width={38}
                height={38}
                className="h-9 w-9 object-contain"
                priority
              />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">All Minds</p>
              <p className="text-xs text-slate-500">Teacher workspace</p>
            </div>
          </div>

          <div className="mb-7">
            <p className="mb-2 text-sm font-semibold text-[#087d8c]">{eyebrow}</p>
            <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>

          {children}
        </div>
      </section>
    </main>
  );
}
