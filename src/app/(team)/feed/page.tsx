import Link from "next/link";
import {
  ArrowRight,
  Plus,
  MessageSquare,
  CalendarDays,
  ArrowUpRight,
  Volleyball,
} from "lucide-react";
import { getEvents, getPosts, getRoster, requireAccount } from "@/server/queries";
import { PageHeading, EmptyState, Pagination, pageNumber } from "@/components/ui";
import { PostCard } from "@/components/posts";
import { SmallEvent } from "@/components/events";
import { ContentBoundary } from "@/components/content-boundary";
import { canCoach, type Profile } from "@/lib/domain";
export const metadata = { title: "Innlegg" };
export default async function Feed({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const page = pageNumber(params.page);
  const filter = ["roles", "lineup"].includes(params.filter ?? "") ? params.filter : undefined;
  const profile = await requireAccount();
  return (
    <>
      <PageHeading title="Innlegg">
        <div className="button-row">
          {canCoach(profile) && (
            <Link className="button secondary" href="/lineups/new">
              <Volleyball size={18} /> Kampoppstilling
            </Link>
          )}
          <Link className="button" href="/posts/new">
            <Plus size={18} /> Nytt innlegg
          </Link>
        </div>
      </PageHeading>
      <div className="feed-layout">
        <div>
          <nav className="filter-tabs" aria-label="Filtrer innlegg">
            {[
              ["", "Alle innlegg"],
              ["roles", "Fra ansvarsroller"],
              ["lineup", "Kampoppstillinger"],
            ].map(([key, label]) => (
              <Link
                key={key}
                href={`/feed${key ? `?filter=${key}` : ""}`}
                className={(filter ?? "") === key ? "selected" : ""}
              >
                {label}
              </Link>
            ))}
          </nav>
          <ContentBoundary title="Innleggene kunne ikke hentes">
            <FeedPosts page={page} filter={filter} profile={profile} />
          </ContentBoundary>
        </div>
        <aside className="feed-aside">
          <ContentBoundary title="Terminlisten kunne ikke hentes" href="/schedule">
            <UpcomingEvents />
          </ContentBoundary>
          <ContentBoundary title="Lagoversikten kunne ikke hentes" href="/roster">
            <TeamSummary />
          </ContentBoundary>
        </aside>
      </div>
    </>
  );
}

async function FeedPosts({
  page,
  filter,
  profile,
}: {
  page: number;
  filter?: string;
  profile: Profile;
}) {
  const { posts, count } = await getPosts(page, filter);
  return (
    <>
      <div className="post-list">
        {posts.length ? (
          posts.map((post) => (
            <ContentBoundary
              key={post.id}
              title="Dette innlegget kunne ikke vises"
              href={`/posts/${post.id}`}
            >
              <PostCard post={post} profile={profile} />
            </ContentBoundary>
          ))
        ) : (
          <div className="card">
            <EmptyState
              icon={<MessageSquare size={28} />}
              title={filter ? "Ingen innlegg i denne kategorien" : "Ingen innlegg ennå"}
            >
              <Link className="button secondary" href="/posts/new">
                Skriv et innlegg <ArrowRight size={16} />
              </Link>
            </EmptyState>
          </div>
        )}
      </div>
      <Pagination
        page={page}
        count={count}
        size={12}
        href={`/feed${filter ? `?filter=${filter}` : ""}`}
      />
    </>
  );
}

async function UpcomingEvents() {
  const { events } = await getEvents();
  return (
    <section className="card upcoming-card">
      <header className="section-title">
        <h2>
          <CalendarDays size={17} /> Kommende hendelser
        </h2>
        <Link href="/schedule" aria-label="Se terminlisten">
          <ArrowUpRight size={17} />
        </Link>
      </header>
      {events.length ? (
        events.slice(0, 4).map((event) => <SmallEvent key={event.id} event={event} />)
      ) : (
        <p className="aside-empty">Ingen kommende hendelser.</p>
      )}
      <Link className="aside-link" href="/schedule">
        Hele terminlisten <ArrowRight size={15} />
      </Link>
    </section>
  );
}

async function TeamSummary() {
  const roster = await getRoster();
  return (
    <section className="card team-summary">
      <div className="team-count">
        <strong>{roster.filter((p) => p.base_role === "player").length}</strong>
        <span>spillere</span>
      </div>
      <Link className="inline-link" href="/roster">
        Se laget <ArrowUpRight size={16} />
      </Link>
    </section>
  );
}
