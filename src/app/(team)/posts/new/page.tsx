import { BackLink, PageHeading } from "@/components/ui";
import { PostForm } from "@/components/posts";
import { getRoles } from "@/server/queries";
export default async function NewPost() {
  const roles = await getRoles();
  return (
    <div className="narrow-page">
      <BackLink href="/feed">Tilbake til innlegg</BackLink>
      <PageHeading eyebrow="DEL MED LAGET" title="Nytt innlegg" />
      <PostForm roles={roles} />
    </div>
  );
}
