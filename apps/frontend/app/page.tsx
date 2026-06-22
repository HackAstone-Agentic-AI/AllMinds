import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  Eye,
  FileText,
  MessageSquareText,
  ShieldCheck,
  Users,
} from 'lucide-react';

const services = [
  {
    title: 'Learner-aware planning',
    description: 'Adapt lessons and assessments around anonymised learner support needs.',
    icon: FileText,
    className: 'md:col-span-7 bg-[#dcecea]',
  },
  {
    title: 'Visual support',
    description: 'Create routines, social stories, visual prompts, and multimodal activities.',
    icon: Eye,
    className: 'md:col-span-5 bg-[#edf4f2]',
  },
  {
    title: 'Schedule and routines',
    description: 'Organise classroom transitions and connect teacher work to Google Calendar.',
    icon: CalendarDays,
    className: 'md:col-span-4 bg-white',
  },
  {
    title: 'Progress insight',
    description: 'Track observations, successful strategies, and meaningful learner progress.',
    icon: BarChart3,
    className: 'md:col-span-4 bg-[#f7faf9]',
  },
  {
    title: 'Family communication',
    description: 'Draft clear progress updates and concern messages with teacher approval.',
    icon: MessageSquareText,
    className: 'md:col-span-4 bg-white',
  },
  {
    title: 'Teacher community',
    description: 'Share practical classroom strategies and find nearby support services.',
    icon: Users,
    className: 'md:col-span-12 bg-[#0b4f5c] text-white',
  },
];

const workflow = [
  ['Understand', 'Capture anonymised learner context and classroom priorities.'],
  ['Adapt', 'Generate teaching resources shaped around the learner and curriculum.'],
  ['Act', 'Use visual supports, schedules, and family communication in one workflow.'],
  ['Learn', 'Track what worked and build a clearer picture of progress over time.'],
];

const productCapabilities = [
  'Move from learner context to a usable classroom resource without switching tools.',
  'Keep every generated plan, message, task, and schedule under teacher review.',
  'Build a practical record of the strategies that help each learner participate.',
];

