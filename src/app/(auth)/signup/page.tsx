import { permanentRedirect } from "next/navigation";

/*
 * Sign-up merged into /login: the email step decides whether an account
 * needs creating. Kept as a redirect so old links and bookmarks still work.
 */
export default function SignupRedirect() {
  permanentRedirect("/login");
}
