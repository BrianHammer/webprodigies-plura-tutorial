"use server";

import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { db } from "./db";
import { redirect } from "next/navigation";
import { Agency, Plan, Role, SubAccount, User } from "@prisma/client";
import { userAgent } from "next/server";
import { v4 } from "uuid";

////////////
// Gets the details of the logged in user
////////////
export const getAuthUserDetails = async () => {
  const user = await currentUser();

  if (!user) return null;
  // From this point there must be a user

  // Gets the user from the database
  // Includes the agency sidebar options given
  // Also includes the subaccount the user has access to
  const userData = await db.user.findUnique({
    where: {
      email: user.emailAddresses[0].emailAddress,
    },
    include: {
      Permissions: true,
      Agency: {
        include: {
          SidebarOption: true,
          SubAccount: {
            include: {
              SidebarOption: true,
            },
          },
        },
      },
    },
  });

  return userData;
};

///////////////
// SaveActivityLogsNotifications returns NOTHING!
// SaveActivityLogsNotifications creates a notification inside prisma
// of an action a user did.
// Based off either the subaccount or agency; one must be a value
export const saveActivityLogsNotification = async ({
  agencyId,
  description,
  subaccountId,
}: {
  agencyId?: string;
  description: string;
  subaccountId?: string;
}) => {
  //Get the current user
  const authUser = await currentUser();

  let userData;

  if (!authUser) {
    //If there is no currentUser, get the user with the subaccount ID
    const response = await db.user.findFirst({
      where: {
        Agency: {
          SubAccount: { some: { id: subaccountId } },
        },
      },
    });
    // Assigns data if there is a response
    // Will later return null if no data was found
    if (response) {
      userData = response;
    }
  } else {
    // Getting the subaccount failed;
    // Find the user based on the email address of Clerk
    userData = await db.user.findUnique({
      where: { email: authUser?.emailAddresses[0].emailAddress },
    });
  }

  //Userdata is collected, and now you can continue
  if (!userData) {
    console.log("Could not find a user");
    return;
  }

  // Since agency can be set to null, find the value based on subaccount
  let foundAgencyId = agencyId;

  if (!foundAgencyId) {
    if (!subaccountId) {
      //
      throw new Error("You must provide an agency or subaccount ID");
    }
    //There is at least a subaccount ID in the following code

    //  Return the subaccount
    const response = await db.subAccount.findUnique({
      where: { id: subaccountId },
    });
    if (response) foundAgencyId = response.agencyId;
  }

  if (subaccountId) {
    //Agency and userId are both found, create the notification and connect
    // them both
    await db.notification.create({
      data: {
        notification: `${userData.name} | ${description}`,
        User: { connect: { id: userData.id } },
        Agency: { connect: { id: foundAgencyId } },
        SubAccount: { connect: { id: subaccountId } },
      },
    });
  } else {
    // Could not find a subAccount ID
    // Creates the notification from the userData
    await db.notification.create({
      data: {
        notification: `${userData.name} | ${description}`,
        User: { connect: { id: userData.id } },
        Agency: { connect: { id: foundAgencyId } },
      },
    });
  }
};

// Creates a user
export const createTeamUser = async (agencyId: string, user: User) => {
  if (user.role === "AGENCY_OWNER") return null;

  const response = await db.user.create({ data: { ...user } });
  return response;
};