export default function Home() {
  return (
    <main id="main-content" className="landing-page overflow-x-hidden bg-[#f4f7f6] text-slate-900">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[60] -translate-y-24 rounded-lg bg-white px-4 py-3 font-semibold text-[#0b4f5c] shadow-lg transition focus:translate-y-0"
      >
        Skip to content
      </a>

      <nav className="fixed inset-x-0 top-0 z-50 px-4 pt-4" aria-label="Main navigation">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between rounded-lg border border-white/70 bg-white/95 px-3 shadow-[0_16px_50px_rgba(7,57,67,0.16)] backdrop-blur sm:px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="All Minds home">
            <Image
              src="/allminds-logo.png"
              alt=""
              width={38}
              height={38}
              className="h-9 w-9 object-contain"
              priority
            />
            <span className="font-bold text-slate-900">All Minds</span>
          </Link>

          <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#workflow" className="transition hover:text-[#087d8c]">
              How it works
            </a>
            <a href="#services" className="transition hover:text-[#087d8c]">
              Services
            </a>
            <a href="#trust" className="transition hover:text-[#087d8c]">
              Privacy
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-[0.98]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="whitespace-nowrap rounded-lg bg-[#0b4f5c] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#083f49] active:scale-[0.98]"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative flex min-h-[88dvh] items-end overflow-hidden bg-[#073943] pt-24 text-white">
        <Image
          src="/allminds-classroom-hero.png"
          alt="Teacher supporting an inclusive classroom with visual learning resources"
          fill
          className="object-cover object-[64%_center] md:object-center"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#062f37]/50" />
        <div className="absolute inset-y-0 left-0 hidden w-[72%] bg-[#062f37]/72 md:block" />

        <div className="relative mx-auto w-full max-w-7xl px-5 pb-14 sm:px-8 sm:pb-20 lg:px-10">
          <div className="landing-reveal max-w-4xl">
            <h1 className="text-5xl font-bold leading-[1.02] sm:text-6xl lg:text-7xl">
              All Minds
            </h1>
            <p className="mt-5 max-w-3xl text-2xl font-semibold leading-tight text-white sm:text-4xl">
              One calm workspace for every learner&apos;s next step.
            </p>
            <p className="mt-5 max-w-xl text-base leading-7 text-teal-50 sm:text-lg">
              Plan, adapt, schedule, and communicate with inclusive classroom intelligence.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#ff6b57] px-6 py-3.5 font-semibold text-white transition hover:bg-[#e85b49] active:scale-[0.98]"
              >
                Create your workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#workspace"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/60 bg-white/10 px-6 py-3.5 font-semibold text-white transition hover:bg-white/20 active:scale-[0.98]"
              >
                Explore the workflow
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-slate-200 px-5 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-8 lg:grid-cols-4 lg:px-10">
          {workflow.map(([title, description]) => (
            <article key={title} className="py-7 sm:px-6 lg:py-9">
              <h2 className="text-lg font-semibold text-[#0b4f5c]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="workspace" className="bg-[#e7f0ee] px-5 pb-24 pt-20 sm:px-8 sm:pb-32 lg:px-10">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          <div className="relative overflow-hidden rounded-lg">
            <Image
              src="/allminds-teacher-planning.png"
              alt="Teacher planning an inclusive lesson with visual support materials"
              width={1536}
              height={1024}
              className="landing-support-image aspect-[4/3] object-cover transition duration-700 hover:scale-[1.025]"
              sizes="(min-width: 1024px) 52vw, 100vw"
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-[#087d8c]">A connected teacher workflow</p>
            <h2 className="mt-3 max-w-xl text-3xl font-bold leading-tight text-slate-900 sm:text-5xl">
              Fewer disconnected decisions. More classroom action.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              All Minds brings learner records, generated resources, tasks, communication,
              and specialist AI support into one teacher-controlled workspace.
            </p>

            <div className="mt-8 space-y-5">
              {productCapabilities.map((capability) => (
                <div key={capability} className="flex gap-4 border-t border-[#b7cfcb] pt-5">
                  <Check className="mt-0.5 h-5 w-5 flex-none text-[#087d8c]" />
                  <p className="leading-7 text-slate-700">{capability}</p>
                </div>
              ))}
            </div>

            <Link
              href="/signup"
              className="mt-9 inline-flex items-center gap-2 whitespace-nowrap font-semibold text-[#0b4f5c] transition hover:text-[#087d8c]"
            >
              Build your teacher workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section id="services" className="bg-[#f4f7f6] px-5 pb-28 pt-24 sm:px-8 sm:pb-36 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold leading-tight sm:text-5xl">
              Support that moves with the learner.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Practical tools for planning, participation, communication, and follow-through.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-flow-dense md:grid-cols-12">
            {services.map((service, index) => (
              <article
                key={service.title}
                className={`group rounded-lg border border-[#cddedb] p-7 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(7,57,67,0.12)] active:scale-[0.99] ${
                  service.className
                } ${index < 2 || index === 5 ? 'min-h-64' : 'min-h-56'}`}
              >
                <service.icon
                  className={`h-7 w-7 ${
                    index === 5 ? 'text-[#ff9b89]' : 'text-[#087d8c]'
                  }`}
                  aria-hidden="true"
                />
                <h3 className="mt-10 max-w-md text-2xl font-semibold">{service.title}</h3>
                <p
                  className={`mt-3 max-w-xl leading-7 ${
                    index === 5 ? 'text-teal-50' : 'text-slate-600'
                  }`}
                >
                  {service.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="bg-[#dcecea] px-5 pb-28 pt-24 sm:px-8 sm:pb-36 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <ShieldCheck className="h-10 w-10 text-[#087d8c]" />
            <h2 className="mt-6 text-3xl font-bold leading-tight sm:text-5xl">
              Teacher-controlled. Privacy-aware by design.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Classroom support should earn trust through clear boundaries and useful controls.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-2">
            {[
              ['Anonymised learner profiles', 'Keep identifying details away from AI workflows.'],
              ['Per-user calendar access', 'Every teacher connects only their own Google account.'],
              ['Input guardrails', 'PII scrubbing and safety checks run before model requests.'],
              ['11 South African languages', 'Language preferences carry into Thandi responses.'],
            ].map(([title, description]) => (
              <article key={title} className="border-t border-[#9fbfba] pt-6">
                <h3 className="text-lg font-semibold text-[#0b4f5c]">{title}</h3>
                <p className="mt-2 max-w-md leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#ffe7e2] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-[#6f2a20] sm:text-4xl">
              Make the next classroom decision clearer.
            </h2>
            <p className="mt-3 text-lg text-[#864438]">
              Start with one learner, one lesson, or one classroom routine.
            </p>
          </div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#0b4f5c] px-6 py-3.5 font-semibold text-white transition hover:bg-[#083f49] active:scale-[0.98]"
          >
            Start with All Minds
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="bg-[#e7f0ee] px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Image
              src="/allminds-logo.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
            />
            <div>
              <p className="font-bold">All Minds</p>
              <p className="text-sm text-slate-600">Inclusive classroom intelligence</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-slate-600">
            <Link href="/login" className="transition hover:text-[#087d8c]">
              Sign in
            </Link>
            <Link href="/signup" className="transition hover:text-[#087d8c]">
              Create account
            </Link>
            <a href="#services" className="transition hover:text-[#087d8c]">
              Services
            </a>
            <span>Built for South African classrooms</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
