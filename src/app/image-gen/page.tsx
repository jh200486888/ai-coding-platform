import { redirect } from "next/navigation";
export default function ImageGenPage() {
  redirect("/design?mode=quick");
}
