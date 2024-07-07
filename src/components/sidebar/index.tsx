import { getAuthUserDetails } from "@/lib/queries";
import React from "react";
import MenuOptions from "./menu-options";

type Props = {
  id: string;
  type: "agency" | "subaccount";
};

// Sidebar does most of the validation and data collection for the menu
//

const Sidebar = async ({ id, type }: Props) => {

  // Gets the agencies, subaccounts, and sidebar perms associated
  const user = await getAuthUserDetails();

  // Return nothing if there is neither a user or agency
  if (!user) return null;
  if (!user.Agency) return;

  // Finds subaccounts the user has access to
  const details =
    type === "agency"
      ? user.Agency
      : user.Agency.SubAccount.find((subaccount) => subaccount.id === id);

  // 
  const isWhitelabeledAgency = user.Agency.whiteLabel;
  if (!details) return;

  let sidebarLogo = user.Agency.agencyLogo || "/assets/plura-logo";

  // Changes the logo if it is a subaccount
  if (!isWhitelabeledAgency) {
    if (type === "subaccount") {
      sidebarLogo =
        user.Agency.SubAccount.find((subaccount) => subaccount.id === id)
          ?.subAccountLogo || user.Agency.agencyLogo;
    }
  }

  // Gets the sidebar options based on agency or subaccount
  const sidebarOpt =
    type === "agency"
      ? user.Agency.SidebarOption || []
      : user.Agency.SubAccount.find((subaccount) => subaccount.id === id)
          ?.SidebarOption || [];

  // Subaccounts apart of the agency
  // ONLY show accounts the user has access to
  const subaccounts = user.Agency.SubAccount.filter((subaccount) =>
    user.Permissions.find(
      (permission) =>
        permission.subAccountId === subaccount.id && permission.access
    )
  );

  return (
    //Once all the data is fetched, build the menu
    // Two menus, one for mobile and one for desktop
    // 
    <>
      <MenuOptions
        defaultOpen={true}
        details={details}
        id={id}
        sidebarLogo={sidebarLogo}
        sidebarOpt={sidebarOpt}
        subAccounts={subaccounts}
        user={user}
      />
      <MenuOptions
        defaultOpen={false}
        details={details}
        id={id}
        sidebarLogo={sidebarLogo}
        sidebarOpt={sidebarOpt}
        subAccounts={subaccounts}
        user={user}
      />
    </>
  );
};

export default Sidebar;
