import EventDetailClient from "./eventDetailClient";

// Next.js 15+: params 可能是 Promise
export default async function EventDetailPage({ params }) {
  const { id } = await params;
  return <EventDetailClient id={String(id)} />;
}