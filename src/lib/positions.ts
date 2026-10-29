/**
 * The position that means "after the last one": the database places a
 * session exercise, template exercise or program day inserted with it under
 * a lock on its parent (append_position), so two adds at once can't share
 * a place the way reading the last position and adding one could.
 */
export const APPEND = -1;
