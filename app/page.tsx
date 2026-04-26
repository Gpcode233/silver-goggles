import Link from "next/link";
import { BadgeCheck, CircleHelp, Filter, Plug, Settings, Star, WalletCards } from "lucide-react";

import { AgentCard } from "@/components/agent-card";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { listAgents } from "@/lib/agent-service";

export const dynamic = "force-dynamic";

const SIDEBAR_FILTERS = [
  { label: "Categories", icon: Filter, active: true },
  { label: "Pricing", icon: WalletCards, active: false },
  { label: "Ratings", icon: Star, active: false },
  { label: "Verified", icon: BadgeCheck, active: false },
  { label: "Integration", icon: Plug, active: false },
] as const;

const CATEGORY_FILTERS = ["LLMs", "Automation", "Writing", "Design"] as const;
const CATEGORY_GROUPS: Record<(typeof CATEGORY_FILTERS)[number], string[]> = {
  LLMs: ["Research", "Finance", "Education", "General"],
  Automation: ["Productivity", "Coding"],
  Writing: ["Marketing", "Education", "General"],
  Design: ["Design"],
};

function mapChipToCategory(chip: string) {
  const normalized = chip.toLowerCase();
  if (normalized === "productivity") {
    return "Productivity";
  }
  if (normalized === "marketing") {
    return "Marketing";
  }
  if (normalized === "development") {
    return "Coding";
  }
  return "";
}

function normalizeCategoryParams(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => item.trim()).filter(Boolean);
}

