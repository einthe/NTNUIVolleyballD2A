import Link from "next/link";
import { ArrowRight, Plus, MessageSquare, CalendarDays, ArrowUpRight } from "lucide-react";
import { getEvents, getPosts, getRoster, requireAccount } from "@/server/queries";
import { PageHeading, EmptyState, Pagination, pageNumber } from "@/components/ui";
import { PostCard } from "@/components/posts";
import { SmallEvent } from "@/components/events";
export const metadata = { title: "Innlegg" };
export default async function Feed({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const page = pageNumber(params.page);
  const filter = ["roles", "lineup"].includes(params.filter ?? "") ? params.filter : undefined;
  const [profile, { posts, count }, { events }, roster] = await Promise.all([
    requireAccount(),
    getPosts(page, filter),
    getEvents(),
    getRoster(),
  ]);
  return (
    <>
      <PageHeading
        eyebrow="SAMMEN PÅ OG UTENFOR BANEN"
        title="Innlegg"
        description="Små oppdateringer. Store øyeblikk. Alt som samler laget."
      >
        <Link className="button" href="/posts/new">
          <Plus size={18} /> Nytt innlegg
        </Link>
      </PageHeading>
      <div className="feed-layout">
        <div>
          <section className="welcome-card">
            <div>
              <p className="eyebrow">LAGROMMET DITT</p>
              <h2>
                Hei, {profile.full_name.split(" ")[0]} <span className="wave">↗</span>
              </h2>
              <p>Her holder vi kontakten mellom treningene.</p>
            </div>
            <div className="welcome-decoration" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </section>
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
          <div className="post-list">
            {posts.length ? (
              posts.map((post) => <PostCard key={post.id} post={post} profile={profile} />)
            ) : (
              <div className="card">
                <EmptyState icon={<MessageSquare size={28} />} title="Gjør lagrommet til vårt">
                  <p>
                    {filter
                      ? "Ingen innlegg i denne kategorien ennå."
                      : "Del en beskjed, en påminnelse eller noe hyggelig med laget."}
                  </p>
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
        </div>
        <aside className="feed-aside">
          <section className="card upcoming-card">
            <header className="section-title">
              <h2>
                <CalendarDays size={17} /> Det neste som skjer
              </h2>
              <Link href="/schedule" aria-label="Se terminlisten">
                <ArrowUpRight size={17} />
              </Link>
            </header>
            {events.length ? (
              events.slice(0, 4).map((event) => <SmallEvent key={event.id} event={event} />)
            ) : (
              <p className="aside-empty">
                Ingen kommende hendelser ennå. Nye treninger og kamper vises her.
              </p>
            )}
            <Link className="aside-link" href="/schedule">
              Hele terminlisten <ArrowRight size={15} />
            </Link>
          </section>
          <section className="card team-summary">
            <p className="eyebrow">FOLKENE BAK LAGET</p>
            <h2>
              En gjeng.
              <br />
              Et felles mål.
            </h2>
            <div className="team-count">
              <strong>{roster.filter((p) => p.base_role === "player").length}</strong>
              <span>
                spillere
                <br />
                på laget
              </span>
            </div>
            <Link className="inline-link" href="/roster">
              Møt laget <ArrowUpRight size={16} />
            </Link>
          </section>
          <div className="aside-note">
            <span className="status-dot" />
            <p>
              Dette er vårt private lagrom.
              <br />
              Det vi deler her, blir i laget.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
