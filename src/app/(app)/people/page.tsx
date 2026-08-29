import { permanentRedirect } from "next/navigation";

/*
 * The directory moved onto Home. This route stays as a permanent redirect
 * so installed PWA shortcuts, bookmarks and any link already in the wild
 * still land somewhere sensible.
 */
export default function PeopleRedirect() {
  permanentRedirect("/");
}
