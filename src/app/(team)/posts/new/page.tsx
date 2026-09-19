import { BackLink, PageHeading } from "@/components/ui";
import { PostForm } from "@/components/posts";
import { getRoles, requireAccount } from "@/server/queries";
import { canCoach } from "@/lib/domain";
import Link from "next/link";
export default async function NewPost() {
  const roles = await getRoles();
  const profile = await requireAccount();
  return (
    <div className="narrow-page">
      <BackLink href="/feed">Tilbake til innlegg</BackLink>
      <PageHeading eyebrow="DEL MED LAGET" title="Nytt innlegg" />
      {canCoach(profile) && (
        <p className="message info">
          Vil du publisere en startoppstilling?{" "}
          <Link className="inline-link" href="/lineups/new">
            Lag kampoppstilling
          </Link>
        </p>
      )}
      <PostForm roles={roles} />
    </div>
  );
}