function buildMarketplaceHref({
  search,
  categories,
  sort,
  sidebar,
  page,
}: {
  search: string;
  categories: string[];
  sort?: string;
  sidebar?: string;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (search) {
    params.set("search", search);
  }
  for (const category of categories) {
    params.append("category", category);
  }
  if (sort) {
    params.set("sort", sort);
  }
  if (sidebar) {
    params.set("sidebar", sidebar);
  }
  if (page && page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function toggleCategoryGroup(
  activeGroups: Array<(typeof CATEGORY_FILTERS)[number]>,
  group: (typeof CATEGORY_FILTERS)[number],
) {
  return activeGroups.includes(group)
    ? activeGroups.filter((item) => item !== group)
    : [...activeGroups, group];
}

function getVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages] as const;
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages] as const;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    category?: string | string[];
    sort?: string;
    sidebar?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const search = params.search?.trim() ?? "";
  const categoryParams = normalizeCategoryParams(params.category);
  const sort = params.sort?.trim() ?? "";
  const sidebar = params.sidebar?.trim().toLowerCase() ?? "categories";
  const currentPage = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = 9;

  const selectedSidebarGroups = CATEGORY_FILTERS.filter((group) =>
    categoryParams.includes(group) || CATEGORY_GROUPS[group].some((category) => categoryParams.includes(category)),
  );

  const selectedExactCategory =
    categoryParams.find((item) =>
      Object.values(CATEGORY_GROUPS).every((groupItems) => !groupItems.includes(item)),
    ) ?? "";

  const agents = await listAgents({
    search,
    category: selectedExactCategory || undefined,
    includeDrafts: false,
  });

  const filteredAgents =
    selectedSidebarGroups.length > 0
      ? agents.filter((agent) =>
          selectedSidebarGroups.some((group) => CATEGORY_GROUPS[group].includes(agent.category)),
        )
      : agents;

  const featureFilteredAgents = filteredAgents.filter((agent) => {
    if (sidebar === "verified") {
      return agent.category === "Marketing" || agent.category === "Education" || agent.category === "Design" || agent.category === "Finance";
    }
    if (sidebar === "integration") {
      const searchable = `${agent.description} ${agent.systemPrompt}`.toLowerCase();
      return agent.category === "Coding" || agent.category === "Productivity" || searchable.includes("workflow") || searchable.includes("integrat") || searchable.includes("api");
    }
    return true;
  });

  const sortedAgents = [...featureFilteredAgents].sort((left, right) => {
    if (sort === "price") {
      return left.pricePerRun - right.pricePerRun;
    }
    if (sort === "rating") {
      return Number.parseFloat((4.3 + ((right.id * 7) % 8) * 0.1).toFixed(1)) - Number.parseFloat((4.3 + ((left.id * 7) % 8) * 0.1).toFixed(1));
    }
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });

  const totalPages = Math.max(1, Math.ceil(sortedAgents.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedAgents = sortedAgents.slice((safePage - 1) * pageSize, safePage * pageSize);

  const chipFilters = [
    {
      label: "All Agents",
      href: buildMarketplaceHref({ search, categories: [], sort, sidebar }),
      active: categoryParams.length === 0,
    },
    {
      label: "Trending",
      href: buildMarketplaceHref({ search, categories: categoryParams, sort, sidebar }),
      active: false,
    },
    {
      label: "Newest",
      href: buildMarketplaceHref({ search, categories: categoryParams, sort: "", sidebar }),
      active: sort === "",
    },
    ...["Productivity", "Marketing", "Development"].map((chip) => {
      const mappedCategory = mapChipToCategory(chip);
      return {
        label: chip,
        href: buildMarketplaceHref({ search, categories: mappedCategory ? [mappedCategory] : [], sort, sidebar }),
        active: selectedExactCategory === mappedCategory,
      };
    }),
  ];

  return (
    <main className="mx-auto w-full max-w-[1440px] lg:h-[calc(100vh-74px)] lg:overflow-hidden">
      <div className="grid gap-8 lg:h-full lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden border-r border-slate-200 bg-slate-50/90 lg:block lg:h-full lg:overflow-y-auto">
          <div className="px-4 py-8">
            <div className="rounded-2xl bg-slate-900 px-4 py-4 text-white">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  <Filter className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[34px]/none font-black">Filters</p>
                </div>
              </div>
            </div>

            <div className="mt-10 space-y-2">
              {SIDEBAR_FILTERS.map((item) => {
                const Icon = item.icon;
                const key = item.label.toLowerCase();
                const isActive =
                  (key === "categories" && sidebar === "categories") ||
                  (key === "pricing" && sort === "price") ||
                  (key === "ratings" && sort === "rating") ||
                  (key === "verified" && sidebar === "verified") ||
                  (key === "integration" && sidebar === "integration");
                const href =
                  key === "pricing"
                    ? buildMarketplaceHref({ search, categories: categoryParams, sort: "price", sidebar: "categories" })
                    : key === "ratings"
                      ? buildMarketplaceHref({ search, categories: categoryParams, sort: "rating", sidebar: "categories" })
                      : buildMarketplaceHref({ search, categories: categoryParams, sort, sidebar: key });
                return (
                  <Link
                    key={item.label}
                    href={href}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-semibold transition hover:bg-white ${
                      isActive ? "bg-white text-slate-900" : "text-slate-500"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="mt-14">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Category</p>
              <div className="mt-5 space-y-3">
                {CATEGORY_FILTERS.map((item) => {
                  const checked = selectedSidebarGroups.includes(item);
                  const nextGroups = toggleCategoryGroup(selectedSidebarGroups, item);
                  return (
                    <Link
                      key={item}
                      href={buildMarketplaceHref({ search, categories: nextGroups, sort, sidebar })}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 text-[15px] text-slate-800 transition hover:bg-white"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs font-bold ${
                          checked
                            ? "border-teal-600 bg-teal-600 text-white"
                            : "border-slate-300 bg-white text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <span>{item}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <Link href={buildMarketplaceHref({ search: "", categories: [], sort: "", sidebar: "categories" })} className="mt-16 inline-block text-sm font-bold text-sky-700">
              Clear All Filters
            </Link>

            <div className="mt-24 space-y-5 text-[15px] text-slate-500">
              <div className="flex items-center gap-3">
                <Settings className="h-4 w-4" />
                Settings
              </div>
              <div className="flex items-center gap-3">
                <CircleHelp className="h-4 w-4" />
                Support
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 px-1 py-4 sm:px-2 lg:h-full lg:overflow-y-auto lg:px-0 lg:py-10">
          <div className="max-w-3xl lg:pr-6">
            <h1 className="text-4xl font-black tracking-[-0.04em] text-slate-900 sm:text-[60px] sm:leading-[0.95]">
              The Intelligent Layer
            </h1>
            <p className="mt-5 max-w-3xl text-xl leading-9 text-slate-600">
              Discover and deploy high-performance AI agents designed to handle complex workflows,
              creative tasks, and data processing with precision.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {chipFilters.map((filterItem) => (
              <Link
                key={filterItem.label}
                href={filterItem.href}
                className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                  filterItem.active
                    ? "bg-black text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {filterItem.label}
              </Link>
            ))}
          </div>

          <div className="mt-10 lg:pr-6">
            {paginatedAgents.length === 0 ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center">
                <p className="text-xl font-bold text-slate-900">No agents found</p>
                <p className="mt-2 text-slate-600">Try another search term or clear the current filters.</p>
                <Link
                  href="/"
                  className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
                >
                  Reset Marketplace
                </Link>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {paginatedAgents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            )}
          </div>

          <div className="mt-12 pb-8 lg:pr-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href={buildMarketplaceHref({ search, categories: categoryParams, sort, sidebar, page: Math.max(1, safePage - 1) })}
                    className={safePage === 1 ? "pointer-events-none opacity-40" : ""}
                  />
                </PaginationItem>
                {getVisiblePages(safePage, totalPages).map((pageNumber, index) => (
                  <PaginationItem key={`${pageNumber}-${index}`}>
                    {pageNumber === "ellipsis" ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        href={buildMarketplaceHref({ search, categories: categoryParams, sort, sidebar, page: pageNumber })}
                        isActive={pageNumber === safePage}
                      >
                        {pageNumber}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href={buildMarketplaceHref({ search, categories: categoryParams, sort, sidebar, page: Math.min(totalPages, safePage + 1) })}
                    className={safePage === totalPages ? "pointer-events-none opacity-40" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </section>
      </div>
    </main>
  );
}
