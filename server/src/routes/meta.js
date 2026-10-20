import { Router } from "express";
import * as C from "../config/constants.js";
import Property from "../models/Property.js";
import { ah } from "../utils/http.js";
import { todayStr } from "../utils/dates.js";

const r = Router();

r.get("/", ah(async (_req, res) => {
  const properties = await Property.find().sort("sortOrder").lean();
  res.json({
    hotel: C.HOTEL,
    today: todayStr(),
    properties: properties.map((p) => ({ ...p, defaultRates: p.defaultRates })),
    roles: C.ROLES,
    roleAccess: C.ROLE_ACCESS,
    roomTypes: C.ROOM_TYPES,
    roomStatuses: C.ROOM_STATUSES,
    resStatuses: C.RES_STATUSES,
    bookingSources: C.BOOKING_SOURCES,
    nationalities: C.NATIONALITIES,
    purposes: C.PURPOSES,
    visaTypes: C.VISA_TYPES,
    billTo: C.BILL_TO,
    idTypes: C.ID_TYPES,
    countryCodes: C.COUNTRY_CODES,
    amenities: C.AMENITIES,
    paymentMethods: C.PAYMENT_METHODS,
    chargeCatalog: C.CHARGE_CATALOG,
    checkoutOverrideReasons: C.CHECKOUT_OVERRIDE_REASONS,
    hkTaskTypes: C.HK_TASK_TYPES,
    hkStatuses: C.HK_STATUSES,
    priorities: C.PRIORITIES,
    posOrderStatuses: C.POS_ORDER_STATUSES,
  });
}));

export default r;
