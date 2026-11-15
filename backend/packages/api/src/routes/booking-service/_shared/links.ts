/**
 * Links of a service line of a booking. `servicesPath` is where the routes
 * are mounted: the path of the booking, and below it its service lines.
 */
export const bookingServiceLinks = (
  servicesPath: string,
  id: string,
): { self: string; booking: string } => ({
  self: `${servicesPath}/${id}`,
  booking: servicesPath.slice(0, servicesPath.lastIndexOf('/')),
})
