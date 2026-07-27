import Membership from "./Membership.js";
import Tenant from "./Tenant.js";
import User from "./User.js";

export { Membership, Tenant, User };

export async function initializeModels() {
    await Promise.all([
        User.init(),
        Tenant.init(),
        Membership.init(),
    ]);
}