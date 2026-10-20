// Section → roles allowed (mirrors the server's ROLE_ACCESS).
export const ACCESS = {
  dashboard: ["Admin", "Front Desk"],
  reservations: ["Admin", "Front Desk"],
  availability: ["Admin", "Front Desk"],
  guests: ["Admin", "Front Desk"],
  rooms: ["Admin", "Front Desk", "Housekeeping"],
  billing: ["Admin", "Front Desk"],
  housekeeping: ["Admin", "Housekeeping"],
  pos: ["Admin", "Restaurant"],
  users: ["Admin"],
  reports: ["Admin"],
};

export const can = (user, section) => !!user && ACCESS[section]?.includes(user.role);
