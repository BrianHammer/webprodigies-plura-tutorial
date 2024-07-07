import { Notification, Prisma, Role } from "@prisma/client";
import { getAuthUserDetails, getUserPermissions } from "./queries";

export type NotificationWithUser =
  | ({
      User: {
        id: string;
        name: string;
        avatarUrl: string;
        email: string;
        createdAt: Date;
        updatedAt: Date;
        role: Role;
        agencyId: string | null;
      };
    } & Notification)[]
  | undefined;

export type UserWithPermissionsAndSubAccounts = Prisma.PromiseReturnType<
  typeof getUserPermissions
>;

export type AuthUserWithAgencySidebarOptionsSubAccounts =
  Prisma.PromiseReturnType<typeof getAuthUserDetails>;
