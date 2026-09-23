/**
 * Route loading state. The page's real title is already on screen, with its
 * content blocked out beneath it, so arriving data settles into place instead
 * of replacing a loader. The blocks breathe slowly; that is the only motion.
 */
export function PageSkeleton({ title }: { title: string }) {
  return (
    <div aria-busy="true" aria-label={title ? `Loading ${title}` : "Loading"}>
      {title ? (
        <h1 className="font-display mb-8 text-[2.125rem] leading-[1.05] text-text sm:mb-10 sm:text-[2.75rem]">
          {title}
        </h1>
      ) : (
        <div className="hb-skeleton mb-8 h-10 w-48 rounded-xl sm:mb-10" />
      )}
      <div className="space-y-3">
        <div className="hb-skeleton h-36 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <div className="hb-skeleton h-24 rounded-2xl" />
          <div className="hb-skeleton h-24 rounded-2xl" />
        </div>
        <div className="hb-skeleton h-56 rounded-2xl" />
      </div>
    </div>
  );
}
