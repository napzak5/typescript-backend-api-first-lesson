/** Links of a user as an administrator reaches it; `basePath` is where these routes are mounted. */
export const userLinks = (basePath: string, id: string): { self: string } => ({
  self: `${basePath}/users/${id}`,
})
