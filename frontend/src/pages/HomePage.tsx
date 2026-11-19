
import { ArrowRight, ArrowUpRight, BookOpen, Code2, Layers3, Palette, Sparkles } from 'lucide-react'
import { Link } from 'react-router'

const categories = [
    {
        title: 'Templates',
        description: 'Ready-made foundations for your next big idea.',
        icon: Layers3,
        label: '01',
    },
    {
        title: 'Design Assets',
        description: 'Creative resources crafted for standout work.',
        icon: Palette,
        label: '02',
    },
    {
        title: 'Code & Scripts',
        description: 'Developer tools that help you build faster.',
        icon: Code2,
        label: '03',
    },
    {
        title: 'Ebooks & Guides',
        description: 'Practical knowledge from independent creators.',
        icon: BookOpen,
        label: '04',
    },
]

export default function HomePage() {
    return (
        <main className="min-h-screen bg-page text-foreground">
            {/* HERO SECTION */}
            <section className="relative overflow-hidden border-b border-outline">
                <div className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-accent opacity-60 blur-3xl" />

                <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 pt-10 pb-16 lg:grid-cols-2 lg:gap-14 lg:pt-12 lg:pb-20">
                    <div>
                        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-outline bg-surface px-4 py-2 text-sm font-semibold text-brand">
                            <Sparkles className="h-4 w-4" />
                            A marketplace for digital creators
                        </div>

                        <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
                            Your next idea
                            <span className="block text-brand">
                                starts here.
                            </span>
                        </h1>

                        <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted">
                            Discover exceptional templates, design assets,
                            code, ebooks, and digital tools from independent
                            creators around the world.
                        </p>

                        <div className="mt-9 flex flex-wrap items-center gap-4">
                            <Link
                                to="/products"
                                className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-foreground transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                            >
                                Explore Products
                                <ArrowUpRight className="h-5 w-5" />
                            </Link>

                            <a
                                href="#categories"
                                className="inline-flex items-center gap-2 rounded-xl border border-outline bg-surface px-6 py-3.5 font-semibold text-foreground transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                            >
                                Browse Categories
                                <ArrowRight className="h-4 w-4" />
                            </a>
                        </div>
                    </div>

                    {/* EDITORIAL VISUAL */}
                    <div className="relative">
                        <div className="relative overflow-hidden rounded-[2rem] border border-outline bg-accent p-8 shadow-xl shadow-black/5 sm:p-12">
                            <div className="absolute right-8 top-8 h-20 w-20 rounded-full border border-brand/20" />

                            <div className="relative flex min-h-[350px] flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-[0.25em] text-brand">
                                        The Creative Edit
                                    </span>
                                    <Sparkles className="h-6 w-6 text-brand" />
                                </div>

                                <div className="py-12">
                                    <div className="mb-6 flex items-center gap-3">
                                        <div className="flex h-16 w-16 rotate-[-12deg] items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-lg">
                                            <Palette className="h-8 w-8" />
                                        </div>
                                        <div className="flex h-16 w-16 rotate-[9deg] items-center justify-center rounded-2xl bg-surface text-brand shadow-lg">
                                            <Code2 className="h-8 w-8" />
                                        </div>
                                        <div className="flex h-16 w-16 rotate-[-6deg] items-center justify-center rounded-2xl border border-outline bg-page text-foreground shadow-lg">
                                            <Layers3 className="h-8 w-8" />
                                        </div>
                                    </div>

                                    <p className="max-w-sm text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl">
                                        Create more.
                                        <br />
                                        Imagine bigger.
                                    </p>
                                </div>

                                <div className="flex items-center justify-between border-t border-brand/15 pt-5">
                                    <span className="text-sm font-semibold text-muted">
                                        Design · Build · Learn
                                    </span>
                                    <ArrowUpRight className="h-5 w-5 text-brand" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CATEGORIES SECTION */}
            <section
                id="categories"
                className="mx-auto max-w-7xl scroll-mt-28 px-6 py-20 lg:py-24"
            >
                <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
                    <div>
                        <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-brand">
                            Find your inspiration
                        </p>

                        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                            Explore what you can create.
                        </h2>

                        <p className="mt-4 max-w-xl text-muted">
                            From your first concept to your next launch,
                            discover resources that move your work forward.
                        </p>
                    </div>

                    <Link
                        to="/products"
                        className="inline-flex items-center gap-2 font-semibold text-brand transition hover:opacity-75"
                    >
                        View all products
                        <ArrowUpRight className="h-4 w-4" />
                    </Link>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {categories.map((category) => {
                        const Icon = category.icon

                        return (
                            <article
                                key={category.title}
                                className="group flex min-h-64 flex-col justify-between rounded-2xl border border-outline bg-surface p-6 transition duration-200 hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg hover:shadow-black/5"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-brand">
                                        <Icon className="h-7 w-7" />
                                    </div>

                                    <span className="text-sm font-semibold text-muted">
                                        {category.label}
                                    </span>
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold">
                                        {category.title}
                                    </h3>

                                    <p className="mt-2 text-sm leading-relaxed text-muted">
                                        {category.description}
                                    </p>
                                </div>
                            </article>
                        )
                    })}
                </div>
            </section>

            {/* FINAL CTA */}
            <section className="border-t border-outline bg-surface">
                <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-6 py-16 md:flex-row md:items-center">
                    <div>
                        <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-brand">
                            Discover Sellora
                        </p>

                        <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
                            Better tools. Bigger possibilities.
                        </h2>

                        <p className="mt-4 max-w-xl text-muted">
                            Explore digital products created to help
                            you learn, build, and create.
                        </p>
                    </div>

                    <Link
                        to="/products"
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-foreground transition hover:opacity-90"
                    >
                        Explore Marketplace
                        <ArrowUpRight className="h-5 w-5" />
                    </Link>
                </div>
            </section>
        </main>
    )
}
