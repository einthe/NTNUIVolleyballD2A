import { notFound } from "next/navigation";
import { getPost, requireAccount } from "@/server/queries";
import { uuid } from "@/lib/domain";
import { BackLink } from "@/components/ui";
import { PostCard } from "@/components/posts";
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const [post, profile] = await Promise.all([getPost(id), requireAccount()]);
  if (!post) notFound();
  return (
    <div className="narrow-page">
      <BackLink href="/feed">Tilbake til innlegg</BackLink>
      <PostCard post={post} profile={profile} detail />
    </div>
  );
}
