"use client";

import {
  deleteSubaccount,
  getSubaccountDetails,
  saveActivityLogsNotification,
} from "@/lib/queries";
import { useRouter } from "next/navigation";
import React from "react";

type Props = {
  subaccountId: string;
};

const DeleteButton = ({ subaccountId }: Props) => {
  const router = useRouter();

  return (
    <div
      onClick={async () => {
        const res = await getSubaccountDetails(subaccountId);
        await saveActivityLogsNotification({
          agencyId: undefined,
          description: `Deleted a subaccount | ${res?.name}`,
          subaccountId: subaccountId,
        });

        await deleteSubaccount(subaccountId);

        router.refresh();
      }}
      className=""
    >
      Delete Sub Account
    </div>
  );
};

export default DeleteButton;
