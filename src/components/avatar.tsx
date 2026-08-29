/*
 * THE avatar. Every place a person is pictured uses this — directory rows,
 * profile, settings, call screen, incoming-call overlay, dashboard header.
 * Hand-rolled letter circles drift apart in size, shape and fallback
 * behaviour, so there is deliberately only one implementation.
 *
 * The ?v= query is the avatarUpdatedAt epoch, which is what makes the
 * year-long immutable cache safe: a new photo is a different URL.
 */

export type AvatarUser = {
  id: string;
  displayName: string;
  avatarUpdatedAt: Date | string | null;
};

export function Avatar({
  user,
  size = 48,
  className = "",
  priority = false,
}: {
  user: AvatarUser;
  size?: number;
  className?: string;
  /** Skip lazy-loading for the one avatar that is above the fold. */
  priority?: boolean;
}) {
  const version = user.avatarUpdatedAt ? new Date(user.avatarUpdatedAt).getTime() : null;
  const letter = user.displayName.charAt(0).toUpperCase() || "?";

  if (!version) {
    return (
      <div
        style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
        className={`flex shrink-0 items-center justify-center rounded-full bg-accent font-bold ${className}`}
        aria-hidden
      >
        {letter}
      </div>
    );
  }

  return (
    // Plain img on purpose: the stored file is already a 256px webp, so
    // next/image would re-optimise an optimised image through a route it
    // cannot statically analyse. Width and height are always set so the
    // list never reflows as photos arrive.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/avatar/${user.id}?v=${version}`}
      alt=""
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full bg-accent object-cover ${className}`}
    />
  );
}
