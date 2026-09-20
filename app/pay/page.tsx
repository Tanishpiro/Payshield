import PayApp from "@/components/PayApp";
import { loadReceiverCards } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PayPage() {
  const { cards } = await loadReceiverCards();
  return <PayApp handles={cards.map((c) => ({ handle: c.handle, name: c.name }))} />;
}
