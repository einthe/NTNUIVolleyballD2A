import { notFound, redirect } from "next/navigation";
import { getPost, getRoles, requireAccount } from "@/server/queries";
import { uuid } from "@/lib/domain";
import { BackLink, PageHeading } from "@/components/ui";
import { PostForm } from "@/components/posts";
export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const [post, profile, roles] = await Promise.all([getPost(id), requireAccount(), getRoles()]);
  if (!post) notFound();
  if (
    post.post_type !== "normal" ||
    (post.author_user_id !== profile.id && profile.base_role !== "admin")
  )
    redirect(`/posts/${id}`);
  return (
    <div className="narrow-page">
      <BackLink href={`/posts/${id}`}>Tilbake til innlegget</BackLink>
      <PageHeading title="Rediger innlegg" />
      <PostForm post={post} roles={roles} />
    </div>
  );
}
