import { currentUser } from "@/services/access";
import { home } from "@/lib/policy";
import { redirect } from "next/navigation";
export default async function Page() {
  const user = await currentUser();
  redirect(home(user.role));
}
