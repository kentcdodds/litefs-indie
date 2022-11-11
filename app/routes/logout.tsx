import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

import { logout } from "~/session.server";
import { ensurePrimary } from "~/utils.server";

export async function action({ request }: ActionArgs) {
  await ensurePrimary();
  return logout(request);
}

export async function loader() {
  return redirect("/");
}