//
export const verifyAndAcceptInvitation = async () => {
  // Redirect if no user found
  const user = await currentUser();
  if (!user) return redirect("/sign-in");

  // Searches for an invitation
  const invitationExists = await db.invitation.findUnique({
    where: {
      email: user.emailAddresses[0].emailAddress,
      status: "PENDING",
    },
  });

  // When there is an invitation, create a user and save the log
  if (invitationExists) {
    const userDetails = await createTeamUser(invitationExists.agencyId, {
      email: invitationExists.email,
      agencyId: invitationExists.agencyId,
      avatarUrl: user.imageUrl,
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      role: invitationExists.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // Logging the user joined
    await saveActivityLogsNotification({
      agencyId: invitationExists?.agencyId,
      description: "Joined",
      subaccountId: undefined,
    });

    // If the account creation was successful...
    // Update the role and delete the invitation, return the agencyId
    // Otherwise return null
    if (userDetails) {
      await clerkClient.users.updateUserMetadata(user.id, {
        privateMetadata: {
          role: userDetails.role || "SUBACCOUNT_USER",
        },
      });

      await db.invitation.delete({
        where: {
          email: userDetails.email,
        },
      });

      return userDetails.agencyId;
    } else {
      return null;
    }
  } else {
    // This occurs when the invitation does NOT exist

    // Simply return the agency the user is already in, or return null
    const agency = await db.user.findUnique({
      where: { email: user.emailAddresses[0].emailAddress },
    });

    return agency ? agency.agencyId : null;
  }
};

export const updateAgencyDetails = async (
  agencyId: string,
  agencyDetails: Partial<Agency>
) => {
  const response = await db.agency.update({
    where: { id: agencyId },
    data: { ...agencyDetails },
  });

  return response;
};

export const deleteAgency = async (agencyId: string) => {
  const res = await db.agency.delete({ where: { id: agencyId } });

  return res;
};

export const initUser = async (newUser: Partial<User>) => {
  const USER_ROLE: Role = "SUBACCOUNT_USER";

  const user = await currentUser();

  if (!user) return;

  const userData = await db.user.upsert({
    where: { email: user.emailAddresses[0].emailAddress },
    update: newUser,
    create: {
      id: user.id,
      avatarUrl: user.imageUrl,
      email: user.emailAddresses[0].emailAddress,
      name: `${user.firstName} ${user.lastName}`,
      role: newUser.role || USER_ROLE,
    },
  });

  await clerkClient.users.updateUserMetadata(user.id, {
    privateMetadata: {
      role: newUser.role || USER_ROLE,
    },
  });

  return userData;
};

export const upsertAgency = async (agency: Agency, price?: Plan) => {
  if (!agency.companyEmail) return null;

  try {
    const agencyDetails = await db.agency.upsert({
      where: { id: agency.id },
      update: agency,
      create: {
        users: { connect: { email: agency.companyEmail } },
        ...agency,
        SidebarOption: {
          create: [
            {
              name: "Dashboard",
              icon: "category",
              link: `/agency/${agency.id}`,
            },
            {
              name: "Launchpad",
              icon: "clipboardIcon",
              link: `/agency/${agency.id}/launchpad`,
            },
            {
              name: "Billing",
              icon: "payment",
              link: `/agency/${agency.id}/billing`,
            },
            {
              name: "Settings",
              icon: "settings",
              link: `/agency/${agency.id}/settings`,
            },
            {
              name: "Sub Accounts",
              icon: "person",
              link: `/agency/${agency.id}/all-subaccounts`,
            },
            {
              name: "Team",
              icon: "shield",
              link: `/agency/${agency.id}/team`,
            },
          ],
        },
      },
    });

    return agencyDetails;
  } catch (error) {
    console.log("[UPSERT_AGENCY]", error);
  }
};

export const getNotificationAndUser = async (agencyId: string) => {
  try {
    const res = await db.notification.findMany({
      where: { agencyId },
      include: { User: true },
      orderBy: { createdAt: "desc" },
    });

    return res;
  } catch (error) {
    console.log("[GET_NOTIFICATION_AND_USER]", error);
  }
};

export const upsertSubAccount = async (subAccount: SubAccount) => {
  if (!subAccount.companyEmail) return null;

  const agencyOwner = await db.user.findFirst({
    where: {
      Agency: {
        id: subAccount.agencyId,
      },
      role: "AGENCY_OWNER",
    },
  });

  if (!agencyOwner) return console.log("Error");

  const permissionId = v4();
  const res = await db.subAccount.upsert({
    where: { id: subAccount.id },
    update: subAccount,
    create: {
      ...subAccount,
      Permissions: {
        create: {
          access: true,
          email: agencyOwner.email,
          id: permissionId,
        },
        connect: {
          subAccountId: subAccount.id,
          id: permissionId,
        },
      },
      Pipeline: {
        create: { name: "Lead Cycle" },
      },
      SidebarOption: {
        create: [
          {
            name: "Launchpad",
            icon: "clipboardIcon",
            link: `/subaccount/${subAccount.id}/launchpad`,
          },
          {
            name: "Settings",
            icon: "settings",
            link: `/subaccount/${subAccount.id}/settings`,
          },
          {
            name: "Funnels",
            icon: "pipelines",
            link: `/subaccount/${subAccount.id}/funnels`,
          },
          {
            name: "Media",
            icon: "database",
            link: `/subaccount/${subAccount.id}/media`,
          },
          {
            name: "Automations",
            icon: "chip",
            link: `/subaccount/${subAccount.id}/automations`,
          },
          {
            name: "Pipelines",
            icon: "flag",
            link: `/subaccount/${subAccount.id}/pipelines`,
          },
          {
            name: "Contacts",
            icon: "person",
            link: `/subaccount/${subAccount.id}/contacts`,
          },
          {
            name: "Dashboard",
            icon: "category",
            link: `/subaccount/${subAccount.id}`,
          },
        ],
      },
    },
  });

  return res;
};

export const getUserPermissions = async (userId: string) => {
  const res = await db.user.findUnique({
    where: { id: userId },
    select: { Permissions: { include: { SubAccount: true } } },
  });

  return res;
};

export const updateUser = async (user: Partial<User>) => {
  const response = await db.user.update({
    where: { email: user.email },
    data: { ...user },
  });

  // Update permissions clerk sees
  await clerkClient.users.updateUserMetadata(response.id, {
    privateMetadata: {
      role: user.role || "SUBACCOUNT_USER",
    },
  });

  return response;
};

export const changeUserPermissions = async (
  permissionId: string | undefined,
  userEmail: string,
  subAccountId: string,
  permission: boolean
) => {
  try {
    const res = await db.permissions.upsert({
      where: { id: permissionId },
      update: { access: permission },
      create: {
        access: permission,
        email: userEmail,
        subAccountId: subAccountId,
      },
    });

    return res;
  } catch (error) {
    console.log("Could not change permissions:\n\n", error);
  }
};

export const getSubaccountDetails = async (subaccountId: string) => {
  const res = await db.subAccount.findUnique({
    where: {
      id: subaccountId,
    },
  });

  return res;
};

export const deleteSubaccount = async (subaccountId: string) => {
  const res = await db.subAccount.delete({ where: { id: subaccountId } });

  return res;
};

export const deleteUser = async (userId: string) => {
  await clerkClient.users.updateUserMetadata(userId, {
    privateMetadata: {
      role: undefined,
    },
  });

  const deletedUser = await db.user.delete({ where: { id: userId } });

  return deletedUser;
};

export const getUser = async (id: string) => {
  const user = await db.user.findMany({
    where: { id: id },
  });

  return user;
};
